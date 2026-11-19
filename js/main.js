window.Game = window.Game || {};

(async function bootstrap() {
  const statusEl = document.getElementById('loading-status');
  const startBtn = document.getElementById('btn-start-game');
  const startBossBtn = document.getElementById('btn-start-boss');
  startBtn.disabled = true;
  startBossBtn.disabled = true;

  async function loadThreeFromCDN() {
    const cdnUrls = [
      'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
      'https://unpkg.com/three@0.170.0/build/three.module.js',
      'https://esm.sh/three@0.170.0',
    ];
    let lastErr = null;
    for (const url of cdnUrls) {
      try {
        const mod = await import(url);
        if (mod && mod.Scene) return mod;
      } catch (err) {
        lastErr = err;
        console.warn('[Three CDN fallback]', url, err);
      }
    }
    throw lastErr || new Error('无法从 CDN 加载 Three.js');
  }

  let THREE;
  try {
    THREE = await loadThreeFromCDN();
    statusEl.textContent = '3D 林海战场已就绪 · 点击开始战斗';
    startBtn.disabled = false;
    startBossBtn.disabled = false;
  } catch (err) {
    statusEl.classList.add('error');
    statusEl.textContent = 'Three.js CDN 加载失败，请检查网络连接后刷新页面。';
    console.error(err);
    return;
  }

  const CFG = window.Game.Config;
  const Audio = window.Game.Audio;

  // ---- Renderer & Scene ----
  const container = document.getElementById('canvas-container');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(47, window.innerWidth / window.innerHeight, 0.5, 160);

  const env = window.Game.Environment.build(THREE, scene);
  const vfx = window.Game.VFX(THREE, scene);
  const ui = window.Game.UI(THREE);
  ui.setCamera(camera);
  const combat = window.Game.Combat(THREE, scene, vfx, ui);

  // ---- Game Session State ----
  let mode = 'title'; // 'title' | 'playing' | 'paused' | 'ended'
  let waveIndex = 0;
  let waveTitle = '林海试炼';
  let nextWaveTimer = 0;
  let endlessWaveNum = 2;

  // Camera state
  let zoomFactor = 1.0;
  const camTarget = new THREE.Vector3(0, 1.0, 4.0);
  const camPos = new THREE.Vector3(0, 16.5, 19.5);
  let titleOrbitAngle = 0.2;

  // Input state
  const keys = Object.create(null);
  let mouseLeftDown = false;
  let mouseRightDown = false;
  const mouseNDC = new THREE.Vector2(0, 0);
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aimPoint = new THREE.Vector3(0, 0, 0);
  const moveVec = new THREE.Vector3();

  // Initialize showcase scene immediately so the 3D forest & warrior look alive behind title overlay!
  combat.resetAll();
  combat.spawnEnemy('orc', -4.2, -5.0);
  combat.spawnEnemy('orc', 4.5, -5.2);
  combat.spawnEnemy('boss', 0, -9.2);

  // ---- Wave & Encounter Manager ----
  function spawnWaveByIndex(idx) {
    const waveDef = CFG.WAVES[idx];
    if (!waveDef) return;
    waveTitle = `${waveDef.sub} · ${waveDef.title}`;
    ui.showCenterBanner(waveDef.title, waveDef.sub, 2.1);

    const spawns = [];
    for (const grp of waveDef.spawns) {
      for (let i = 0; i < grp.count; i++) spawns.push(grp.type);
    }

    const total = spawns.length;
    spawns.forEach((type, i) => {
      if (type === 'boss') {
        combat.spawnEnemy('boss', 0, -9.8);
      } else {
        const spread = ((i + 0.5) / total - 0.5) * Math.PI * 1.35;
        const ang = -Math.PI / 2 + spread + (Math.random() - 0.5) * 0.25;
        const dist = 10.2 + Math.random() * 2.8;
        combat.spawnEnemy('orc', Math.cos(ang) * dist, Math.sin(ang) * dist);
      }
    });
  }

  function spawnEndlessWave(num) {
    waveTitle = `第 ${num} 波 · 无尽狂潮`;
    ui.showCenterBanner(`第 ${num} 波狂潮`, '无尽试炼', 2.0);
    const orcCount = Math.min(6, 2 + num);
    for (let i = 0; i < orcCount; i++) {
      const ang = (i / orcCount) * Math.PI * 2 + Math.random() * 0.4;
      const r = 10.5 + Math.random() * 3.0;
      combat.spawnEnemy('orc', Math.cos(ang) * r, Math.sin(ang) * r);
    }
    combat.spawnEnemy('boss', 0, -10.5);
  }

  function startMatch(directBoss = false) {
    Audio.unlock();
    document.getElementById('overlay-screen').classList.add('hidden');
    document.getElementById('help-modal').classList.add('hidden');
    ui.hideResult();
    ui.showHUD(true);

    combat.resetAll();
    mode = 'playing';
    nextWaveTimer = 0;
    endlessWaveNum = 2;

    if (directBoss) {
      waveIndex = 1;
      spawnWaveByIndex(1);
    } else {
      waveIndex = 0;
      spawnWaveByIndex(0);
    }
  }

  combat.state.onEnemyKilled = () => {
    if (mode !== 'playing') return;
    if (combat.getLivingEnemyCount() === 0) {
      if (waveIndex < CFG.WAVES.length - 1) {
        waveIndex += 1;
        nextWaveTimer = 1.65;
        ui.showCenterBanner('林间清空！', '半兽统领即将现身...', 1.5);
      } else {
        // Boss defeated! Victory!
        setTimeout(() => {
          if (mode === 'playing' && combat.getLivingEnemyCount() === 0) {
            mode = 'ended';
            ui.showResult(true, combat.state.stats, Math.max(waveIndex + 1, endlessWaveNum));
          }
        }, 900);
      }
    }
  };

  combat.state.onHeroDied = () => {
    if (mode !== 'playing') return;
    setTimeout(() => {
      mode = 'ended';
      ui.showResult(false, combat.state.stats, waveIndex + 1);
    }, 850);
  };

  // ---- Input Listeners ----
  function updateAimPoint() {
    raycaster.setFromCamera(mouseNDC, camera);
    raycaster.ray.intersectPlane(groundPlane, aimPoint);
    const maxR = CFG.ARENA_RADIUS + 4;
    const d = Math.hypot(aimPoint.x, aimPoint.z);
    if (d > maxR) {
      aimPoint.x = (aimPoint.x / d) * maxR;
      aimPoint.z = (aimPoint.z / d) * maxR;
    }
    env.reticle.position.set(aimPoint.x, 0, aimPoint.z);
    env.reticle.visible = mode === 'playing';
  }

  window.addEventListener('mousemove', (e) => {
    mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (mode !== 'playing') return;
    Audio.unlock();
    updateAimPoint();
    if (e.button === 0) {
      mouseLeftDown = true;
      combat.tryAttack(aimPoint);
    } else if (e.button === 2) {
      mouseRightDown = true;
      combat.setBlocking(true);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseLeftDown = false;
    if (e.button === 2) {
      mouseRightDown = false;
      combat.setBlocking(false);
    }
  });

  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener(
    'wheel',
    (e) => {
      if (mode !== 'playing') return;
      zoomFactor = Math.max(0.76, Math.min(1.36, zoomFactor + e.deltaY * 0.0007));
    },
    { passive: true }
  );

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    keys[code] = true;

    if (code === 'Escape') {
      const help = document.getElementById('help-modal');
      if (!help.classList.contains('hidden')) {
        help.classList.add('hidden');
        if (mode === 'paused') mode = 'playing';
      }
      return;
    }

    if (mode !== 'playing') return;
    Audio.unlock();
    updateAimPoint();

    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
      e.preventDefault();
      computeMoveVector();
      combat.tryDodge(moveVec, aimPoint);
    } else if (code === 'KeyJ') {
      combat.tryAttack(aimPoint);
    } else if (code === 'Digit1' || code === 'KeyQ') {
      combat.tryCastSkill(1, aimPoint);
    } else if (code === 'Digit2' || code === 'KeyE') {
      combat.tryCastSkill(2, aimPoint);
    } else if (code === 'Digit3' || code === 'KeyR') {
      combat.tryCastSkill(3, aimPoint);
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouseLeftDown = false;
    mouseRightDown = false;
    combat.setBlocking(false);
  });

  // HUD Button Wiring
  startBtn.addEventListener('click', () => startMatch(false));
  startBossBtn.addEventListener('click', () => startMatch(true));

  document.getElementById('btn-restart').addEventListener('click', () => startMatch(false));
  document.getElementById('btn-spawn-boss').addEventListener('click', () => startMatch(true));

  document.getElementById('btn-play-again').addEventListener('click', () => startMatch(false));
  document.getElementById('btn-endless').addEventListener('click', () => {
    ui.hideResult();
    mode = 'playing';
    endlessWaveNum += 1;
    // Restore 40% HP between endless waves
    const h = combat.state.hero;
    if (h) h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.4));
    spawnEndlessWave(endlessWaveNum);
  });

  document.getElementById('btn-mute').addEventListener('click', () => {
    const next = !Audio.isMuted();
    Audio.setMuted(next);
    document.getElementById('mute-icon').textContent = next ? '🔇' : '🔊';
  });

  document.getElementById('btn-help').addEventListener('click', () => {
    const help = document.getElementById('help-modal');
    if (help.classList.contains('hidden')) {
      help.classList.remove('hidden');
      if (mode === 'playing') mode = 'paused';
    } else {
      help.classList.add('hidden');
      if (mode === 'paused') mode = 'playing';
    }
  });

  document.getElementById('btn-close-help').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
    if (mode === 'paused') mode = 'playing';
  });

  // Clickable skill slots on HUD
  for (const id of [1, 2, 3]) {
    document.getElementById(`skill-${id}`).addEventListener('click', (e) => {
      e.stopPropagation();
      if (mode !== 'playing') return;
      Audio.unlock();
      updateAimPoint();
      combat.tryCastSkill(id, aimPoint);
    });
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function computeMoveVector() {
    let mx = 0;
    let mz = 0;
    if (keys['KeyW'] || keys['ArrowUp']) mz -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) mz += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    moveVec.set(mx, 0, mz);
    if (moveVec.lengthSq() > 0) moveVec.normalize();
  }

  // ---- Main Render & Simulation Loop ----
  let lastTime = performance.now();
  let totalTime = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    totalTime += dt;

    env.update(totalTime);

    if (mode === 'title') {
      // Atmospheric slow orbit showcase of forest clearing, warrior, orcs & warlord!
      titleOrbitAngle += dt * 0.16;
      const r = 18.5;
      camera.position.set(Math.sin(titleOrbitAngle) * r, 11.8, Math.cos(titleOrbitAngle) * r + 1.5);
      camera.lookAt(0, 1.2, -1.8);
      env.reticle.visible = false;
      renderer.render(scene, camera);
      return;
    }

    if (mode === 'playing') {
      updateAimPoint();
      computeMoveVector();

      // Continuous attack while holding LMB
      if (mouseLeftDown) {
        combat.tryAttack(aimPoint);
      }
      combat.setBlocking(mouseRightDown);

      // Wave transition countdown
      if (nextWaveTimer > 0) {
        nextWaveTimer -= dt;
        if (nextWaveTimer <= 0) {
          spawnWaveByIndex(waveIndex);
        }
      }

      combat.update(dt, moveVec, aimPoint);
      ui.updateHUD(dt, combat, waveTitle);
    }

    // Smooth Action Follow Camera with subtle mouse lookahead + camera shake!
    const h = combat.state.hero;
    if (h) {
      const lookAheadX = Math.max(-2.6, Math.min(2.6, (aimPoint.x - h.pos.x) * 0.18));
      const lookAheadZ = Math.max(-2.6, Math.min(2.6, (aimPoint.z - h.pos.z) * 0.18));
      const desiredTargetX = h.pos.x + lookAheadX;
      const desiredTargetZ = h.pos.z + lookAheadZ;

      camTarget.x += (desiredTargetX - camTarget.x) * Math.min(1, dt * 7.5);
      camTarget.y = 1.05;
      camTarget.z += (desiredTargetZ - camTarget.z) * Math.min(1, dt * 7.5);

      const baseY = 12.8 * zoomFactor;
      const baseZ = 15.6 * zoomFactor;
      const desiredCamX = camTarget.x;
      const desiredCamY = baseY;
      const desiredCamZ = camTarget.z + baseZ;

      camPos.x += (desiredCamX - camPos.x) * Math.min(1, dt * 8.5);
      camPos.y += (desiredCamY - camPos.y) * Math.min(1, dt * 8.5);
      camPos.z += (desiredCamZ - camPos.z) * Math.min(1, dt * 8.5);

      const shake = combat.state.shakeIntensity;
      const sx = shake > 0.005 ? (Math.random() - 0.5) * shake * 1.1 : 0;
      const sy = shake > 0.005 ? (Math.random() - 0.5) * shake * 0.8 : 0;
      const sz = shake > 0.005 ? (Math.random() - 0.5) * shake * 1.1 : 0;

      camera.position.set(camPos.x + sx, camPos.y + sy, camPos.z + sz);
      camera.lookAt(camTarget);
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(tick);
})();
