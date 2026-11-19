window.Game = window.Game || {};

window.Game.Models = (function () {
  function createShieldVisual(THREE) {
    const shieldTex = window.Game.Textures.createShieldEmblemTexture(THREE);
    const shieldGroup = new THREE.Group();

    const faceMat = new THREE.MeshStandardMaterial({
      map: shieldTex,
      metalness: 0.55,
      roughness: 0.3,
      emissive: 0x164e63,
      emissiveIntensity: 0.35,
    });
    const goldRimMat = new THREE.MeshStandardMaterial({
      color: 0xeab954,
      metalness: 0.8,
      roughness: 0.25,
      emissive: 0x5c3605,
      emissiveIntensity: 0.2,
    });

    // Kite/round-heater hybrid shield body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.46, 0.11, 8), faceMat);
    body.rotation.x = Math.PI / 2;
    body.rotation.y = Math.PI / 8;
    body.castShadow = true;
    shieldGroup.add(body);

    // Gilded rim ring
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.53, 0.055, 8, 8), goldRimMat);
    rim.rotation.z = Math.PI / 8;
    shieldGroup.add(rim);

    // Center glowing rune boss
    const bossGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.4,
        roughness: 0.15,
      })
    );
    bossGem.position.z = 0.08;
    bossGem.scale.set(1, 1, 0.55);
    shieldGroup.add(bossGem);

    return { group: shieldGroup, bossGem, faceMat };
  }

  function createHero(THREE) {
    const root = new THREE.Group();
    const bodyRoot = new THREE.Group();
    root.add(bodyRoot);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0xb9c6d6, metalness: 0.72, roughness: 0.28 });
    const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x3b4656, metalness: 0.6, roughness: 0.42 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xebb952, metalness: 0.82, roughness: 0.25 });
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x1e4d94, roughness: 0.75, side: THREE.DoubleSide });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4e3422, roughness: 0.82 });

    // Ground selection / hero orientation ring
    const heroRing = new THREE.Mesh(
      new THREE.RingGeometry(0.76, 0.92, 32),
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    heroRing.rotation.x = -Math.PI / 2;
    heroRing.position.y = 0.04;
    root.add(heroRing);

    // Legs
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.22, 0.78, 0);
    const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), darkSteelMat);
    lLegMesh.position.y = -0.36;
    lLegMesh.castShadow = true;
    const lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.34), steelMat);
    lBoot.position.set(0, -0.66, 0.04);
    leftLeg.add(lLegMesh, lBoot);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.22, 0.78, 0);
    const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), darkSteelMat);
    rLegMesh.position.y = -0.36;
    rLegMesh.castShadow = true;
    const rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.34), steelMat);
    rBoot.position.set(0, -0.66, 0.04);
    rightLeg.add(rLegMesh, rBoot);
    bodyRoot.add(leftLeg, rightLeg);

    // Torso
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 1.24;
    bodyRoot.add(torsoGroup);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.84, 0.48), steelMat);
    chest.castShadow = true;
    chest.receiveShadow = true;
    torsoGroup.add(chest);

    // Gold chest trim & belt
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.46, 0.52), goldMat);
    chestPlate.position.y = 0.1;
    torsoGroup.add(chestPlate);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.16, 0.52), leatherMat);
    belt.position.y = -0.34;
    torsoGroup.add(belt);

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.55), goldMat);
    buckle.position.y = -0.34;
    torsoGroup.add(buckle);

    // Heroic flowing cloak
    const cloakPivot = new THREE.Group();
    cloakPivot.position.set(0, 0.34, -0.25);
    const cloakMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.18, 0.06), cloakMat);
    cloakMesh.position.set(0, -0.58, -0.05);
    cloakMesh.rotation.x = 0.18;
    cloakMesh.castShadow = true;
    cloakPivot.add(cloakMesh);
    torsoGroup.add(cloakPivot);

    // Head & Crested Knight Helm
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.68, 0);
    const helm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.48), steelMat);
    helm.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.1, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
    );
    visor.position.set(0, 0.02, 0.24);
    const crestGold = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.56), goldMat);
    crestGold.position.set(0, 0.28, -0.04);
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.52, 6),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 })
    );
    plume.position.set(0, 0.38, -0.3);
    plume.rotation.x = -0.9;
    headGroup.add(helm, visor, crestGold, plume);
    torsoGroup.add(headGroup);

    // Pauldrons
    const pauldronGeo = new THREE.SphereGeometry(0.27, 8, 6);
    const lPauldron = new THREE.Mesh(pauldronGeo, goldMat);
    lPauldron.position.set(-0.54, 0.28, 0);
    lPauldron.scale.set(1.05, 0.85, 1.1);
    const rPauldron = new THREE.Mesh(pauldronGeo, goldMat);
    rPauldron.position.set(0.54, 0.28, 0);
    rPauldron.scale.set(1.05, 0.85, 1.1);
    torsoGroup.add(lPauldron, rPauldron);

    // Right Arm + Broadsword
    const rightArm = new THREE.Group();
    rightArm.position.set(0.56, 0.24, 0);
    const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.64, 0.22), darkSteelMat);
    rArmMesh.position.y = -0.26;
    rArmMesh.castShadow = true;
    rightArm.add(rArmMesh);

    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, -0.54, 0.15);
    swordGroup.rotation.x = Math.PI * 0.42;

    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.34, 6), leatherMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.11), goldMat);
    guard.position.y = 0.18;
    const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), goldMat);
    pommel.position.y = -0.18;
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe6effa,
      metalness: 0.88,
      roughness: 0.16,
      emissive: 0x3b82f6,
      emissiveIntensity: 0.12,
    });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.48, 0.045), bladeMat);
    blade.position.y = 0.94;
    blade.castShadow = true;
    const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.28, 4), bladeMat);
    bladeTip.position.y = 1.8;
    bladeTip.rotation.y = Math.PI / 4;
    swordGroup.add(hilt, guard, pommel, blade, bladeTip);
    rightArm.add(swordGroup);
    torsoGroup.add(rightArm);

    // Left Arm + Rune Heater Shield
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.56, 0.24, 0);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.22), darkSteelMat);
    lArmMesh.position.y = -0.25;
    lArmMesh.castShadow = true;
    leftArm.add(lArmMesh);

    const shieldBuild = createShieldVisual(THREE);
    const shieldHolder = shieldBuild.group;
    shieldHolder.position.set(-0.18, -0.34, 0.22);
    shieldHolder.rotation.y = -0.55;
    leftArm.add(shieldHolder);
    torsoGroup.add(leftArm);

    // 3 Diegetic Orbiting Rage Pip Crystals around Hero!
    const pipOrbitGroup = new THREE.Group();
    pipOrbitGroup.position.y = 1.48;
    root.add(pipOrbitGroup);
    const pipOrbs = [];
    for (let i = 0; i < 3; i++) {
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xff7b00,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      });
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), orbMat);
      orb.visible = false;
      pipOrbitGroup.add(orb);
      pipOrbs.push(orb);
    }

    // Subtle guard aura dome (visible when holding shield block)
    const guardDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 16, 12, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.15, Math.PI * 0.65),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    guardDome.position.set(0, 1.15, 0.12);
    guardDome.rotation.y = Math.PI / 2;
    guardDome.visible = false;
    bodyRoot.add(guardDome);

    return {
      root,
      bodyRoot,
      torsoGroup,
      headGroup,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      swordGroup,
      bladeMat,
      shieldHolder,
      shieldGem: shieldBuild.bossGem,
      cloakPivot,
      pipOrbitGroup,
      pipOrbs,
      guardDome,
      heroRing,
    };
  }

  function createFlyingShield(THREE) {
    const build = createShieldVisual(THREE);
    const group = new THREE.Group();
    build.group.rotation.x = Math.PI / 2; // Flat horizontal frisbee spin
    group.add(build.group);

    // Glowing cyan-gold energy rim halo while airborne
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.92, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    group.add(halo);

    const innerHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.65, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    innerHalo.rotation.x = -Math.PI / 2;
    innerHalo.position.y = 0.03;
    group.add(innerHalo);

    const light = new THREE.PointLight(0x38bdf8, 2.2, 6.5);
    group.add(light);

    return { group, spinMesh: build.group, halo };
  }

  function createStunStars(THREE, height) {
    const g = new THREE.Group();
    g.position.y = height;
    g.visible = false;
    const mat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), mat);
      star.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
      g.add(star);
    }
    return g;
  }

  function createOrc(THREE, isBoss) {
    const root = new THREE.Group();
    const bodyRoot = new THREE.Group();
    root.add(bodyRoot);

    const flashMaterials = [];
    function regMat(mat) {
      flashMaterials.push({ mat, baseEmissive: mat.emissive.clone(), baseIntensity: mat.emissiveIntensity });
      return mat;
    }

    const skinColor = isBoss ? 0x3a4a2d : 0x557336;
    const skinMat = regMat(new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.78 }));
    const leatherMat = regMat(new THREE.MeshStandardMaterial({ color: isBoss ? 0x361b18 : 0x543824, roughness: 0.85 }));
    const ironMat = regMat(new THREE.MeshStandardMaterial({ color: isBoss ? 0x31363d : 0x58626b, metalness: 0.7, roughness: 0.36 }));
    const boneMat = regMat(new THREE.MeshStandardMaterial({ color: 0xe8dec5, roughness: 0.65 }));
    const eyeColor = isBoss ? 0xff3b1f : 0xffbe2e;
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });

    const scale = isBoss ? window.Game.Config.ENEMIES.boss.scale : window.Game.Config.ENEMIES.orc.scale;
    bodyRoot.scale.setScalar(scale);

    // Boss menacing ground aura ring
    let bossAura = null;
    let weaponGlowMat = null;
    if (isBoss) {
      bossAura = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 1.62, 36),
        new THREE.MeshBasicMaterial({
          color: 0xdc2626,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      bossAura.rotation.x = -Math.PI / 2;
      bossAura.position.y = 0.04;
      root.add(bossAura);
    }

    // Thick muscular legs
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.28, 0.74, 0);
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 0.32), leatherMat);
    lLeg.position.y = -0.36;
    lLeg.castShadow = true;
    leftLeg.add(lLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.28, 0.74, 0);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 0.32), leatherMat);
    rLeg.position.y = -0.36;
    rLeg.castShadow = true;
    rightLeg.add(rLeg);
    bodyRoot.add(leftLeg, rightLeg);

    // Broad hunched torso
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 1.24, 0.06);
    torsoGroup.rotation.x = 0.12;
    bodyRoot.add(torsoGroup);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.88, 0.62), skinMat);
    chest.castShadow = true;
    chest.receiveShadow = true;
    torsoGroup.add(chest);

    // War harness & warpaint
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.22, 0.66), leatherMat);
    strap.position.y = -0.26;
    torsoGroup.add(strap);

    if (isBoss) {
      const warPlate = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.52, 0.68), ironMat);
      warPlate.position.y = 0.1;
      torsoGroup.add(warPlate);

      const skullCenter = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), boneMat);
      skullCenter.position.set(0, 0.1, 0.37);
      torsoGroup.add(skullCenter);

      // Tattered crimson war-cape
      const cape = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 1.28, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.88 })
      );
      cape.position.set(0, -0.26, -0.38);
      cape.rotation.x = 0.16;
      cape.castShadow = true;
      torsoGroup.add(cape);
    } else {
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.92, 0.65), leatherMat);
      sash.rotation.z = 0.55;
      torsoGroup.add(sash);
    }

    // Orc Head with heavy jaw & twin tusks
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.64, 0.14);
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.5, 0.52), skinMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.38), skinMat);
    jaw.position.set(0, -0.18, 0.12);
    headGroup.add(jaw);

    // Twin tusks
    const tuskGeo = new THREE.ConeGeometry(0.055, 0.22, 5);
    const lTusk = new THREE.Mesh(tuskGeo, boneMat);
    lTusk.position.set(-0.17, -0.08, 0.31);
    lTusk.rotation.x = 0.25;
    const rTusk = new THREE.Mesh(tuskGeo, boneMat);
    rTusk.position.set(0.17, -0.08, 0.31);
    rTusk.rotation.x = 0.25;
    headGroup.add(lTusk, rTusk);

    // Glowing eyes
    const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.05), eyeMat);
    lEye.position.set(-0.13, 0.06, 0.26);
    const rEye = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.05), eyeMat);
    rEye.position.set(0.13, 0.06, 0.26);
    headGroup.add(lEye, rEye);

    if (isBoss) {
      // Horned Warlord Iron Crown/Helm
      const helmCap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.58), ironMat);
      helmCap.position.y = 0.19;
      headGroup.add(helmCap);

      const hornGeo = new THREE.ConeGeometry(0.1, 0.62, 6);
      const lHorn = new THREE.Mesh(hornGeo, boneMat);
      lHorn.position.set(-0.4, 0.42, 0.02);
      lHorn.rotation.z = 0.65;
      lHorn.rotation.x = 0.22;
      const rHorn = new THREE.Mesh(hornGeo, boneMat);
      rHorn.position.set(0.4, 0.42, 0.02);
      rHorn.rotation.z = -0.65;
      rHorn.rotation.x = 0.22;
      headGroup.add(lHorn, rHorn);
    }
    torsoGroup.add(headGroup);

    // Spiked Pauldrons
    const lPauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), ironMat);
    lPauldron.position.set(-0.62, 0.3, 0);
    torsoGroup.add(lPauldron);
    const spike1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 5), boneMat);
    spike1.position.set(-0.74, 0.52, 0);
    spike1.rotation.z = 0.55;
    torsoGroup.add(spike1);

    if (isBoss) {
      const rPauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), ironMat);
      rPauldron.position.set(0.64, 0.32, 0);
      torsoGroup.add(rPauldron);
      const spike2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 5), boneMat);
      spike2.position.set(0.78, 0.56, 0);
      spike2.rotation.z = -0.55;
      torsoGroup.add(spike2);
    }

    // Left Arm
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.64, 0.22, 0.04);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.28), skinMat);
    lArmMesh.position.y = -0.32;
    lArmMesh.castShadow = true;
    leftArm.add(lArmMesh);
    torsoGroup.add(leftArm);

    // Right Arm + Battle Axe / Boss Bloodfire Greataxe
    const rightArm = new THREE.Group();
    rightArm.position.set(0.64, 0.22, 0.04);
    const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.28), skinMat);
    rArmMesh.position.y = -0.32;
    rArmMesh.castShadow = true;
    rightArm.add(rArmMesh);

    const axeGroup = new THREE.Group();
    axeGroup.position.set(0, -0.62, 0.14);
    axeGroup.rotation.x = Math.PI * 0.42;

    const shaftLen = isBoss ? 2.15 : 1.55;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, shaftLen, 6), leatherMat);
    shaft.position.y = shaftLen * 0.35;
    axeGroup.add(shaft);

    const bladeGeo = isBoss
      ? new THREE.BoxGeometry(0.86, 0.62, 0.1)
      : new THREE.BoxGeometry(0.56, 0.46, 0.08);
    weaponGlowMat = regMat(new THREE.MeshStandardMaterial({
      color: isBoss ? 0x451a1a : 0x717d87,
      metalness: 0.78,
      roughness: 0.28,
      emissive: isBoss ? 0xd9381e : 0x000000,
      emissiveIntensity: isBoss ? 0.6 : 0,
    }));
    const axeHead = new THREE.Mesh(bladeGeo, weaponGlowMat);
    axeHead.position.set(isBoss ? 0 : 0.2, shaftLen * 0.72, 0);
    axeHead.castShadow = true;
    axeGroup.add(axeHead);

    if (isBoss) {
      // Glowing crimson edges on both sides of the twin-headed Warlord Greataxe
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff6b2b });
      const lEdge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.68, 0.12), edgeMat);
      lEdge.position.set(-0.44, shaftLen * 0.72, 0);
      const rEdge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.68, 0.12), edgeMat);
      rEdge.position.set(0.44, shaftLen * 0.72, 0);
      axeGroup.add(lEdge, rEdge);
    }

    rightArm.add(axeGroup);
    torsoGroup.add(rightArm);

    const stunStars = createStunStars(THREE, (isBoss ? 2.35 : 2.25) * scale);
    root.add(stunStars);

    return {
      root,
      bodyRoot,
      torsoGroup,
      headGroup,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      axeGroup,
      bossAura,
      weaponGlowMat,
      stunStars,
      scale,
      setHitFlash(intensity) {
        for (let i = 0; i < flashMaterials.length; i++) {
          const f = flashMaterials[i];
          if (intensity > 0.01) {
            f.mat.emissive.setHex(0xffffff);
            f.mat.emissiveIntensity = intensity * 0.85;
          } else {
            f.mat.emissive.copy(f.baseEmissive);
            f.mat.emissiveIntensity = f.baseIntensity;
          }
        }
      },
      setEnraged(enraged) {
        if (!isBoss) return;
        if (weaponGlowMat) {
          weaponGlowMat.emissive.setHex(enraged ? 0xff4500 : 0xd9381e);
          weaponGlowMat.emissiveIntensity = enraged ? 1.5 : 0.6;
        }
        if (bossAura) {
          bossAura.material.color.setHex(enraged ? 0xff5a1f : 0xdc2626);
          bossAura.material.opacity = enraged ? 0.82 : 0.55;
        }
      },
    };
  }

  return {
    createHero,
    createFlyingShield,
    createOrc,
  };
})();
