window.Game = window.Game || {};

window.Game.Combat = function (THREE, scene, vfx, ui) {
  const CFG = window.Game.Config;
  const Audio = window.Game.Audio;
  const Models = window.Game.Models;

  const state = {
    hero: null,
    enemies: [],
    shieldProjectile: null,
    whirlwindVortex: null,
    hitstopTimer: 0,
    shakeIntensity: 0,
    elapsed: 0,
    stats: {
      kills: 0,
      damageDealt: 0,
      pipsEarned: 0,
      perfectBlocks: 0,
      skillsUsed: 0,
    },
    onEnemyKilled: null,
    onHeroDied: null,
    onBossEnraged: null,
  };

  function clampToArena(pos, entityRadius) {
    const maxR = CFG.ARENA_RADIUS - entityRadius;
    const dSq = pos.x * pos.x + pos.z * pos.z;
    if (dSq > maxR * maxR) {
      const d = Math.sqrt(dSq);
      pos.x = (pos.x / d) * maxR;
      pos.z = (pos.z / d) * maxR;
    }
  }

  function angleDiff(a, b) {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  function triggerShake(amount) {
    state.shakeIntensity = Math.max(state.shakeIntensity, amount);
  }

  function triggerHitstop(duration) {
    state.hitstopTimer = Math.max(state.hitstopTimer, duration);
  }

  function initHero() {
    if (state.hero) {
      scene.remove(state.hero.model.root);
    }
    if (state.whirlwindVortex) {
      scene.remove(state.whirlwindVortex.group);
    }
    clearShieldProjectile();

    const model = Models.createHero(THREE);
    scene.add(model.root);
    state.whirlwindVortex = vfx.createWhirlwindVortex(CFG.SKILLS[3].radius);

    state.hero = {
      model,
      pos: new THREE.Vector3(0, 0, 5.5),
      vel: new THREE.Vector3(),
      knockVel: new THREE.Vector3(),
      yaw: Math.PI, // Facing north into clearing
      hp: CFG.HERO.MAX_HP,
      maxHp: CFG.HERO.MAX_HP,
      dead: false,

      // Core Rage -> Rage Pip mechanic
      rage: 0,
      ragePips: 0,
      timeSinceCombat: 0,

      // Action states: 'idle' | 'attack' | 'dodge' | 'skill1' | 'skill3'
      action: 'idle',
      actionTimer: 0,
      actionDuration: 0,

      // 3-hit melee combo
      comboIndex: 0,
      comboWindowTimer: 0,
      attackHitDone: false,
      queuedAttack: false,
      attackYaw: Math.PI,

      // Defense
      isBlocking: false,
      blockHeldTime: 0,
      invulnTimer: 0,
      dodgeCooldown: 0,
      dodgeDir: new THREE.Vector3(0, 0, -1),

      // Skill 1 (Shield Bash Dash) & Empowered Blade buff
      skill1Dir: new THREE.Vector3(0, 0, -1),
      skill1HitSet: new Set(),
      skill1EndedBurst: false,
      empoweredHits: 0,
      empoweredTimer: 0,

      // Skill 3 (Whirlwind)
      whirlwindTickTimer: 0,
      whirlwindSpinAngle: 0,

      // Cooldowns
      skillCooldowns: { 1: 0, 2: 0, 3: 0 },

      // Anim clock
      walkCycle: 0,
      hitFlashTimer: 0,
    };

    model.root.position.copy(state.hero.pos);
    model.root.rotation.y = state.hero.yaw;
  }

  function clearEnemies() {
    for (const e of state.enemies) {
      if (e.telegraph) e.telegraph.destroy();
      scene.remove(e.model.root);
    }
    state.enemies = [];
    ui.clearEnemyBars();
  }

  function clearShieldProjectile() {
    if (state.shieldProjectile) {
      scene.remove(state.shieldProjectile.visual.group);
      state.shieldProjectile = null;
    }
    if (state.hero) {
      state.hero.model.shieldHolder.visible = true;
    }
  }

  function resetAll() {
    vfx.clear();
    clearEnemies();
    initHero();
    state.hitstopTimer = 0;
    state.shakeIntensity = 0;
    state.stats = {
      kills: 0,
      damageDealt: 0,
      pipsEarned: 0,
      perfectBlocks: 0,
      skillsUsed: 0,
    };
  }

  // ---- Core Rage -> Rage Pip Engine ----
  function addRage(amount, worldPos) {
    const h = state.hero;
    if (!h || h.dead || amount <= 0) return;
    h.timeSinceCombat = 0;

    // Already at max 3 Pips: cap cleanly so a 4th pip is never banked
    if (h.ragePips >= CFG.HERO.MAX_PIPS) {
      h.rage = 0;
      return;
    }

    h.rage += amount;
    let gainedPip = false;
    while (h.rage >= CFG.HERO.MAX_RAGE && h.ragePips < CFG.HERO.MAX_PIPS) {
      h.rage -= CFG.HERO.MAX_RAGE;
      h.ragePips += 1;
      state.stats.pipsEarned += 1;
      gainedPip = true;

      // Celebration VFX & SFX for Rage Pip Ignition!
      Audio.ragePip(h.ragePips);
      vfx.spawnShockwave(h.pos, 0.5, 3.4, 0xffae34, 0.42, 0.14);
      vfx.spawnSparks(new THREE.Vector3(h.pos.x, 1.35, h.pos.z), 14, 0xffc845, 3.5, 8.5, 0.5, 1.2);
      ui.triggerPipIgnite(h.ragePips);
      ui.spawnFloatText(
        new THREE.Vector3(h.pos.x, 2.7, h.pos.z),
        h.ragePips === CFG.HERO.MAX_PIPS ? '怒气点全满 (3/3)!' : `+1 怒气点 (${h.ragePips}/3)`,
        'pip'
      );
      if (h.ragePips >= CFG.HERO.MAX_PIPS) {
        h.rage = 0;
      }
    }

    if (!gainedPip && worldPos) {
      ui.flashRageBar();
    }
  }

  function healHero(amount) {
    const h = state.hero;
    if (!h || h.dead || amount <= 0) return;
    const actual = Math.min(h.maxHp - h.hp, Math.round(amount));
    if (actual <= 0) return;
    h.hp += actual;
    ui.spawnFloatText(new THREE.Vector3(h.pos.x, 2.3, h.pos.z), `+${actual}`, 'heal');
  }

  // ---- Enemy Spawning ----
  function spawnEnemy(type, x, z) {
    const isBoss = type === 'boss';
    const spec = isBoss ? CFG.ENEMIES.boss : CFG.ENEMIES.orc;
    const model = Models.createOrc(THREE, isBoss);
    model.root.position.set(x, 0, z);
    scene.add(model.root);

    const enemy = {
      id: Math.random().toString(36).slice(2, 9),
      type,
      isBoss,
      name: spec.name,
      spec,
      model,
      pos: new THREE.Vector3(x, 0, z),
      knockVel: new THREE.Vector3(),
      yaw: Math.atan2(state.hero.pos.x - x, state.hero.pos.z - z),
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      radius: spec.radius,
      dead: false,
      deathTimer: 0,

      // AI State: 'chase' | 'strafe' | 'windup' | 'charging' | 'recover' | 'stunned'
      aiState: 'chase',
      stateTimer: 0,
      attackCooldown: isBoss ? 1.1 : 0.65 + Math.random() * 0.7,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeTimer: 0,

      // Current attack info
      currentMove: null,
      moveTargetPos: new THREE.Vector3(),
      chargeDir: new THREE.Vector3(),
      chargeHitHero: false,
      telegraph: null,
      closeTimer: 0, // tracks how long hero stayed close to Boss -> triggers Earthshatter Slam!

      // Boss Phase 2
      enraged: false,
      summonedAddWave: false,

      // Status effects
      stunTimer: 0,
      slowTimer: 0,
      slowFactor: 1.0,
      hitFlashTimer: 0,
      walkCycle: Math.random() * Math.PI * 2,
      attackAnimTimer: 0,
    };

    // Spawn ring burst
    vfx.spawnShockwave(enemy.pos, 0.3, isBoss ? 4.5 : 2.2, isBoss ? 0xef4444 : 0x65a30d, 0.45);
    if (isBoss) {
      Audio.bossRoar();
      triggerShake(0.45);
    }

    state.enemies.push(enemy);
    return enemy;
  }

  function damageEnemy(enemy, rawDamage, opts = {}) {
    if (!enemy || enemy.dead) return;
    const dmg = Math.round(rawDamage);
    enemy.hp = Math.max(0, enemy.hp - dmg);
    state.stats.damageDealt += dmg;
    enemy.hitFlashTimer = 0.11;

    // Knockback
    if (opts.knockDir && opts.knockback) {
      const resist = enemy.isBoss ? 0.25 : 1.0;
      enemy.knockVel.addScaledVector(opts.knockDir, opts.knockback * resist);
    }

    // Stun / interrupt
    if (opts.stun && opts.stun > 0) {
      const dur = enemy.isBoss ? opts.stun * 0.55 : opts.stun;
      // Interrupt non-charging attacks
      if (!enemy.isBoss || enemy.aiState !== 'charging') {
        const wasWindingUp = enemy.aiState === 'windup';
        if (enemy.telegraph) {
          enemy.telegraph.destroy();
          enemy.telegraph = null;
        }
        enemy.aiState = 'stunned';
        enemy.stunTimer = Math.max(enemy.stunTimer, dur);
        if (enemy.isBoss) {
          ui.setBossAction(wasWindingUp ? '★ 蓄力被打断 · 眩晕!' : '★ 统领眩晕');
        }
        ui.spawnFloatText(
          new THREE.Vector3(enemy.pos.x, (enemy.isBoss ? 3.8 : 2.5), enemy.pos.z),
          wasWindingUp ? '打断眩晕!' : '眩晕!',
          'stun'
        );
      }
    }

    // Slow (from Chain Shield Throw)
    if (opts.slowDuration) {
      enemy.slowTimer = Math.max(enemy.slowTimer, opts.slowDuration);
      enemy.slowFactor = opts.slowFactor || 0.7;
    }

    // Hit sparks & floating damage number
    const hitY = enemy.isBoss ? 1.85 : 1.25;
    const hitPos = new THREE.Vector3(
      enemy.pos.x + (Math.random() - 0.5) * 0.45,
      hitY,
      enemy.pos.z + (Math.random() - 0.5) * 0.45
    );
    vfx.spawnSparks(hitPos, opts.sparkCount || 7, opts.sparkColor || 0xffe08a, 3, 8, 0.35, opts.heavy ? 1.2 : 0.9);
    ui.spawnFloatText(
      new THREE.Vector3(enemy.pos.x, enemy.isBoss ? 3.5 : 2.25, enemy.pos.z),
      `-${dmg}`,
      opts.textStyle || (opts.heavy ? 'heavy' : 'normal')
    );

    // Boss Phase 2 Enrage at 50% HP!
    if (enemy.isBoss && !enemy.enraged && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.5) {
      enemy.enraged = true;
      enemy.model.setEnraged(true);
      Audio.bossRoar();
      triggerShake(0.55);
      vfx.spawnShockwave(enemy.pos, 0.8, 7.2, 0xff4500, 0.55, 0.14);
      vfx.spawnSparks(new THREE.Vector3(enemy.pos.x, 1.8, enemy.pos.z), 26, 0xff5a1f, 5, 13, 0.6, 1.5);
      ui.showCenterBanner('半兽统领进入狂暴！', '第二阶段 · 血斧觉醒', 2.4);
      if (!enemy.summonedAddWave) {
        enemy.summonedAddWave = true;
        // Summon 2 Orc Warriors on opposite flanks so multi-target skills shine!
        for (let k = 0; k < 2; k++) {
          const ang = Math.atan2(enemy.pos.z, enemy.pos.x) + (k === 0 ? 1.4 : -1.4);
          const sx = Math.cos(ang) * 12.0;
          const sz = Math.sin(ang) * 12.0;
          spawnEnemy('orc', sx, sz);
        }
      }
      if (state.onBossEnraged) state.onBossEnraged(enemy);
    }

    // Death check
    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.deathTimer = 0;
      if (enemy.telegraph) {
        enemy.telegraph.destroy();
        enemy.telegraph = null;
      }
      enemy.model.stunStars.visible = false;
      Audio.enemyDeath(enemy.isBoss);
      vfx.spawnSparks(new THREE.Vector3(enemy.pos.x, 1.2, enemy.pos.z), enemy.isBoss ? 30 : 14, enemy.isBoss ? 0xff6b2b : 0x84cc16, 3, 10, 0.6, 1.3);
      if (enemy.isBoss) {
        triggerHitstop(0.09);
        triggerShake(0.65);
        vfx.spawnShockwave(enemy.pos, 0.6, 8.5, 0xf59e0b, 0.65);
      }
      state.stats.kills += 1;
      healHero(enemy.spec.killHeal);
      if (state.onEnemyKilled) state.onEnemyKilled(enemy);
    }
  }

  // ---- Hero Damage, Shield Block & Perfect Block ----
  function damageHero(rawAmount, attacker, knockback = 5.0) {
    const h = state.hero;
    if (!h || h.dead) return;
    if (h.invulnTimer > 0) return;
    if (h.action === 'skill1') return; // Shield bash frontal charge protection

    // Check Shield Block (only works if shield is in hand & facing attacker)
    const shieldInHand = !state.shieldProjectile;
    if (h.isBlocking && shieldInHand && attacker) {
      const toAttacker = Math.atan2(attacker.pos.x - h.pos.x, attacker.pos.z - h.pos.z);
      const facingDelta = Math.abs(angleDiff(h.yaw, toAttacker));
      if (facingDelta <= Math.PI * 0.52) {
        const isPerfect = h.blockHeldTime <= CFG.HERO.PERFECT_BLOCK_WINDOW;
        if (isPerfect) {
          // PERFECT BLOCK (PARRY)!
          state.stats.perfectBlocks += 1;
          Audio.block(true);
          triggerHitstop(0.065);
          triggerShake(0.28);
          vfx.spawnShockwave(h.pos, 0.4, 3.6, 0x38bdf8, 0.35, 0.14);
          vfx.spawnSparks(new THREE.Vector3(h.pos.x, 1.35, h.pos.z), 18, 0xfef08a, 4, 11, 0.45, 1.25);
          ui.spawnFloatText(
            new THREE.Vector3(h.pos.x, 2.55, h.pos.z),
            `精准格挡! +${CFG.HERO.PERFECT_BLOCK_RAGE}怒气`,
            'parry'
          );
          addRage(CFG.HERO.PERFECT_BLOCK_RAGE, h.pos);
          healHero(CFG.HERO.PERFECT_BLOCK_HEAL);
          // Stagger attacker slightly
          if (!attacker.dead && attacker.aiState !== 'charging') {
            attacker.aiState = 'stunned';
            attacker.stunTimer = attacker.isBoss ? 0.55 : 1.0;
            const push = new THREE.Vector3().subVectors(attacker.pos, h.pos).setY(0).normalize();
            attacker.knockVel.addScaledVector(push, attacker.isBoss ? 2.5 : 7.5);
          }
          return;
        } else {
          // Normal Block: 75% damage reduction + small rage gain!
          const reduced = Math.max(1, Math.round(rawAmount * CFG.HERO.BLOCK_DAMAGE_MULT));
          h.hp = Math.max(0, h.hp - reduced);
          Audio.block(false);
          triggerShake(0.16);
          vfx.spawnSparks(new THREE.Vector3(h.pos.x, 1.3, h.pos.z), 8, 0x7dd3fc, 2.5, 6.5, 0.3);
          ui.spawnFloatText(new THREE.Vector3(h.pos.x, 2.3, h.pos.z), `格挡 -${reduced}`, 'skill');
          addRage(CFG.HERO.NORMAL_BLOCK_RAGE, h.pos);
          const push = new THREE.Vector3().subVectors(h.pos, attacker.pos).setY(0).normalize();
          h.knockVel.addScaledVector(push, knockback * 0.45);
          if (h.hp <= 0) handleHeroDeath();
          return;
        }
      }
    }

    // Whirlwind super armor: 50% damage reduction & no knockback
    let finalDmg = rawAmount;
    if (h.action === 'skill3') {
      finalDmg = Math.max(1, Math.round(rawAmount * CFG.SKILLS[3].damageTakenMult));
      knockback = 0;
    }

    h.hp = Math.max(0, h.hp - Math.round(finalDmg));
    h.hitFlashTimer = 0.2;
    Audio.enemyHitPlayer();
    triggerShake(0.32);
    ui.flashScreenHit();
    ui.spawnFloatText(new THREE.Vector3(h.pos.x, 2.3, h.pos.z), `-${Math.round(finalDmg)}`, 'player-hit');

    if (attacker && knockback > 0) {
      const push = new THREE.Vector3().subVectors(h.pos, attacker.pos).setY(0).normalize();
      h.knockVel.addScaledVector(push, knockback);
    }

    if (h.hp <= 0) {
      handleHeroDeath();
    }
  }

  function handleHeroDeath() {
    const h = state.hero;
    if (h.dead) return;
    h.dead = true;
    h.action = 'idle';
    h.isBlocking = false;
    Audio.enemyDeath(true);
    if (state.onHeroDied) state.onHeroDied();
  }

  // ---- Hero Combat Inputs ----
  function getAimYaw(aimPoint, softAssistRange = 4.2) {
    const h = state.hero;
    let aimYaw = Math.atan2(aimPoint.x - h.pos.x, aimPoint.z - h.pos.z);

    // Gentle soft-lock onto close enemy near aim cone for silky melee feel
    let bestEnemy = null;
    let bestScore = Infinity;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - h.pos.x;
      const dz = e.pos.z - h.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > softAssistRange + e.radius) continue;
      const ang = Math.atan2(dx, dz);
      const diff = Math.abs(angleDiff(aimYaw, ang));
      if (diff < 0.55 && dist + diff * 3.0 < bestScore) {
        bestScore = dist + diff * 3.0;
        bestEnemy = e;
      }
    }
    if (bestEnemy) {
      aimYaw = Math.atan2(bestEnemy.pos.x - h.pos.x, bestEnemy.pos.z - h.pos.z);
    }
    return aimYaw;
  }

  function tryAttack(aimPoint) {
    const h = state.hero;
    if (!h || h.dead) return;
    if (h.action === 'dodge' || h.action === 'skill1' || h.action === 'skill3') return;

    if (h.action === 'attack') {
      if (h.actionTimer >= h.actionDuration * 0.48) {
        h.queuedAttack = true;
      }
      return;
    }

    startComboAttack(aimPoint);
  }

  function startComboAttack(aimPoint) {
    const h = state.hero;
    h.isBlocking = false;
    if (h.comboWindowTimer <= 0) {
      h.comboIndex = 0;
    }
    const step = CFG.HERO.COMBO[h.comboIndex];
    const speedMult = h.empoweredHits > 0 ? 1.2 : 1.0;

    h.action = 'attack';
    h.actionTimer = 0;
    h.actionDuration = step.duration / speedMult;
    h.attackHitDone = false;
    h.queuedAttack = false;
    h.attackYaw = getAimYaw(aimPoint, step.range + 1.0);
    h.yaw = h.attackYaw;

    // Snappy combat step lunge forward
    h.knockVel.x += Math.sin(h.attackYaw) * step.lunge;
    h.knockVel.z += Math.cos(h.attackYaw) * step.lunge;

    Audio.slash(h.comboIndex);
  }

  function executeMeleeHit() {
    const h = state.hero;
    const step = CFG.HERO.COMBO[h.comboIndex];
    const isHeavy = h.comboIndex === 2;
    const isEmpowered = h.empoweredHits > 0;

    vfx.spawnSlashArc(
      h.pos,
      h.attackYaw,
      step.range,
      step.arc,
      isEmpowered ? 0xffc83d : step.slashColor,
      h.comboIndex === 1,
      isHeavy ? 0.27 : 0.2
    );

    let hitCount = 0;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - h.pos.x;
      const dz = e.pos.z - h.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > step.range + e.radius) continue;

      const ang = Math.atan2(dx, dz);
      const diff = Math.abs(angleDiff(h.attackYaw, ang));
      if (diff <= step.arc * 0.56 || dist < e.radius + 0.95) {
        hitCount++;
        const knockDir = new THREE.Vector3(dx, 0, dz).normalize();
        damageEnemy(e, step.damage * (isEmpowered ? 1.15 : 1.0), {
          knockDir,
          knockback: step.knockback,
          heavy: isHeavy,
          sparkColor: isEmpowered ? 0xffd166 : step.slashColor,
          sparkCount: isHeavy ? 12 : 7,
        });
      }
    }

    if (hitCount > 0) {
      Audio.hit(isHeavy);
      triggerHitstop(step.hitstop);
      triggerShake(isHeavy ? 0.2 : 0.08);

      // Core melee Rage build!
      let rageGain = step.rage + (hitCount - 1) * step.extraTargetRage;
      if (isEmpowered) {
        rageGain *= CFG.SKILLS[1].empoweredRageMult;
        h.empoweredHits = Math.max(0, h.empoweredHits - 1);
      }
      addRage(rageGain, h.pos);
    }
  }

  function tryDodge(moveDir, aimPoint) {
    const h = state.hero;
    if (!h || h.dead) return;
    if (h.dodgeCooldown > 0) return;
    if (h.action === 'dodge' || h.action === 'skill1' || h.action === 'skill3') return;

    h.action = 'dodge';
    h.actionTimer = 0;
    h.actionDuration = CFG.HERO.DODGE_DURATION;
    h.invulnTimer = CFG.HERO.DODGE_IFRAMES;
    h.dodgeCooldown = CFG.HERO.DODGE_COOLDOWN;
    h.isBlocking = false;
    h.queuedAttack = false;

    if (moveDir.lengthSq() > 0.01) {
      h.dodgeDir.copy(moveDir).normalize();
    } else {
      h.dodgeDir.set(aimPoint.x - h.pos.x, 0, aimPoint.z - h.pos.z);
      if (h.dodgeDir.lengthSq() < 0.01) {
        h.dodgeDir.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
      } else {
        h.dodgeDir.normalize();
      }
    }
    h.yaw = Math.atan2(h.dodgeDir.x, h.dodgeDir.z);

    Audio.dodge();
    vfx.spawnSparks(new THREE.Vector3(h.pos.x, 0.35, h.pos.z), 8, 0xb8c7a3, 2, 5.5, 0.32, 0.8);
  }

  function setBlocking(active) {
    const h = state.hero;
    if (!h || h.dead) return;
    if (active && !state.shieldProjectile && h.action === 'idle') {
      if (!h.isBlocking) {
        h.isBlocking = true;
        h.blockHeldTime = 0;
      }
    } else {
      h.isBlocking = false;
    }
  }

  // ---- 3 Rage-Pip Skills ----
  function tryCastSkill(skillId, aimPoint) {
    const h = state.hero;
    if (!h || h.dead) return false;
    const spec = CFG.SKILLS[skillId];
    if (!spec) return false;

    if (h.skillCooldowns[skillId] > 0) {
      Audio.noRage();
      return false;
    }
    if (h.ragePips < spec.cost) {
      Audio.noRage();
      ui.spawnFloatText(new THREE.Vector3(h.pos.x, 2.5, h.pos.z), `需要 ${spec.cost} 怒气点`, 'stun');
      return false;
    }
    if (h.action === 'skill1' || h.action === 'skill3' || h.action === 'dodge') return false;

    // Skills 1 & 2 require shield in hand
    if ((skillId === 1 || skillId === 2) && state.shieldProjectile) {
      Audio.noRage();
      ui.spawnFloatText(new THREE.Vector3(h.pos.x, 2.5, h.pos.z), '盾牌正在飞行中', 'skill');
      return false;
    }

    // Consume Rage Pips!
    h.ragePips -= spec.cost;
    h.skillCooldowns[skillId] = spec.cooldown;
    h.isBlocking = false;
    h.queuedAttack = false;
    state.stats.skillsUsed += 1;
    ui.flashSkillSlot(skillId);

    if (skillId === 1) {
      castSkill1ShieldBash(aimPoint);
    } else if (skillId === 2) {
      castSkill2ChainShieldThrow(aimPoint);
    } else if (skillId === 3) {
      castSkill3Whirlwind();
    }
    return true;
  }

  // Skill 1 (1 Pip): Shield Bash Dash — Gap closer + Stun Interrupt + Empowered Rage gain
  function castSkill1ShieldBash(aimPoint) {
    const h = state.hero;
    const spec = CFG.SKILLS[1];
    const dir = new THREE.Vector3(aimPoint.x - h.pos.x, 0, aimPoint.z - h.pos.z);
    if (dir.lengthSq() < 0.01) {
      dir.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
    } else {
      dir.normalize();
    }

    h.action = 'skill1';
    h.actionTimer = 0;
    h.actionDuration = spec.dashDuration;
    h.skill1Dir.copy(dir);
    h.skill1HitSet.clear();
    h.skill1EndedBurst = false;
    h.yaw = Math.atan2(dir.x, dir.z);

    // Grant Empowered Blade buff immediately for fast follow-up melee rage harvesting!
    h.empoweredHits = spec.empoweredHits;
    h.empoweredTimer = spec.empoweredDuration;

    Audio.shieldBash();
    triggerShake(0.2);
    vfx.spawnShockwave(h.pos, 0.35, 2.3, 0xfbbf24, 0.3, 0.15);
    vfx.spawnSparks(new THREE.Vector3(h.pos.x, 1.1, h.pos.z), 12, 0xfde047, 3, 9, 0.35, 1.1);
  }

  // Skill 2 (2 Pips): Ricochet Chain-Lightning Shield Throw (up to 2 enemies + boomerang return!)
  function castSkill2ChainShieldThrow(aimPoint) {
    const h = state.hero;
    const spec = CFG.SKILLS[2];
    const aimDir = new THREE.Vector3(aimPoint.x - h.pos.x, 0, aimPoint.z - h.pos.z);
    if (aimDir.lengthSq() < 0.01) {
      aimDir.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
    } else {
      aimDir.normalize();
    }
    const aimYaw = Math.atan2(aimDir.x, aimDir.z);
    h.yaw = aimYaw;

    // Pick Target 1: prefer enemy inside aim cone within searchRange, fallback to closest living enemy
    let target1 = null;
    let bestConeScore = Infinity;
    let fallbackClosest = null;
    let fallbackDist = Infinity;

    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - h.pos.x;
      const dz = e.pos.z - h.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > spec.searchRange) continue;

      if (dist < fallbackDist) {
        fallbackDist = dist;
        fallbackClosest = e;
      }

      const ang = Math.atan2(dx, dz);
      const diff = Math.abs(angleDiff(aimYaw, ang));
      if (diff <= 0.95) {
        const score = diff * 12.0 + dist;
        if (score < bestConeScore) {
          bestConeScore = score;
          target1 = e;
        }
      }
    }
    if (!target1) target1 = fallbackClosest;

    if (target1) {
      h.yaw = Math.atan2(target1.pos.x - h.pos.x, target1.pos.z - h.pos.z);
    }

    // Detach shield from hero's left arm & launch spinning 3D shield projectile!
    h.model.shieldHolder.visible = false;
    const visual = Models.createFlyingShield(THREE);
    const startPos = new THREE.Vector3(
      h.pos.x + Math.sin(h.yaw) * 0.85,
      1.25,
      h.pos.z + Math.cos(h.yaw) * 0.85
    );
    visual.group.position.copy(startPos);
    scene.add(visual.group);

    state.shieldProjectile = {
      visual,
      pos: startPos,
      dir: aimDir.clone(),
      phase: target1 ? 'OUT_TO_FIRST' : 'FREE_OUT',
      target: target1,
      hitIds: new Set(),
      returnHitIds: new Set(),
      hitsDone: 0,
      freeDistance: 0,
      reboundTimer: 0,
      reboundDir: new THREE.Vector3(),
      trailTimer: 0,
      age: 0,
    };

    Audio.shieldThrow();
    vfx.spawnShockwave(h.pos, 0.3, 2.0, 0x38bdf8, 0.25, 0.8);
    if (target1) {
      vfx.spawnLightningArc(
        startPos,
        new THREE.Vector3(target1.pos.x, target1.isBoss ? 1.8 : 1.25, target1.pos.z),
        0x38bdf8,
        0.18
      );
    }
  }

  function findNextChainTarget(fromPos, excludeSet) {
    const maxR = CFG.SKILLS[2].bounceRange;
    let best = null;
    let bestDist = Infinity;
    for (const e of state.enemies) {
      if (e.dead || excludeSet.has(e.id)) continue;
      const dist = Math.hypot(e.pos.x - fromPos.x, e.pos.z - fromPos.z);
      if (dist <= maxR && dist < bestDist) {
        bestDist = dist;
        best = e;
      }
    }
    return best;
  }

  function updateShieldProjectile(dt) {
    const sp = state.shieldProjectile;
    const h = state.hero;
    if (!sp || !h) return;

    const spec = CFG.SKILLS[2];
    sp.age += dt;
    sp.visual.spinMesh.rotation.z += dt * 26.0;
    sp.visual.halo.rotation.z -= dt * 14.0;

    // Emit glowing cyan energy trail dots
    sp.trailTimer += dt;
    if (sp.trailTimer >= 0.028) {
      sp.trailTimer = 0;
      vfx.spawnShieldTrailDot(sp.pos);
    }

    // Safety failsafe if somehow flying too long
    if (sp.age > 3.6 && sp.phase !== 'RETURN') {
      sp.phase = 'RETURN';
    }

    if (sp.phase === 'OUT_TO_FIRST' || sp.phase === 'BOUNCE_TO_SECOND') {
      const speed = sp.phase === 'BOUNCE_TO_SECOND' ? spec.speedBounce : spec.speedOut;
      if (!sp.target || sp.target.dead) {
        // Target died mid-flight -> try chaining to another or return!
        const next = sp.hitsDone < spec.maxChainTargets ? findNextChainTarget(sp.pos, sp.hitIds) : null;
        if (next) {
          sp.target = next;
          sp.phase = 'BOUNCE_TO_SECOND';
        } else {
          sp.phase = 'RETURN';
        }
      } else {
        const targetPos = new THREE.Vector3(sp.target.pos.x, sp.target.isBoss ? 1.7 : 1.25, sp.target.pos.z);
        const toTarget = new THREE.Vector3().subVectors(targetPos, sp.pos);
        const dist = toTarget.length();
        const stepDist = speed * dt;

        if (dist <= stepDist + sp.target.radius * 0.72) {
          // IMPACT!
          sp.pos.copy(targetPos);
          sp.hitIds.add(sp.target.id);
          sp.hitsDone += 1;

          const knockDir = toTarget.setY(0).lengthSq() > 0.001 ? toTarget.normalize() : sp.dir.clone();
          const hitEnemy = sp.target;

          // Look for Chain Target #2 immediately if this was hit #1!
          const nextTarget = sp.hitsDone < spec.maxChainTargets ? findNextChainTarget(hitEnemy.pos, sp.hitIds) : null;
          const dmg =
            sp.hitsDone === 2
              ? spec.damageSecond
              : nextTarget
              ? spec.damageFirst
              : spec.damageSolo;

          damageEnemy(hitEnemy, dmg, {
            knockDir,
            knockback: spec.knockback,
            slowDuration: spec.slowDuration,
            slowFactor: spec.slowFactor,
            sparkColor: 0x38bdf8,
            sparkCount: 15,
            textStyle: 'skill',
            heavy: true,
          });

          Audio.shieldBounce(sp.hitsDone);
          triggerHitstop(0.032);
          triggerShake(0.18);
          vfx.spawnShockwave(hitEnemy.pos, 0.35, 2.9, 0x38bdf8, 0.32, 0.16);

          if (nextTarget) {
            // CHAIN LIGHTNING BOUNCE TO TARGET #2!
            const nextPos = new THREE.Vector3(nextTarget.pos.x, nextTarget.isBoss ? 1.7 : 1.25, nextTarget.pos.z);
            vfx.spawnLightningArc(sp.pos, nextPos, 0x38bdf8, 0.32);
            sp.target = nextTarget;
            sp.phase = 'BOUNCE_TO_SECOND';
          } else {
            // Rebound gracefully for a split second, then boomerang back to Hero!
            sp.phase = 'REBOUND';
            sp.reboundTimer = 0.11;
            const perp = new THREE.Vector3(-knockDir.z, 0, knockDir.x).normalize();
            sp.reboundDir.copy(perp).multiplyScalar(0.75).addScaledVector(knockDir, -0.35).normalize();
          }
        } else {
          toTarget.normalize();
          sp.dir.copy(toTarget);
          sp.pos.addScaledVector(toTarget, stepDist);
        }
      }
    } else if (sp.phase === 'FREE_OUT') {
      const stepDist = spec.speedOut * dt;
      sp.pos.addScaledVector(sp.dir, stepDist);
      sp.freeDistance += stepDist;

      // Clip any enemy along free throw path -> latch into chain!
      for (const e of state.enemies) {
        if (e.dead || sp.hitIds.has(e.id)) continue;
        const d = Math.hypot(e.pos.x - sp.pos.x, e.pos.z - sp.pos.z);
        if (d <= e.radius + 0.9) {
          sp.target = e;
          sp.phase = 'OUT_TO_FIRST';
          break;
        }
      }
      if (sp.freeDistance >= 13.5) {
        sp.phase = 'RETURN';
      }
    } else if (sp.phase === 'REBOUND') {
      sp.reboundTimer -= dt;
      sp.pos.addScaledVector(sp.reboundDir, 14.0 * dt);
      if (sp.reboundTimer <= 0) {
        sp.phase = 'RETURN';
      }
    } else if (sp.phase === 'RETURN') {
      const handPos = new THREE.Vector3(h.pos.x, 1.25, h.pos.z);
      const toHero = new THREE.Vector3().subVectors(handPos, sp.pos);
      const dist = toHero.length();
      const stepDist = spec.speedReturn * dt;

      // Slice damage to enemies crossed during return flight
      for (const e of state.enemies) {
        if (e.dead || sp.hitIds.has(e.id) || sp.returnHitIds.has(e.id)) continue;
        const d = Math.hypot(e.pos.x - sp.pos.x, e.pos.z - sp.pos.z);
        if (d <= e.radius + 0.85) {
          sp.returnHitIds.add(e.id);
          damageEnemy(e, spec.damageReturn, {
            knockDir: toHero.clone().setY(0).normalize(),
            knockback: 2.2,
            sparkColor: 0x7dd3fc,
            sparkCount: 8,
            textStyle: 'skill',
          });
          Audio.hit(false);
        }
      }

      if (dist <= stepDist + 0.8) {
        // CAUGHT BACK IN HERO'S HAND!
        Audio.shieldCatch();
        vfx.spawnShockwave(h.pos, 0.25, 1.65, 0x7dd3fc, 0.22, 0.9);
        clearShieldProjectile();
        return;
      } else {
        toHero.normalize();
        sp.pos.addScaledVector(toHero, stepDist);
      }
    }

    sp.visual.group.position.copy(sp.pos);
  }

  // Skill 3 (3 Pips): Bladestorm Whirlwind
  function castSkill3Whirlwind() {
    const h = state.hero;
    const spec = CFG.SKILLS[3];
    h.action = 'skill3';
    h.actionTimer = 0;
    h.actionDuration = spec.duration;
    h.whirlwindTickTimer = 0.04; // hit almost immediately on activation!
    h.whirlwindSpinAngle = h.yaw;

    Audio.whirlwindTick(false);
    triggerShake(0.25);
    vfx.spawnShockwave(h.pos, 0.6, spec.radius, 0xff8c24, 0.35, 0.14);
  }

  function doWhirlwindPulse(isFinal) {
    const h = state.hero;
    const spec = CFG.SKILLS[3];
    const r = isFinal ? spec.finishRadius : spec.radius;
    const dmg = isFinal ? spec.finishDamage : spec.tickDamage;

    Audio.whirlwindTick(isFinal);
    if (isFinal) {
      vfx.spawnShockwave(h.pos, 0.6, r + 0.6, 0xff6b1a, 0.42, 0.18);
      vfx.spawnSparks(new THREE.Vector3(h.pos.x, 1.25, h.pos.z), 26, 0xfef08a, 5, 13, 0.48, 1.35);
      triggerShake(0.36);
      triggerHitstop(0.05);
    } else {
      vfx.spawnSparks(new THREE.Vector3(h.pos.x, 1.15, h.pos.z), 8, 0xffae34, 4, 9, 0.3, 0.95);
    }

    let anyHit = false;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - h.pos.x;
      const dz = e.pos.z - h.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= r + e.radius) {
        anyHit = true;
        const knockDir = dist > 0.01 ? new THREE.Vector3(dx / dist, 0, dz / dist) : new THREE.Vector3(1, 0, 0);
        damageEnemy(e, dmg, {
          knockDir,
          knockback: isFinal ? spec.finishKnockback : 1.6,
          heavy: isFinal,
          sparkColor: isFinal ? 0xff6b1a : 0xffae34,
          sparkCount: isFinal ? 14 : 6,
          textStyle: 'ult',
        });
      }
    }
    if (anyHit && !isFinal) {
      triggerShake(0.11);
    }
  }

  // ---- Hero Update & Procedural Animation ----
  function updateHero(dt, moveDir, aimPoint) {
    const h = state.hero;
    if (!h) return;

    // Timers
    if (h.invulnTimer > 0) h.invulnTimer = Math.max(0, h.invulnTimer - dt);
    if (h.dodgeCooldown > 0) h.dodgeCooldown = Math.max(0, h.dodgeCooldown - dt);
    if (h.comboWindowTimer > 0) h.comboWindowTimer = Math.max(0, h.comboWindowTimer - dt);
    if (h.hitFlashTimer > 0) h.hitFlashTimer = Math.max(0, h.hitFlashTimer - dt);
    for (const id of [1, 2, 3]) {
      if (h.skillCooldowns[id] > 0) h.skillCooldowns[id] = Math.max(0, h.skillCooldowns[id] - dt);
    }

    if (h.empoweredTimer > 0) {
      h.empoweredTimer -= dt;
      if (h.empoweredTimer <= 0 || h.empoweredHits <= 0) {
        h.empoweredTimer = 0;
        h.empoweredHits = 0;
      }
    }

    // Gentle out-of-combat Rage bar decay (banked Pips stay lit!)
    h.timeSinceCombat += dt;
    if (h.timeSinceCombat > CFG.HERO.RAGE_DECAY_DELAY && h.rage > 0 && h.ragePips < CFG.HERO.MAX_PIPS) {
      h.rage = Math.max(0, h.rage - CFG.HERO.RAGE_DECAY_RATE * dt);
    }

    if (h.dead) {
      h.model.bodyRoot.rotation.x = Math.min(Math.PI * 0.48, h.model.bodyRoot.rotation.x + dt * 3.5);
      h.model.bodyRoot.position.y = Math.max(-0.35, h.model.bodyRoot.position.y - dt * 1.2);
      state.whirlwindVortex.update(dt, h.pos, false);
      return;
    }

    // Action state update
    if (h.action === 'attack') {
      h.actionTimer += dt;
      const step = CFG.HERO.COMBO[h.comboIndex];
      const hitAt = step.hitTime * (h.actionDuration / step.duration);
      if (!h.attackHitDone && h.actionTimer >= hitAt) {
        h.attackHitDone = true;
        executeMeleeHit();
      }
      if (h.actionTimer >= h.actionDuration) {
        h.comboIndex = (h.comboIndex + 1) % CFG.HERO.COMBO.length;
        h.comboWindowTimer = CFG.HERO.COMBO_RESET_WINDOW;
        h.action = 'idle';
        if (h.queuedAttack) {
          startComboAttack(aimPoint);
        }
      }
    } else if (h.action === 'dodge') {
      h.actionTimer += dt;
      h.pos.addScaledVector(h.dodgeDir, CFG.HERO.DODGE_SPEED * dt);
      if (h.actionTimer >= h.actionDuration) {
        h.action = 'idle';
      }
    } else if (h.action === 'skill1') {
      h.actionTimer += dt;
      const spec = CFG.SKILLS[1];
      h.pos.addScaledVector(h.skill1Dir, spec.dashSpeed * dt);

      // Trail dust/gold sparks during bash dash
      if (Math.random() < 0.6) {
        vfx.spawnSparks(new THREE.Vector3(h.pos.x, 0.7, h.pos.z), 1, 0xfde047, 1, 3.5, 0.25, 0.85);
      }

      // Hit enemies along the charge path
      for (const e of state.enemies) {
        if (e.dead || h.skill1HitSet.has(e.id)) continue;
        const d = Math.hypot(e.pos.x - h.pos.x, e.pos.z - h.pos.z);
        if (d <= spec.hitRadius + e.radius) {
          h.skill1HitSet.add(e.id);
          damageEnemy(e, spec.damage, {
            knockDir: h.skill1Dir,
            knockback: spec.knockback,
            stun: spec.stunDuration,
            heavy: true,
            sparkColor: 0xfbbf24,
            sparkCount: 14,
            textStyle: 'heavy',
          });
          Audio.hit(true);
          triggerHitstop(0.045);
          triggerShake(0.24);
          // Stop cleanly right in front of Boss on direct collision
          if (e.isBoss) {
            h.actionTimer = h.actionDuration;
          }
        }
      }

      if (h.actionTimer >= h.actionDuration) {
        // End-of-dash shield slam shockwave burst!
        vfx.spawnShockwave(h.pos, 0.4, spec.endBurstRadius, 0xfbbf24, 0.34, 0.14);
        for (const e of state.enemies) {
          if (e.dead || h.skill1HitSet.has(e.id)) continue;
          const d = Math.hypot(e.pos.x - h.pos.x, e.pos.z - h.pos.z);
          if (d <= spec.endBurstRadius + e.radius) {
            h.skill1HitSet.add(e.id);
            const push = new THREE.Vector3(e.pos.x - h.pos.x, 0, e.pos.z - h.pos.z).normalize();
            damageEnemy(e, spec.damage, {
              knockDir: push,
              knockback: spec.knockback,
              stun: spec.stunDuration,
              heavy: true,
              sparkColor: 0xfbbf24,
              sparkCount: 12,
              textStyle: 'heavy',
            });
            Audio.hit(true);
          }
        }
        h.action = 'idle';
      }
    } else if (h.action === 'skill3') {
      h.actionTimer += dt;
      const spec = CFG.SKILLS[3];
      // Free movement during Whirlwind!
      if (moveDir.lengthSq() > 0.001) {
        h.pos.addScaledVector(moveDir, CFG.HERO.MOVE_SPEED * spec.moveSpeedMult * dt);
      }
      h.whirlwindSpinAngle += dt * 19.0;
      h.whirlwindTickTimer -= dt;
      if (h.whirlwindTickTimer <= 0 && h.actionTimer < h.actionDuration - 0.12) {
        h.whirlwindTickTimer = spec.tickInterval;
        doWhirlwindPulse(false);
      }
      if (h.actionTimer >= h.actionDuration) {
        doWhirlwindPulse(true);
        h.action = 'idle';
      }
    } else {
      // Idle / Moving / Blocking
      if (h.isBlocking) {
        if (state.shieldProjectile) {
          h.isBlocking = false;
        } else {
          h.blockHeldTime += dt;
          // Face aim cursor while blocking so directional parry feels razor sharp
          const aimYaw = Math.atan2(aimPoint.x - h.pos.x, aimPoint.z - h.pos.z);
          h.yaw += angleDiff(h.yaw, aimYaw) * Math.min(1, dt * 16);
        }
      }

      if (moveDir.lengthSq() > 0.001) {
        const speed = CFG.HERO.MOVE_SPEED * (h.isBlocking ? CFG.HERO.BLOCK_MOVE_MULT : 1.0);
        h.pos.addScaledVector(moveDir, speed * dt);
        if (!h.isBlocking) {
          const moveYaw = Math.atan2(moveDir.x, moveDir.z);
          h.yaw += angleDiff(h.yaw, moveYaw) * Math.min(1, dt * 14);
        }
        h.walkCycle += dt * (h.isBlocking ? 6.5 : 11.5);
      } else if (!h.isBlocking) {
        // Subtly track aim cursor when standing ready
        const aimYaw = Math.atan2(aimPoint.x - h.pos.x, aimPoint.z - h.pos.z);
        h.yaw += angleDiff(h.yaw, aimYaw) * Math.min(1, dt * 6);
      }
    }

    // Apply & decay knockback / combat lunge
    h.pos.addScaledVector(h.knockVel, dt);
    h.knockVel.multiplyScalar(Math.max(0, 1 - dt * 11));
    clampToArena(h.pos, CFG.HERO.RADIUS);

    // Update Hero 3D Model Pose & Procedural Animations
    animateHeroModel(h, dt, moveDir.lengthSq() > 0.001);
    state.whirlwindVortex.update(dt, h.pos, h.action === 'skill3');
  }

  function animateHeroModel(h, dt, isMoving) {
    const m = h.model;
    m.root.position.copy(h.pos);
    m.root.rotation.y = h.action === 'skill3' ? h.whirlwindSpinAngle : h.yaw;

    // Reset base transforms smoothly
    m.bodyRoot.position.y = 0;
    m.bodyRoot.rotation.set(0, 0, 0);
    m.torsoGroup.rotation.set(0, 0, 0);
    m.guardDome.visible = h.isBlocking && !state.shieldProjectile;

    // Empowered blade glow
    const bladeGlow = h.action === 'skill3' ? 1.5 : h.empoweredHits > 0 ? 1.0 : 0.14;
    m.bladeMat.emissive.setHex(h.action === 'skill3' || h.empoweredHits > 0 ? 0xff9d24 : 0x3b82f6);
    m.bladeMat.emissiveIntensity = bladeGlow;

    // Shield rune gem pulses brighter with Rage Pips
    m.shieldGem.material.emissiveIntensity = 1.0 + h.ragePips * 0.65;

    // Orbiting 3D Rage Pip Orbs!
    m.pipOrbitGroup.rotation.y += dt * (1.8 + h.ragePips * 0.65);
    for (let i = 0; i < 3; i++) {
      const orb = m.pipOrbs[i];
      orb.visible = i < h.ragePips;
      if (orb.visible) {
        const ang = (i / Math.max(1, h.ragePips)) * Math.PI * 2;
        const r = 1.08;
        orb.position.set(
          Math.cos(ang) * r,
          Math.sin(state.elapsed * 3.8 + i * 2.1) * 0.12,
          Math.sin(ang) * r
        );
        orb.rotation.y += dt * 4.5;
        orb.rotation.x += dt * 3.0;
      }
    }

    // Leg & cloak animation
    if (h.action === 'dodge') {
      const p = h.actionTimer / h.actionDuration;
      m.bodyRoot.rotation.x = p * Math.PI * 2;
      m.bodyRoot.position.y = Math.sin(p * Math.PI) * 0.42;
      m.leftLeg.rotation.x = 0.4;
      m.rightLeg.rotation.x = -0.4;
    } else if (h.action === 'skill1') {
      // Shield forward charge pose!
      m.bodyRoot.rotation.x = 0.24;
      m.leftArm.rotation.set(-1.35, 0.55, 0);
      m.rightArm.rotation.set(0.65, 0, -0.35);
      m.leftLeg.rotation.x = 0.5;
      m.rightLeg.rotation.x = -0.5;
    } else if (h.action === 'skill3') {
      // Whirlwind wide blade & shield spin pose!
      m.bodyRoot.rotation.x = 0.12;
      m.rightArm.rotation.set(-1.45, -0.3, -1.25);
      m.leftArm.rotation.set(-1.35, 0.3, 1.15);
      m.leftLeg.rotation.x = Math.sin(state.elapsed * 18) * 0.35;
      m.rightLeg.rotation.x = -m.leftLeg.rotation.x;
    } else if (h.action === 'attack') {
      const p = Math.min(1, h.actionTimer / h.actionDuration);
      const swing = Math.sin(p * Math.PI);
      if (h.comboIndex === 0) {
        m.torsoGroup.rotation.y = -0.75 + p * 1.65;
        m.rightArm.rotation.set(-1.35, -0.6 + p * 1.9, -0.65);
      } else if (h.comboIndex === 1) {
        m.torsoGroup.rotation.y = 0.8 - p * 1.7;
        m.rightArm.rotation.set(-1.2, 1.2 - p * 2.0, 0.5);
      } else {
        // Heavy overhead cleave finisher
        m.torsoGroup.rotation.x = -0.25 + p * 0.65;
        m.rightArm.rotation.set(-2.45 + p * 2.55, 0, -0.2);
      }
      m.leftArm.rotation.set(-0.55, 0.25, 0.25 * swing);
      m.leftLeg.rotation.x = 0.25;
      m.rightLeg.rotation.x = -0.25;
    } else if (h.isBlocking) {
      // Stalwart shield guard stance
      m.torsoGroup.rotation.y = 0.28;
      m.leftArm.rotation.set(-1.25, 0.62, 0.15);
      m.rightArm.rotation.set(-0.65, -0.2, -0.2);
      const legSwing = isMoving ? Math.sin(h.walkCycle) * 0.32 : 0;
      m.leftLeg.rotation.x = legSwing;
      m.rightLeg.rotation.x = -legSwing;
    } else {
      // Idle / Run
      const legSwing = isMoving ? Math.sin(h.walkCycle) * 0.62 : 0;
      m.leftLeg.rotation.x = legSwing;
      m.rightLeg.rotation.x = -legSwing;
      m.bodyRoot.position.y = isMoving ? Math.abs(Math.sin(h.walkCycle)) * 0.1 : Math.sin(state.elapsed * 2.8) * 0.03;
      m.rightArm.rotation.set(-0.35 - legSwing * 0.45, 0, -0.14);
      m.leftArm.rotation.set(-0.48 + legSwing * 0.35, 0.24, 0.14);
    }

    // Flowing cloak physics
    m.cloakPivot.rotation.x = isMoving || h.action === 'skill1' ? 0.42 + Math.sin(state.elapsed * 12) * 0.1 : 0.14 + Math.sin(state.elapsed * 3) * 0.05;
  }

  // ---- Enemy AI Update (Orc Warriors & Orc Warlord Boss) ----
  function updateEnemies(dt) {
    const h = state.hero;
    if (!h) return;

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];

      // Hit flash decay
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
        e.model.setHitFlash(e.hitFlashTimer > 0 ? 1 : 0);
      }

      // Death collapse animation
      if (e.dead) {
        e.deathTimer += dt;
        const p = Math.min(1, e.deathTimer / 0.65);
        e.model.bodyRoot.rotation.x = -p * Math.PI * 0.48;
        e.model.bodyRoot.position.y = -p * 0.45;
        if (e.deathTimer >= 1.35) {
          scene.remove(e.model.root);
          state.enemies.splice(i, 1);
        }
        continue;
      }

      // Status timers
      if (e.slowTimer > 0) {
        e.slowTimer -= dt;
        if (e.slowTimer <= 0) e.slowFactor = 1.0;
      }
      if (e.attackCooldown > 0) e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      if (e.attackAnimTimer > 0) e.attackAnimTimer = Math.max(0, e.attackAnimTimer - dt);

      const dx = h.pos.x - e.pos.x;
      const dz = h.pos.z - e.pos.z;
      const distToHero = Math.hypot(dx, dz);
      const angleToHero = Math.atan2(dx, dz);

      // Stunned state
      if (e.aiState === 'stunned') {
        e.stunTimer -= dt;
        e.model.stunStars.visible = true;
        e.model.stunStars.rotation.y += dt * 6.5;
        if (e.stunTimer <= 0) {
          e.aiState = 'chase';
          e.model.stunStars.visible = false;
          if (e.isBoss) ui.setBossAction('');
        }
      } else {
        e.model.stunStars.visible = false;
        if (h.dead) {
          // Idle triumph when player defeated
          e.aiState = 'chase';
        } else if (e.isBoss) {
          updateBossAI(e, dt, distToHero, angleToHero);
        } else {
          updateOrcAI(e, dt, distToHero, angleToHero);
        }
      }

      // Soft separation between enemies so they flank nicely instead of stacking
      for (let j = 0; j < state.enemies.length; j++) {
        if (i === j || state.enemies[j].dead) continue;
        const other = state.enemies[j];
        const sx = e.pos.x - other.pos.x;
        const sz = e.pos.z - other.pos.z;
        const sd = Math.hypot(sx, sz);
        const minSep = e.radius + other.radius + 0.35;
        if (sd > 0.001 && sd < minSep) {
          const push = ((minSep - sd) / minSep) * 4.5 * dt;
          e.pos.x += (sx / sd) * push;
          e.pos.z += (sz / sd) * push;
        }
      }

      // Apply knockback & arena bounds
      e.pos.addScaledVector(e.knockVel, dt);
      e.knockVel.multiplyScalar(Math.max(0, 1 - dt * 10));
      clampToArena(e.pos, e.radius);

      animateEnemyModel(e, dt);
    }
  }

  function updateOrcAI(e, dt, distToHero, angleToHero) {
    const spec = e.spec;
    const speed = spec.speed * e.slowFactor;

    if (e.aiState === 'windup') {
      e.stateTimer += dt;
      const p = Math.min(1, e.stateTimer / spec.windupTime);
      if (e.telegraph) e.telegraph.setProgress(p);
      // Slight tracking early in windup, locked in final 45% so dodge feels great
      if (p < 0.55) {
        e.yaw += angleDiff(e.yaw, angleToHero) * Math.min(1, dt * 5);
        if (e.telegraph) e.telegraph.group.rotation.y = e.yaw;
      }
      if (e.stateTimer >= spec.windupTime) {
        if (e.telegraph) {
          e.telegraph.destroy();
          e.telegraph = null;
        }
        // Execute Orc Cleave!
        e.attackAnimTimer = 0.28;
        vfx.spawnSlashArc(e.pos, e.yaw, spec.attackRange + 0.4, spec.attackArc, 0xf87171, false, 0.2, 1.15);
        const curDist = Math.hypot(state.hero.pos.x - e.pos.x, state.hero.pos.z - e.pos.z);
        const curAng = Math.atan2(state.hero.pos.x - e.pos.x, state.hero.pos.z - e.pos.z);
        if (curDist <= spec.attackRange + CFG.HERO.RADIUS + 0.3 && Math.abs(angleDiff(e.yaw, curAng)) <= spec.attackArc * 0.58) {
          damageHero(spec.damage, e, spec.knockback);
        }
        e.aiState = 'recover';
        e.stateTimer = 0;
        e.attackCooldown = spec.attackCooldown * (0.85 + Math.random() * 0.35);
      }
    } else if (e.aiState === 'recover') {
      e.stateTimer += dt;
      if (e.stateTimer >= spec.recoverTime) {
        e.aiState = 'chase';
      }
    } else {
      e.yaw += angleDiff(e.yaw, angleToHero) * Math.min(1, dt * 8);
      if (distToHero <= spec.attackRange && e.attackCooldown <= 0) {
        e.aiState = 'windup';
        e.stateTimer = 0;
        e.yaw = angleToHero;
        e.telegraph = vfx.createSectorTelegraph(e.pos, e.yaw, spec.attackRange + 0.4, spec.attackArc, 0xef4444);
      } else if (distToHero > spec.attackRange - 0.35) {
        e.pos.x += Math.sin(angleToHero) * speed * dt;
        e.pos.z += Math.cos(angleToHero) * speed * dt;
        e.walkCycle += dt * 8.5 * e.slowFactor;
      } else {
        // Strafe around hero while waiting for attack cooldown
        const perpAng = angleToHero + (Math.PI / 2) * e.strafeDir;
        e.pos.x += Math.sin(perpAng) * speed * 0.48 * dt;
        e.pos.z += Math.cos(perpAng) * speed * 0.48 * dt;
        e.walkCycle += dt * 5.0 * e.slowFactor;
      }
    }
  }

  function updateBossAI(e, dt, distToHero, angleToHero) {
    const spec = e.spec;
    const speedMult = e.enraged ? 1.18 : 1.0;
    const baseSpeed = (e.enraged ? spec.enrageSpeed : spec.speed) * e.slowFactor;

    if (distToHero < 5.6) e.closeTimer += dt;
    else e.closeTimer = Math.max(0, e.closeTimer - dt * 0.6);

    if (e.aiState === 'windup') {
      e.stateTimer += dt;
      const move = e.currentMove;
      const windupDur = move.windup / (e.enraged ? 1.15 : 1.0);
      const p = Math.min(1, e.stateTimer / windupDur);
      if (e.telegraph) e.telegraph.setProgress(p);

      if (e.currentMoveKey === 'cleave' && p < 0.45) {
        e.yaw += angleDiff(e.yaw, angleToHero) * Math.min(1, dt * 4.2);
        if (e.telegraph) e.telegraph.group.rotation.y = e.yaw;
      } else if (e.currentMoveKey === 'charge' && p < 0.52) {
        e.yaw += angleDiff(e.yaw, angleToHero) * Math.min(1, dt * 5.0);
        if (e.telegraph) e.telegraph.group.rotation.y = e.yaw;
      }

      if (e.stateTimer >= windupDur) {
        if (e.telegraph) {
          e.telegraph.destroy();
          e.telegraph = null;
        }
        if (e.currentMoveKey === 'cleave') {
          e.attackAnimTimer = 0.36;
          Audio.slash(2);
          vfx.spawnSlashArc(e.pos, e.yaw, move.range, move.arc, 0xff5a1f, false, 0.28, 1.55);
          const curDist = Math.hypot(state.hero.pos.x - e.pos.x, state.hero.pos.z - e.pos.z);
          const curAng = Math.atan2(state.hero.pos.x - e.pos.x, state.hero.pos.z - e.pos.z);
          if (curDist <= move.range + CFG.HERO.RADIUS && Math.abs(angleDiff(e.yaw, curAng)) <= move.arc * 0.56) {
            damageHero(move.damage * (e.enraged ? 1.15 : 1.0), e, move.knockback);
          }
          e.aiState = 'recover';
          e.stateTimer = 0;
          e.attackCooldown = 1.25 / speedMult;
          ui.setBossAction('');
        } else if (e.currentMoveKey === 'slam') {
          // EARTHSHATTER SLAM! Rewards disengaging and throwing Shield (Skill 2)!
          e.attackAnimTimer = 0.42;
          Audio.bossSlam();
          triggerShake(0.6);
          vfx.spawnShockwave(e.pos, 0.8, move.radius + 0.5, 0xff5a1f, 0.5, 0.16);
          vfx.spawnShockwave(e.pos, 0.5, move.radius * 0.65, 0xfef08a, 0.36, 0.2);
          vfx.spawnSparks(new THREE.Vector3(e.pos.x, 0.6, e.pos.z), 30, 0xff7b24, 5, 14, 0.6, 1.5);
          const curDist = Math.hypot(state.hero.pos.x - e.pos.x, state.hero.pos.z - e.pos.z);
          if (curDist <= move.radius + CFG.HERO.RADIUS * 0.5) {
            damageHero(move.damage * (e.enraged ? 1.15 : 1.0), e, move.knockback);
          }
          e.closeTimer = 0;
          e.aiState = 'recover';
          e.stateTimer = 0;
          e.attackCooldown = 1.6 / speedMult;
          ui.setBossAction('');
        } else if (e.currentMoveKey === 'charge') {
          e.aiState = 'charging';
          e.stateTimer = 0;
          e.chargeHitHero = false;
          e.chargeDir.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
          Audio.bossRoar();
          triggerShake(0.25);
        }
      }
    } else if (e.aiState === 'charging') {
      const move = spec.charge;
      e.stateTimer += dt;
      e.pos.addScaledVector(e.chargeDir, move.speed * dt);
      e.walkCycle += dt * 15;
      if (Math.random() < 0.7) {
        vfx.spawnSparks(new THREE.Vector3(e.pos.x, 0.5, e.pos.z), 2, 0xff6b2b, 2, 6, 0.32, 1.1);
      }
      if (!e.chargeHitHero) {
        const curDist = Math.hypot(state.hero.pos.x - e.pos.x, state.hero.pos.z - e.pos.z);
        if (curDist <= e.radius + CFG.HERO.RADIUS + 0.45) {
          e.chargeHitHero = true;
          damageHero(move.damage * (e.enraged ? 1.15 : 1.0), e, move.knockback);
        }
      }
      if (e.stateTimer >= move.duration) {
        vfx.spawnShockwave(e.pos, 0.5, 3.0, 0xff6b2b, 0.32, 0.12);
        e.aiState = 'recover';
        e.stateTimer = 0;
        e.attackCooldown = 1.35 / speedMult;
        ui.setBossAction('统领喘息 · 突进良机!');
      }
    } else if (e.aiState === 'recover') {
      e.stateTimer += dt;
      const rec = e.currentMove ? e.currentMove.recover : 0.9;
      if (e.stateTimer >= rec) {
        e.aiState = 'chase';
        ui.setBossAction('');
      }
    } else {
      // Chase & Pick Boss Move based on tactical spacing!
      e.yaw += angleDiff(e.yaw, angleToHero) * Math.min(1, dt * 6);
      if (e.attackCooldown <= 0) {
        if (distToHero <= 5.4 && e.closeTimer >= 2.2) {
          // Player lingered close -> Earthshatter Slam forces spacing pull-back!
          startBossMove(e, 'slam', angleToHero);
          return;
        } else if (distToHero <= spec.cleave.range - 0.35) {
          startBossMove(e, Math.random() < 0.36 ? 'slam' : 'cleave', angleToHero);
          return;
        } else if (distToHero >= 7.2 && distToHero <= 14.5 && Math.random() < 0.65) {
          // Player kiting at mid/far range -> Brutal Charge!
          startBossMove(e, 'charge', angleToHero);
          return;
        }
      }
      if (distToHero > 3.2) {
        e.pos.x += Math.sin(angleToHero) * baseSpeed * dt;
        e.pos.z += Math.cos(angleToHero) * baseSpeed * dt;
        e.walkCycle += dt * 7.2 * e.slowFactor;
      }
    }
  }

  function startBossMove(e, moveKey, angleToHero) {
    const move = e.spec[moveKey];
    e.currentMoveKey = moveKey;
    e.currentMove = move;
    e.aiState = 'windup';
    e.stateTimer = 0;
    e.yaw = angleToHero;

    if (moveKey === 'cleave') {
      e.telegraph = vfx.createSectorTelegraph(e.pos, e.yaw, move.range, move.arc, 0xef4444);
      ui.setBossAction(`蓄力 · ${move.name}`);
    } else if (moveKey === 'slam') {
      e.telegraph = vfx.createCircleTelegraph(e.pos, move.radius, 0xff4500);
      Audio.bossRoar();
      ui.setBossAction(`危险！${move.name} · 快拉开距离!`);
    } else if (moveKey === 'charge') {
      e.telegraph = vfx.createLaneTelegraph(e.pos, e.yaw, move.length, move.width, 0xef4444);
      ui.setBossAction(`锁定 · ${move.name}!`);
    }
  }

  function animateEnemyModel(e, dt) {
    const m = e.model;
    m.root.position.copy(e.pos);
    m.root.rotation.y = e.yaw;

    if (m.bossAura) {
      m.bossAura.rotation.z += dt * (e.enraged ? 2.2 : 0.9);
      const pulse = 1 + Math.sin(state.elapsed * (e.enraged ? 6 : 3)) * 0.05;
      m.bossAura.scale.setScalar(pulse);
    }

    if (e.aiState === 'stunned') {
      m.torsoGroup.rotation.x = -0.18;
      m.torsoGroup.rotation.z = Math.sin(state.elapsed * 18) * 0.14;
      m.rightArm.rotation.set(0.3, 0, -0.4);
      m.leftArm.rotation.set(0.3, 0, 0.4);
      return;
    }

    m.torsoGroup.rotation.z = 0;
    if (e.aiState === 'windup') {
      // Menacing axe windup pose!
      if (e.isBoss && e.currentMoveKey === 'slam') {
        m.rightArm.rotation.set(-2.85, 0, 0.25);
        m.leftArm.rotation.set(-2.4, 0, -0.3);
        m.torsoGroup.rotation.x = -0.22;
        m.bodyRoot.position.y = Math.sin(state.elapsed * 20) * 0.06;
      } else {
        m.rightArm.rotation.set(-2.35, -0.5, -0.45);
        m.torsoGroup.rotation.y = -0.55;
        m.torsoGroup.rotation.x = 0.06;
      }
      return;
    }

    if (e.attackAnimTimer > 0) {
      m.torsoGroup.rotation.y = 0.85;
      m.torsoGroup.rotation.x = 0.35;
      m.rightArm.rotation.set(0.65, 0.85, 0.25);
      return;
    }

    const moving = e.aiState === 'chase' || e.aiState === 'charging';
    const swing = moving ? Math.sin(e.walkCycle) * 0.55 : 0;
    m.leftLeg.rotation.x = swing;
    m.rightLeg.rotation.x = -swing;
    m.torsoGroup.rotation.x = e.aiState === 'charging' ? 0.42 : 0.14;
    m.torsoGroup.rotation.y = moving ? Math.sin(e.walkCycle) * 0.08 : 0;
    m.bodyRoot.position.y = moving ? Math.abs(Math.sin(e.walkCycle)) * 0.12 : 0;
    m.rightArm.rotation.set(-0.45 - swing * 0.4, 0, -0.15);
    m.leftArm.rotation.set(-0.2 + swing * 0.4, 0, 0.15);
  }

  function update(dt, moveDir, aimPoint) {
    state.elapsed += dt;
    if (state.shakeIntensity > 0) {
      state.shakeIntensity = Math.max(0, state.shakeIntensity - dt * 1.9);
    }

    if (state.hitstopTimer > 0) {
      state.hitstopTimer -= dt;
      vfx.update(dt * 0.2);
      return;
    }

    updateHero(dt, moveDir, aimPoint);
    updateShieldProjectile(dt);
    updateEnemies(dt);
    vfx.update(dt);
  }

  function getActiveBoss() {
    for (const e of state.enemies) {
      if (e.isBoss && !e.dead) return e;
    }
    return null;
  }

  function getLivingEnemyCount() {
    let n = 0;
    for (const e of state.enemies) if (!e.dead) n++;
    return n;
  }

  return {
    state,
    resetAll,
    spawnEnemy,
    tryAttack,
    tryDodge,
    setBlocking,
    tryCastSkill,
    update,
    getActiveBoss,
    getLivingEnemyCount,
  };
};
