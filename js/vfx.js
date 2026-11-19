window.Game = window.Game || {};

window.Game.VFX = function (THREE, scene) {
  const activeEffects = [];
  const particles = [];
  const sharedSparkGeo = new THREE.OctahedronGeometry(0.1, 0);

  function addEffect(obj, duration, updateFn) {
    scene.add(obj);
    activeEffects.push({ obj, age: 0, duration, updateFn });
  }

  function disposeObject(obj) {
    scene.remove(obj);
    obj.traverse((child) => {
      if (child.geometry && child.geometry !== sharedSparkGeo) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
  }

  function spawnSlashArc(pos, yaw, radius, arcAngle, color, reverse = false, duration = 0.22, height = 1.15) {
    const innerR = radius * 0.48;
    const geo = new THREE.RingGeometry(innerR, radius, 22, 1, -arcAngle / 2, arcAngle);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, height, pos.z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = yaw - Math.PI / 2;
    mesh.rotation.x = -Math.PI / 2 + (reverse ? 0.14 : -0.14);

    const startSpin = reverse ? 0.45 : -0.45;
    const endSpin = reverse ? -0.55 : 0.55;
    addEffect(mesh, duration, (t) => {
      mesh.rotation.z = startSpin + (endSpin - startSpin) * t;
      const s = 0.88 + t * 0.24;
      mesh.scale.set(s, s, 1);
      mat.opacity = Math.max(0, (1 - t) * 0.9);
    });
  }

  function spawnShockwave(pos, startR, endR, color, duration = 0.36, y = 0.08) {
    const geo = new THREE.RingGeometry(0.76, 1.0, 36);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, y, pos.z);
    mesh.scale.setScalar(startR);

    addEffect(mesh, duration, (t) => {
      const ease = 1 - Math.pow(1 - t, 3);
      const r = startR + (endR - startR) * ease;
      mesh.scale.setScalar(r);
      mat.opacity = Math.max(0, (1 - t) * 0.85);
    });
  }

  function spawnLightningArc(fromPos, toPos, color = 0x7dd3fc, duration = 0.26) {
    const segments = 9;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;
      const x = fromPos.x + (toPos.x - fromPos.x) * f;
      const y = fromPos.y + (toPos.y - fromPos.y) * f;
      const z = fromPos.z + (toPos.z - fromPos.z) * f;
      const jitter = i === 0 || i === segments ? 0 : 0.55;
      pts.push(
        new THREE.Vector3(
          x + (Math.random() - 0.5) * jitter,
          y + (Math.random() - 0.5) * jitter * 0.7,
          z + (Math.random() - 0.5) * jitter
        )
      );
    }

    const group = new THREE.Group();
    const geo1 = new THREE.BufferGeometry().setFromPoints(pts);
    const mat1 = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Line(geo1, mat1));

    // Secondary golden core bolt for punchy visibility
    const pts2 = pts.map((p, idx) =>
      idx === 0 || idx === segments
        ? p.clone()
        : p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.28, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.28))
    );
    const geo2 = new THREE.BufferGeometry().setFromPoints(pts2);
    const mat2 = new THREE.LineBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    group.add(new THREE.Line(geo2, mat2));

    addEffect(group, duration, (t) => {
      mat1.opacity = Math.max(0, 1 - t);
      mat2.opacity = Math.max(0, (1 - t) * 0.9);
    });
  }

  function spawnSparks(pos, count, color, speedMin = 3, speedMax = 9, life = 0.42, scale = 1.0) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(sharedSparkGeo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      const s = (0.65 + Math.random() * 0.85) * scale;
      mesh.scale.setScalar(s);
      scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      particles.push({
        mesh,
        mat,
        vx: Math.cos(angle) * spd,
        vy: 2.2 + Math.random() * 5.2,
        vz: Math.sin(angle) * spd,
        age: 0,
        life: life * (0.7 + Math.random() * 0.6),
        baseScale: s,
      });
    }
  }

  function spawnShieldTrailDot(pos) {
    const geo = new THREE.SphereGeometry(0.17, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    addEffect(mesh, 0.22, (t) => {
      mesh.scale.setScalar(Math.max(0.05, 1 - t));
      mat.opacity = Math.max(0, (1 - t) * 0.7);
    });
  }

  function createWhirlwindVortex(radius) {
    const group = new THREE.Group();
    group.visible = false;

    const ring1 = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.42, radius, 32, 1, 0, Math.PI * 1.4),
      new THREE.MeshBasicMaterial({
        color: 0xff8c24,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 1.1;

    const ring2 = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.58, radius * 0.96, 32, 1, Math.PI, Math.PI * 1.25),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 1.32;

    const groundWind = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.78, radius * 1.04, 36),
      new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    groundWind.rotation.x = -Math.PI / 2;
    groundWind.position.y = 0.08;

    group.add(ring1, ring2, groundWind);
    scene.add(group);

    return {
      group,
      ring1,
      ring2,
      groundWind,
      update(dt, heroPos, active) {
        group.visible = active;
        if (!active) return;
        group.position.set(heroPos.x, 0, heroPos.z);
        ring1.rotation.z -= dt * 16.0;
        ring2.rotation.z -= dt * 21.0;
        groundWind.rotation.z += dt * 7.0;
      },
    };
  }

  // Ground attack telegraphs for enemies & Boss
  function createSectorTelegraph(pos, yaw, radius, arcAngle, color = 0xef4444) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.09, pos.z);
    group.rotation.y = yaw;

    const outlineGeo = new THREE.RingGeometry(0.25, radius, 26, 1, -arcAngle / 2, arcAngle);
    const outlineMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const base = new THREE.Mesh(outlineGeo, outlineMat);
    base.rotation.x = -Math.PI / 2;
    base.rotation.z = -Math.PI / 2;
    group.add(base);

    // Bright outer warning arc rim
    const rimGeo = new THREE.RingGeometry(radius - 0.16, radius + 0.04, 26, 1, -arcAngle / 2, arcAngle);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xff6b4a,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.rotation.z = -Math.PI / 2;
    rim.position.y = 0.015;
    group.add(rim);

    const fillGeo = new THREE.CircleGeometry(radius, 26, -arcAngle / 2, arcAngle);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xff4d2e,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.rotation.z = -Math.PI / 2;
    fill.position.y = 0.01;
    fill.scale.setScalar(0.05);
    group.add(fill);

    scene.add(group);
    return {
      group,
      setProgress(p) {
        const clamped = Math.max(0.05, Math.min(1, p));
        fill.scale.setScalar(clamped);
        fillMat.opacity = 0.34 + clamped * 0.38;
      },
      destroy() {
        disposeObject(group);
      },
    };
  }

  function createCircleTelegraph(pos, radius, color = 0xef4444) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.06, pos.z);

    const outer = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.18, radius, 40),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    outer.rotation.x = -Math.PI / 2;
    group.add(outer);

    const bg = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 40),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    bg.rotation.x = -Math.PI / 2;
    group.add(bg);

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xff6a2b,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.012;
    fill.scale.setScalar(0.02);
    group.add(fill);

    scene.add(group);
    return {
      group,
      setProgress(p) {
        const c = Math.max(0.02, Math.min(1, p));
        fill.scale.setScalar(c);
        fillMat.opacity = 0.25 + c * 0.4;
      },
      destroy() {
        disposeObject(group);
      },
    };
  }

  function createLaneTelegraph(pos, yaw, length, width, color = 0xef4444) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.06, pos.z);
    group.rotation.y = yaw;

    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    base.rotation.x = -Math.PI / 2;
    base.position.z = length / 2;
    group.add(base);

    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xff5a26,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.9, length), fillMat);
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(0, 0.012, 0.05);
    fill.scale.y = 0.02;
    group.add(fill);

    scene.add(group);
    return {
      group,
      setProgress(p) {
        const c = Math.max(0.02, Math.min(1, p));
        fill.scale.y = c;
        fill.position.z = (length * c) / 2;
      },
      destroy() {
        disposeObject(group);
      },
    };
  }

  function update(dt) {
    for (let i = activeEffects.length - 1; i >= 0; i--) {
      const fx = activeEffects[i];
      fx.age += dt;
      const t = Math.min(1, fx.age / fx.duration);
      fx.updateFn(t);
      if (fx.age >= fx.duration) {
        disposeObject(fx.obj);
        activeEffects.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        scene.remove(p.mesh);
        p.mat.dispose();
        particles.splice(i, 1);
        continue;
      }
      p.vy -= 14.5 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.06, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.vx *= 1 - Math.min(0.9, dt * 2.8);
      p.vz *= 1 - Math.min(0.9, dt * 2.8);
      const t = p.age / p.life;
      p.mesh.scale.setScalar(p.baseScale * Math.max(0.05, 1 - t));
      p.mat.opacity = 1 - t;
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
    }
  }

  function clear() {
    while (activeEffects.length > 0) {
      disposeObject(activeEffects.pop().obj);
    }
    while (particles.length > 0) {
      const p = particles.pop();
      scene.remove(p.mesh);
      p.mat.dispose();
    }
  }

  return {
    spawnSlashArc,
    spawnShockwave,
    spawnLightningArc,
    spawnSparks,
    spawnShieldTrailDot,
    createWhirlwindVortex,
    createSectorTelegraph,
    createCircleTelegraph,
    createLaneTelegraph,
    update,
    clear,
  };
};
