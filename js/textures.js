window.Game = window.Game || {};

window.Game.Textures = {
  createForestGroundTexture(THREE) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep forest floor base
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, size * 0.52);
    grad.addColorStop(0.0, '#4d4a35');
    grad.addColorStop(0.28, '#3f4b2f');
    grad.addColorStop(0.55, '#2b4024');
    grad.addColorStop(1.0, '#192a17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Organic dirt & moss dapple noise
    for (let i = 0; i < 4800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const dist = Math.hypot(x - cx, y - cy) / (size * 0.5);
      const r = 3 + Math.random() * 16;
      if (dist < 0.42 && Math.random() < 0.55) {
        ctx.fillStyle = `rgba(${86 + Math.random() * 35}, ${74 + Math.random() * 28}, ${48 + Math.random() * 20}, ${0.06 + Math.random() * 0.09})`;
      } else {
        ctx.fillStyle = `rgba(${34 + Math.random() * 36}, ${68 + Math.random() * 44}, ${28 + Math.random() * 24}, ${0.07 + Math.random() * 0.11})`;
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scattered fallen autumn/olive leaves & pebbles
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const w = 2 + Math.random() * 4;
      const h = 1.5 + Math.random() * 2.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * Math.PI * 2);
      const pick = Math.random();
      if (pick < 0.45) ctx.fillStyle = 'rgba(130, 108, 56, 0.35)';
      else if (pick < 0.8) ctx.fillStyle = 'rgba(65, 96, 44, 0.38)';
      else ctx.fillStyle = 'rgba(160, 114, 52, 0.32)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }

    // Subtle weathered ancient stone clearing circle marking combat arena space
    const arenaRingR = size * 0.27;
    ctx.strokeStyle = 'rgba(185, 190, 165, 0.26)';
    ctx.lineWidth = 10;
    ctx.setLineDash([28, 12]);
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRingR, 0, Math.PI * 2);
    ctx.stroke();

    // Mossy ancient flagstones embedded in clearing center
    ctx.setLineDash([]);
    for (let i = 0; i < 42; i++) {
      const a = (i / 42) * Math.PI * 2 + (i % 3) * 0.17;
      const r = 30 + (i % 5) * 46;
      const fx = cx + Math.cos(a) * r;
      const fy = cy + Math.sin(a) * r;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(128, 134, 118, 0.26)';
      ctx.fillRect(-10, -7, 20, 14);
      ctx.strokeStyle = 'rgba(35, 52, 28, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -7, 20, 14);
      ctx.restore();
    }

    // Dappled golden forest sunbeam pools on the ground
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 45 + (i % 4) * 58;
      const sx = cx + Math.cos(a) * r;
      const sy = cy + Math.sin(a) * r;
      const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 44);
      sg.addColorStop(0, 'rgba(218, 224, 132, 0.16)');
      sg.addColorStop(1, 'rgba(218, 224, 132, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sx, sy, 44, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(228, 208, 152, 0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, arenaRingR * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  },

  createBarkTexture(THREE) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#3d2c1e';
    ctx.fillRect(0, 0, 128, 256);

    for (let i = 0; i < 180; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 256;
      const w = 2 + Math.random() * 6;
      const h = 18 + Math.random() * 48;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(25,16,10,0.42)' : 'rgba(92,70,48,0.28)';
      ctx.fillRect(x, y, w, h);
    }

    // Moss streaks
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = 'rgba(54, 92, 42, 0.28)';
      ctx.fillRect(Math.random() * 128, Math.random() * 256, 8 + Math.random() * 14, 14 + Math.random() * 26);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  createShieldEmblemTexture(THREE) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep royal steel-blue shield face
    const grad = ctx.createRadialGradient(128, 120, 14, 128, 128, 130);
    grad.addColorStop(0, '#2a5a96');
    grad.addColorStop(0.65, '#19355c');
    grad.addColorStop(1, '#0e1d36');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Brushed metal concentric sheen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let r = 20; r < 120; r += 10) {
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Gold border trim
    ctx.strokeStyle = '#e5b856';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, size - 20, size - 20);

    // Radiant sunburst / lion-cross rune in center
    ctx.save();
    ctx.translate(128, 128);
    ctx.fillStyle = '#f6cc6a';
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(10, -52);
      ctx.lineTo(0, -76);
      ctx.lineTo(-10, -52);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Glowing cyan-gold core boss
    const core = ctx.createRadialGradient(128, 128, 4, 128, 128, 32);
    core.addColorStop(0, '#fff9db');
    core.addColorStop(0.45, '#67e8f9');
    core.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(128, 128, 32, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  },

  createGlowSpriteTexture(THREE) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,240,190,0.72)');
    grad.addColorStop(0.7, 'rgba(255,200,90,0.18)');
    grad.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  },
};
