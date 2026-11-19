window.Game = window.Game || {};

window.Game.UI = function (THREE) {
  const CFG = window.Game.Config;

  const els = {
    hud: document.getElementById('hud'),
    worldLayer: document.getElementById('world-ui-layer'),
    vignette: document.getElementById('screen-vignette'),
    waveLabel: document.getElementById('wave-label'),
    enemyCount: document.getElementById('enemy-count'),

    heroHpText: document.getElementById('hero-hp-text'),
    heroHpFill: document.getElementById('hero-hp-fill'),
    heroHpTrail: document.getElementById('hero-hp-trail'),
    heroBuffs: document.getElementById('hero-buffs'),

    bossWrap: document.getElementById('boss-bar-wrap'),
    bossName: document.getElementById('boss-name'),
    bossPhaseTag: document.getElementById('boss-phase-tag'),
    bossHpText: document.getElementById('boss-hp-text'),
    bossHpFill: document.getElementById('boss-hp-fill'),
    bossHpTrail: document.getElementById('boss-hp-trail'),
    bossActionBanner: document.getElementById('boss-action-banner'),

    ragePips: Array.from(document.querySelectorAll('#rage-pips .rage-pip')),
    ragePipsCount: document.getElementById('rage-pips-count'),
    rageBarFill: document.getElementById('rage-bar-fill'),
    rageBarText: document.getElementById('rage-bar-text'),

    indAttack: document.getElementById('ind-attack'),
    indBlock: document.getElementById('ind-block'),
    indDodge: document.getElementById('ind-dodge'),
    cdDodge: document.getElementById('cd-dodge'),

    skillSlots: {
      1: document.getElementById('skill-1'),
      2: document.getElementById('skill-2'),
      3: document.getElementById('skill-3'),
    },
    skillCds: {
      1: document.getElementById('cd-skill-1'),
      2: document.getElementById('cd-skill-2'),
      3: document.getElementById('cd-skill-3'),
    },

    centerBanner: document.getElementById('center-banner'),
    centerBannerSub: document.getElementById('center-banner-sub'),
    centerBannerTitle: document.getElementById('center-banner-title'),

    resultScreen: document.getElementById('result-screen'),
    resultBadge: document.getElementById('result-badge'),
    resultTitle: document.getElementById('result-title'),
    resultDesc: document.getElementById('result-desc'),
    resultStats: document.getElementById('result-stats'),
    btnEndless: document.getElementById('btn-endless'),
  };

  let cameraRef = null;
  let bannerTimer = 0;
  let hitFlashTimer = 0;
  let rageFlashTimer = 0;
  const enemyBarMap = new Map();
  const projVec = new THREE.Vector3();

  function setCamera(cam) {
    cameraRef = cam;
  }

  function worldToScreen(worldPos) {
    if (!cameraRef) return null;
    projVec.copy(worldPos).project(cameraRef);
    if (projVec.z > 1) return null;
    return {
      x: (projVec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projVec.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  function spawnFloatText(worldPos, text, style = 'normal') {
    const pt = worldToScreen(worldPos);
    if (!pt) return;
    const div = document.createElement('div');
    div.className = `float-text ${style}`;
    div.textContent = text;
    const jitterX = (Math.random() - 0.5) * 26;
    div.style.left = `${pt.x + jitterX}px`;
    div.style.top = `${pt.y}px`;
    els.worldLayer.appendChild(div);
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 920);
  }

  function triggerPipIgnite(pipIndex) {
    const el = els.ragePips[pipIndex - 1];
    if (!el) return;
    el.classList.remove('ignite');
    void el.offsetWidth;
    el.classList.add('ignite');
  }

  function flashRageBar() {
    rageFlashTimer = 0.12;
    els.rageBarFill.classList.add('flash');
  }

  function flashSkillSlot(skillId) {
    const slot = els.skillSlots[skillId];
    if (!slot) return;
    slot.classList.add('active-cast');
    setTimeout(() => slot.classList.remove('active-cast'), 160);
  }

  function flashScreenHit() {
    hitFlashTimer = 0.2;
    els.vignette.classList.add('hit-flash');
  }

  function showCenterBanner(title, sub = '', duration = 2.0) {
    els.centerBannerTitle.textContent = title;
    els.centerBannerSub.textContent = sub;
    els.centerBanner.classList.remove('hidden');
    bannerTimer = duration;
  }

  function setBossAction(text) {
    els.bossActionBanner.textContent = text || '';
  }

  function setWaveInfo(text, count) {
    els.waveLabel.textContent = text;
    els.enemyCount.textContent = `敌人: ${count}`;
  }

  function showHUD(visible) {
    els.hud.classList.toggle('hud-hidden', !visible);
  }

  function clearEnemyBars() {
    for (const entry of enemyBarMap.values()) {
      if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    }
    enemyBarMap.clear();
  }

  function updateEnemyBars(enemies) {
    const aliveIds = new Set();
    for (const e of enemies) {
      // Boss uses the grand top boss bar; regular Orcs get compact floating overhead bars
      if (e.dead || e.isBoss) continue;
      aliveIds.add(e.id);
      let entry = enemyBarMap.get(e.id);
      if (!entry) {
        const el = document.createElement('div');
        el.className = 'enemy-hp-bar';
        el.innerHTML = `<div class="enemy-hp-tag">半兽人</div><div class="enemy-hp-track"><div class="enemy-hp-fill"></div></div>`;
        els.worldLayer.appendChild(el);
        entry = {
          el,
          tag: el.querySelector('.enemy-hp-tag'),
          fill: el.querySelector('.enemy-hp-fill'),
        };
        enemyBarMap.set(e.id, entry);
      }

      const pt = worldToScreen(new THREE.Vector3(e.pos.x, 2.55 * e.model.scale, e.pos.z));
      if (!pt) {
        entry.el.style.display = 'none';
        continue;
      }
      entry.el.style.display = 'block';
      entry.el.style.left = `${pt.x}px`;
      entry.el.style.top = `${pt.y}px`;
      entry.fill.style.width = `${Math.max(0, (e.hp / e.maxHp) * 100)}%`;

      if (e.aiState === 'stunned') {
        entry.tag.textContent = '★ 眩晕';
        entry.tag.className = 'enemy-hp-tag stunned';
      } else if (e.slowTimer > 0) {
        entry.tag.textContent = '减速 · 半兽人';
        entry.tag.className = 'enemy-hp-tag';
      } else {
        entry.tag.textContent = '半兽人';
        entry.tag.className = 'enemy-hp-tag';
      }
    }

    for (const [id, entry] of enemyBarMap.entries()) {
      if (!aliveIds.has(id)) {
        if (entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
        enemyBarMap.delete(id);
      }
    }
  }

  function updateHUD(dt, combat, waveTitle) {
    const h = combat.state.hero;
    if (!h) return;

    // Timers
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) els.centerBanner.classList.add('hidden');
    }
    if (hitFlashTimer > 0) {
      hitFlashTimer -= dt;
      if (hitFlashTimer <= 0) els.vignette.classList.remove('hit-flash');
    }
    if (rageFlashTimer > 0) {
      rageFlashTimer -= dt;
      if (rageFlashTimer <= 0) els.rageBarFill.classList.remove('flash');
    }

    // Hero HP
    const hpPct = Math.max(0, (h.hp / h.maxHp) * 100);
    els.heroHpText.textContent = `${Math.ceil(h.hp)} / ${h.maxHp}`;
    els.heroHpFill.style.width = `${hpPct}%`;
    els.heroHpTrail.style.width = `${hpPct}%`;
    els.heroHpFill.classList.toggle('danger', hpPct <= 30);

    // Vignette states
    els.vignette.classList.toggle('low-hp', hpPct <= 28 && !h.dead);
    els.vignette.classList.toggle('whirlwind-aura', h.action === 'skill3');

    // Hero Buff Chips
    const chips = [];
    if (h.empoweredHits > 0) {
      chips.push(`<span class="buff-chip">⚡ 战意昂扬 ×${h.empoweredHits} (+35%回怒)</span>`);
    }
    if (combat.state.shieldProjectile) {
      chips.push(`<span class="buff-chip shield">🛡 飞盾出击中</span>`);
    }
    if (h.action === 'skill3') {
      chips.push(`<span class="buff-chip">🔥 旋风霸体 (-50%受击)</span>`);
    }
    els.heroBuffs.innerHTML = chips.join('');

    // Rage Pips (0..3)
    els.ragePipsCount.textContent = `${h.ragePips} / ${CFG.HERO.MAX_PIPS}`;
    for (let i = 0; i < 3; i++) {
      els.ragePips[i].classList.toggle('active', i < h.ragePips);
    }

    // Rage Charging Bar (0..100%)
    if (h.ragePips >= CFG.HERO.MAX_PIPS) {
      els.rageBarFill.classList.add('max-pips');
      els.rageBarText.textContent = '怒气点已满 (3/3) · 请释放技能消耗怒气点';
    } else {
      els.rageBarFill.classList.remove('max-pips');
      const rPct = Math.min(100, Math.max(0, (h.rage / CFG.HERO.MAX_RAGE) * 100));
      els.rageBarFill.style.width = `${rPct}%`;
      els.rageBarText.textContent = `近战积蓄怒气 ${Math.floor(rPct)}% → 满100%激活1点`;
    }

    // Basic action highlights
    els.indAttack.classList.toggle('active', h.action === 'attack');
    els.indBlock.classList.toggle('active', h.isBlocking);
    els.indDodge.classList.toggle('active', h.action === 'dodge');
    const dodgeRatio = h.dodgeCooldown > 0 ? (h.dodgeCooldown / CFG.HERO.DODGE_COOLDOWN) * 100 : 0;
    els.cdDodge.style.height = `${dodgeRatio}%`;

    // 3 Skill Slots
    for (const id of [1, 2, 3]) {
      const slot = els.skillSlots[id];
      const cdEl = els.skillCds[id];
      const spec = CFG.SKILLS[id];
      const cd = h.skillCooldowns[id];
      const shieldBlocked = (id === 1 || id === 2) && !!combat.state.shieldProjectile;
      const canCast = h.ragePips >= spec.cost && cd <= 0 && !shieldBlocked && !h.dead;

      slot.classList.toggle('ready', canCast);
      slot.classList.toggle('locked', !canCast);

      if (cd > 0) {
        cdEl.classList.add('on-cd');
        cdEl.textContent = cd.toFixed(1);
      } else if (shieldBlocked) {
        cdEl.classList.add('on-cd');
        cdEl.textContent = '飞出';
      } else {
        cdEl.classList.remove('on-cd');
      }
    }

    // Wave info
    setWaveInfo(waveTitle, combat.getLivingEnemyCount());

    // Boss HP Bar
    const boss = combat.getActiveBoss();
    if (boss) {
      els.bossWrap.classList.remove('hidden');
      els.bossName.textContent = boss.name;
      els.bossPhaseTag.classList.toggle('hidden', !boss.enraged);
      const bPct = Math.max(0, (boss.hp / boss.maxHp) * 100);
      els.bossHpText.textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp}`;
      els.bossHpFill.style.width = `${bPct}%`;
      els.bossHpTrail.style.width = `${bPct}%`;
    } else {
      els.bossWrap.classList.add('hidden');
      setBossAction('');
    }

    // Floating overhead bars for Orc Warriors
    updateEnemyBars(combat.state.enemies);
  }

  function showResult(victory, stats, waveNum) {
    els.resultScreen.classList.remove('hidden');
    els.resultBadge.textContent = victory ? '森林净化 · 胜利' : '力战倒下 · 失败';
    els.resultTitle.textContent = victory ? '斩杀半兽统领！' : '防线失守';
    els.resultDesc.textContent = victory
      ? `你以剑盾之威完美掌控近战回怒与空间拉扯，成功击溃第 ${waveNum} 波半兽大军！`
      : '半兽人潮攻势凶猛——善用右键精准格挡快速回怒，利用 2点飞盾风筝 Boss 震地！';
    els.btnEndless.style.display = victory ? 'inline-block' : 'none';

    els.resultStats.innerHTML = `
      <div class="stat-box"><div class="stat-val">${stats.kills}</div><div class="stat-lbl">击杀半兽人</div></div>
      <div class="stat-box"><div class="stat-val">${stats.pipsEarned}</div><div class="stat-lbl">激活怒气点</div></div>
      <div class="stat-box"><div class="stat-val">${stats.perfectBlocks}</div><div class="stat-lbl">精准格挡</div></div>
    `;
  }

  function hideResult() {
    els.resultScreen.classList.add('hidden');
  }

  return {
    setCamera,
    spawnFloatText,
    triggerPipIgnite,
    flashRageBar,
    flashSkillSlot,
    flashScreenHit,
    showCenterBanner,
    setBossAction,
    setWaveInfo,
    showHUD,
    clearEnemyBars,
    updateHUD,
    showResult,
    hideResult,
  };
};
