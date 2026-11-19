window.Game = window.Game || {};

window.Game.Environment = {
  build(THREE, scene) {
    const ARENA_R = window.Game.Config.ARENA_RADIUS;
    const group = new THREE.Group();
    scene.add(group);

    // Rich forest twilight-sunlit sky & exponential mist
    scene.background = new THREE.Color(0x13221b);
    scene.fog = new THREE.FogExp2(0x162920, 0.0175);

    // Lighting setup
    const hemiLight = new THREE.HemisphereLight(0x9bd6b5, 0x26351c, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffe1a8, 2.15);
    sunLight.position.set(18, 32, 14);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 85;
    const d = 28;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Subtle cool rim light from back forest to separate silhouettes
    const rimLight = new THREE.DirectionalLight(0x56a3c7, 0.65);
    rimLight.position.set(-20, 14, -22);
    scene.add(rimLight);

    // Ground plane
    const groundTex = window.Game.Textures.createForestGroundTexture(THREE);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.94,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(66, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    // Subtle glowing rune boundary stones around clearing perimeter
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x5c665f,
      roughness: 0.88,
      metalness: 0.08,
    });
    const mossStoneMat = new THREE.MeshStandardMaterial({
      color: 0x4b5c49,
      roughness: 0.9,
      metalness: 0.05,
    });
    const runeGlowMat = new THREE.MeshBasicMaterial({
      color: 0x7be6a6,
      transparent: true,
      opacity: 0.55,
    });

    const pillarCount = 12;
    for (let i = 0; i < pillarCount; i++) {
      const ang = (i / pillarCount) * Math.PI * 2 + 0.14;
      const dist = ARENA_R + 0.95;
      const px = Math.cos(ang) * dist;
      const pz = Math.sin(ang) * dist;

      const pillar = new THREE.Group();
      pillar.position.set(px, 0, pz);
      pillar.rotation.y = -ang + Math.PI / 2;

      const h = 1.6 + (i % 3) * 0.45;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, h, 0.72), i % 2 === 0 ? stoneMat : mossStoneMat);
      body.position.y = h / 2 - 0.1;
      body.rotation.z = (Math.random() - 0.5) * 0.12;
      body.castShadow = true;
      body.receiveShadow = true;
      pillar.add(body);

      // Carved glowing rune strip
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.18, h * 0.48), runeGlowMat);
      strip.position.set(0, h * 0.52, 0.37);
      pillar.add(strip);

      group.add(pillar);
    }

    // Trees (Pine & Broadleaf mix) encircling the forest glade
    const barkTex = window.Game.Textures.createBarkTexture(THREE);
    const trunkMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      roughness: 0.92,
    });

    const foliageMats = [
      new THREE.MeshStandardMaterial({ color: 0x1e4d2b, roughness: 0.86 }),
      new THREE.MeshStandardMaterial({ color: 0x265e32, roughness: 0.84 }),
      new THREE.MeshStandardMaterial({ color: 0x193f25, roughness: 0.88 }),
      new THREE.MeshStandardMaterial({ color: 0x346b2c, roughness: 0.82 }),
    ];

    const animatedCanopies = [];
    const totalTrees = 96;

    // Seeded pseudo-random for consistent handsome composition
    let seed = 4219;
    function rand() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    for (let i = 0; i < totalTrees; i++) {
      // Keep southern camera sightline slightly lower/sparser so hero is never blocked
      const angle = rand() * Math.PI * 2;
      const isSouthCamLane = Math.sin(angle) > 0.52 && Math.abs(Math.cos(angle)) < 0.65;
      const minR = isSouthCamLane ? ARENA_R + 7.2 : ARENA_R + 0.95;
      const ringBand = i < 42 ? minR + rand() * 4.4 : minR + 3.8 + rand() * 22.0;
      const tx = Math.cos(angle) * ringBand;
      const tz = Math.sin(angle) * ringBand;

      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const scale = (isSouthCamLane ? 0.72 : 0.85) + rand() * 0.75;
      tree.scale.setScalar(scale);

      const isPine = rand() < 0.68;
      const trunkH = isPine ? 3.8 + rand() * 1.8 : 3.2 + rand() * 1.5;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.44, trunkH, 7),
        trunkMat
      );
      trunk.position.y = trunkH * 0.5;
      trunk.castShadow = ringBand < 34;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const canopy = new THREE.Group();
      canopy.position.y = trunkH * 0.65;

      const fMat = foliageMats[Math.floor(rand() * foliageMats.length)];
      if (isPine) {
        const tiers = 3;
        for (let t = 0; t < tiers; t++) {
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(2.35 - t * 0.52, 3.1 - t * 0.35, 7),
            fMat
          );
          cone.position.y = t * 1.55 + 1.0;
          cone.rotation.y = rand() * Math.PI;
          cone.castShadow = ringBand < 32 && t < 2;
          cone.receiveShadow = true;
          canopy.add(cone);
        }
      } else {
        // Broadleaf layered dodecahedrons
        const blobs = 3 + Math.floor(rand() * 2);
        for (let b = 0; b < blobs; b++) {
          const blob = new THREE.Mesh(
            new THREE.DodecahedronGeometry(1.55 + rand() * 0.65, 0),
            fMat
          );
          blob.position.set(
            (rand() - 0.5) * 1.6,
            1.4 + rand() * 1.5,
            (rand() - 0.5) * 1.6
          );
          blob.scale.y = 0.78 + rand() * 0.25;
          blob.castShadow = ringBand < 32;
          canopy.add(blob);
        }
      }

      tree.add(canopy);
      tree.rotation.z = (rand() - 0.5) * 0.05;
      group.add(tree);

      animatedCanopies.push({
        mesh: canopy,
        phase: rand() * Math.PI * 2,
        speed: 0.9 + rand() * 0.7,
        amp: 0.018 + rand() * 0.015,
      });
    }

    // Mossy boulders & fallen logs along glade border
    const boulderGeo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = ARENA_R + 1.4 + rand() * 9;
      const b = new THREE.Mesh(boulderGeo, i % 2 ? stoneMat : mossStoneMat);
      const sx = 0.8 + rand() * 1.6;
      const sy = 0.5 + rand() * 0.95;
      const sz = 0.8 + rand() * 1.5;
      b.scale.set(sx, sy, sz);
      b.position.set(Math.cos(a) * r, sy * 0.42, Math.sin(a) * r);
      b.rotation.set(rand() * 2, rand() * 3, rand() * 2);
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
    }

    // Fallen logs
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      const r = ARENA_R + 2.2 + rand() * 3.5;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 4.2, 8), trunkMat);
      log.position.set(Math.cos(a) * r, 0.28, Math.sin(a) * r);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = rand() * Math.PI;
      log.castShadow = true;
      log.receiveShadow = true;
      group.add(log);
    }

    // Decorative grass tufts & glowing mushrooms near glade border (non-blocking)
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x3b6e2f,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const grassBladeGeo = new THREE.ConeGeometry(0.11, 0.58, 3);
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2;
      const r = 10 + rand() * 14;
      const tuft = new THREE.Group();
      tuft.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      for (let k = 0; k < 3; k++) {
        const blade = new THREE.Mesh(grassBladeGeo, grassMat);
        blade.position.set((rand() - 0.5) * 0.3, 0.25, (rand() - 0.5) * 0.3);
        blade.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.35);
        tuft.add(blade);
      }
      group.add(tuft);
    }

    // Glowing cyan-emerald forest mushrooms near boundary stones
    const mushStemMat = new THREE.MeshStandardMaterial({ color: 0xe6dec5, roughness: 0.8 });
    const mushCapMat = new THREE.MeshStandardMaterial({
      color: 0x4de6a8,
      emissive: 0x199968,
      emissiveIntensity: 0.75,
      roughness: 0.4,
    });
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const r = ARENA_R - 0.8 + rand() * 3.5;
      const cluster = new THREE.Group();
      cluster.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      for (let m = 0; m < 3; m++) {
        const s = 0.55 + rand() * 0.6;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.08 * s, 0.28 * s, 6), mushStemMat);
        stem.position.set((rand() - 0.5) * 0.4, 0.14 * s, (rand() - 0.5) * 0.4);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mushCapMat);
        cap.position.set(stem.position.x, 0.26 * s, stem.position.z);
        cluster.add(stem, cap);
      }
      group.add(cluster);
    }

    // Decorative fern clusters & mossy stumps inside glade perimeter (non-blocking visual richness)
    const fernMat = new THREE.MeshStandardMaterial({
      color: 0x3f8034,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const fernLeafGeo = new THREE.ConeGeometry(0.24, 1.05, 3);
    for (let i = 0; i < 36; i++) {
      const a = rand() * Math.PI * 2;
      const r = 11.5 + rand() * (ARENA_R - 10.0);
      const fern = new THREE.Group();
      fern.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const leaves = 5;
      for (let k = 0; k < leaves; k++) {
        const la = (k / leaves) * Math.PI * 2 + rand() * 0.3;
        const leaf = new THREE.Mesh(fernLeafGeo, fernMat);
        leaf.position.set(Math.cos(la) * 0.32, 0.24, Math.sin(la) * 0.32);
        leaf.rotation.z = -Math.cos(la) * 0.85;
        leaf.rotation.x = Math.sin(la) * 0.85;
        fern.add(leaf);
      }
      group.add(fern);
    }

    // Soft golden sunbeam shafts slanting through the ancient canopy
    const sunShaftMat = new THREE.MeshBasicMaterial({
      color: 0xffe8a3,
      transparent: true,
      opacity: 0.048,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shaftPositions = [
      [-6.5, -5.5, 2.2],
      [7.5, -6.0, 2.6],
      [0.5, -1.5, 3.0],
      [-9.0, 4.5, 2.0],
    ];
    for (const [sx, sz, sr] of shaftPositions) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(sr * 0.45, sr, 24, 12, 1, true), sunShaftMat);
      shaft.position.set(sx + 3.5, 11.0, sz + 2.0);
      shaft.rotation.z = -0.32;
      shaft.rotation.x = 0.16;
      group.add(shaft);
    }

    // Atmospheric sunlit pollen / firefly particles floating in the glade
    const fireflyCount = 80;
    const ffGeo = new THREE.BufferGeometry();
    const ffPos = new Float32Array(fireflyCount * 3);
    const ffMeta = [];
    for (let i = 0; i < fireflyCount; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * (ARENA_R + 6);
      const y = 0.6 + rand() * 5.2;
      ffPos[i * 3] = Math.cos(a) * r;
      ffPos[i * 3 + 1] = y;
      ffPos[i * 3 + 2] = Math.sin(a) * r;
      ffMeta.push({
        baseX: ffPos[i * 3],
        baseY: y,
        baseZ: ffPos[i * 3 + 2],
        phase: rand() * Math.PI * 2,
        speed: 0.5 + rand() * 0.9,
      });
    }
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const glowTex = window.Game.Textures.createGlowSpriteTexture(THREE);
    const ffMat = new THREE.PointsMaterial({
      size: 0.42,
      map: glowTex,
      color: 0xd9ff94,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const fireflies = new THREE.Points(ffGeo, ffMat);
    group.add(fireflies);

    // Subtle ground aim reticle
    const reticle = new THREE.Group();
    const reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.36, 0.48, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf5c362,
        transparent: true,
        opacity: 0.68,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    reticleRing.rotation.x = -Math.PI / 2;
    reticleRing.position.y = 0.05;
    const reticleDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 14),
      new THREE.MeshBasicMaterial({
        color: 0xfff3c4,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    reticleDot.rotation.x = -Math.PI / 2;
    reticleDot.position.y = 0.055;
    reticle.add(reticleRing, reticleDot);
    scene.add(reticle);

    return {
      group,
      reticle,
      glowTex,
      update(time) {
        for (let i = 0; i < animatedCanopies.length; i++) {
          const item = animatedCanopies[i];
          item.mesh.rotation.z = Math.sin(time * item.speed + item.phase) * item.amp;
          item.mesh.rotation.x = Math.cos(time * item.speed * 0.7 + item.phase) * item.amp * 0.7;
        }
        const posAttr = fireflies.geometry.attributes.position;
        for (let i = 0; i < ffMeta.length; i++) {
          const m = ffMeta[i];
          posAttr.setXYZ(
            i,
            m.baseX + Math.sin(time * m.speed + m.phase) * 0.65,
            m.baseY + Math.sin(time * m.speed * 1.3 + m.phase) * 0.45,
            m.baseZ + Math.cos(time * m.speed * 0.9 + m.phase) * 0.65
          );
        }
        posAttr.needsUpdate = true;
        reticleRing.rotation.z = time * 1.6;
      },
    };
  },
};
