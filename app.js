(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const shieldsEl = document.getElementById("shields");
  const sparksEl = document.getElementById("sparks");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const summaryEl = document.getElementById("summary");
  const soundBtns = document.querySelectorAll(".sound-toggle");
  const soundStates = document.querySelectorAll(".sound-state");
  let soundEnabled = true;

  soundBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      soundStates.forEach(state => {
        state.textContent = soundEnabled ? "ON" : "OFF";
      });
    });
  });

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioCtx;

  function initAudio() {
    if (!audioCtx && AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!audioCtx || !soundEnabled) return;
    // Add a tiny 20ms scheduling buffer to prevent Safari from dropping events scheduled "in the past"
    const t = audioCtx.currentTime + 0.02;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch (type) {
      case "flap":
        osc.type = "sine";
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(500, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case "spark":
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case "shield":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.4);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.2);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
      case "hit":
        osc.type = "sine";
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      case "gameover":
        osc.type = "sine";
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
        break;
    }
  }

  function triggerVibrate(pattern) {
    if (navigator.vibrate && soundEnabled) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Ignore vibration errors
      }
    }
  }

  const STORAGE_KEY = "sky-lantern-sprint-best";
  let bestScore = Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
  let state = "idle";
  let width = 0;
  let height = 0;
  let scale = 1;
  let lastTime = 0;
  let spawnTimer = 0;
  let sparkTimer = 0;
  let distanceScore = 0;
  let shields = 0;
  let sparksCollected = 0;
  let scrollSpeed = 260;
  let flashTimer = 0;
  let currentLevel = 1;

  const player = {
    x: 0,
    y: 0,
    radius: 20,
    velocityY: 0,
    gravity: 980,
    flapForce: -340,
    shieldGlow: 0,
  };

  const reeds = [];
  const sparks = [];
  const clouds = [];
  const stars = [];
  const playerEmbers = [];

  bestEl.textContent = String(bestScore);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    width = rect.width;
    height = rect.height;
    scale = Math.max(0.85, Math.min(width / 420, 1.6));
    player.x = width * 0.24;
    player.radius = 16 * scale;
    if (state === "idle") {
      player.y = height * 0.5;
    }
    rebuildClouds();
  }

  function rebuildClouds() {
    clouds.length = 0;
    stars.length = 0;
    for (let i = 0; i < 7; i += 1) {
      clouds.push({
        x: (width / 7) * i,
        y: height * (0.18 + Math.random() * 0.4),
        speed: 14 + Math.random() * 22,
        size: 24 + Math.random() * 42,
      });
    }
    for (let i = 0; i < 80; i += 1) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.85,
        size: Math.random() * 1.5 + 0.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  function resetGame() {
    initAudio();
    state = "running";
    lastTime = 0;
    spawnTimer = 0;
    sparkTimer = 0;
    distanceScore = 0;
    shields = 0;
    sparksCollected = 0;
    flashTimer = 0;
    scrollSpeed = 260;
    currentLevel = 1;
    player.y = height * 0.5;
    player.velocityY = 0;
    player.shieldGlow = 0;
    reeds.length = 0;
    sparks.length = 0;
    playerEmbers.length = 0;
    scoreEl.textContent = "0";
    shieldsEl.textContent = "0";
    sparksEl.textContent = "0";
    startOverlay.classList.remove("overlay-visible");
    gameOverOverlay.classList.remove("overlay-visible");
  }

  function endGame() {
    state = "gameover";
    const totalScore = Math.floor(distanceScore) + sparksCollected * 3;
    bestScore = Math.max(bestScore, totalScore);
    localStorage.setItem(STORAGE_KEY, String(bestScore));
    bestEl.textContent = String(bestScore);
    summaryEl.textContent =
      "Score " +
      totalScore +
      " with " +
      sparksCollected +
      " sparks banked and " +
      shields +
      " shields left.";
    gameOverOverlay.classList.add("overlay-visible");
  }

  function flap() {
    initAudio();
    if (state === "idle") {
      resetGame();
    }
    if (state === "gameover") {
      resetGame();
    }
    player.velocityY = player.flapForce * scale;
    playSound("flap");
    triggerVibrate(15);
  }

  function spawnReed() {
    let minGap = 150;
    let maxGap = 210;
    if (currentLevel === 2) { minGap = 130; maxGap = 180; }
    if (currentLevel === 3) { minGap = 110; maxGap = 150; }
    const gap = Math.max(minGap, Math.min(maxGap, height * (0.32 - currentLevel * 0.02)));
    const topHeight = 90 + Math.random() * (height - gap - 220);
    reeds.push({
      x: width + 60,
      width: 52 * scale,
      gapTop: topHeight,
      gapBottom: topHeight + gap,
      scored: false,
      sway: Math.random() * Math.PI * 2,
    });
  }

  function spawnSpark() {
    if (!reeds.length) {
      return;
    }
    const reed = reeds[reeds.length - 1];
    sparks.push({
      x: reed.x + reed.width * 1.2,
      y: reed.gapTop + (reed.gapBottom - reed.gapTop) * (0.2 + Math.random() * 0.6),
      radius: 9 * scale,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  function update(dt) {
    if (state !== "running") {
      draw();
      return;
    }

    flashTimer = Math.max(0, flashTimer - dt);
    scrollSpeed += dt * 0.2;
    spawnTimer += dt;
    sparkTimer += dt;
    distanceScore += dt * 1.85;

    if (spawnTimer >= 1.35) {
      spawnTimer = 0;
      spawnReed();
    }

    if (sparkTimer >= 1.35) {
      sparkTimer = 0;
      spawnSpark();
    }

    player.velocityY += player.gravity * dt * scale;
    player.y += player.velocityY * dt;
    player.shieldGlow = Math.max(0, player.shieldGlow - dt * 2.4);

    if (Math.random() < dt * 15 + (player.velocityY < 0 ? dt * 25 : 0)) {
      playerEmbers.push({
        x: player.x,
        y: player.y + player.radius * 1.2,
        vx: (Math.random() - 0.5) * 30,
        vy: Math.random() * 20 + 10,
        life: 1.0,
        maxLife: 0.5 + Math.random() * 0.6,
        size: (Math.random() * 2.5 + 1) * scale
      });
    }

    for (let i = playerEmbers.length - 1; i >= 0; i -= 1) {
      const e = playerEmbers[i];
      e.life -= dt / e.maxLife;
      e.x -= scrollSpeed * dt * 0.7; // embers trail behind
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.life <= 0) {
        playerEmbers.splice(i, 1);
      }
    }

    for (const cloud of clouds) {
      cloud.x -= cloud.speed * dt;
      if (cloud.x < -cloud.size * 2) {
        cloud.x = width + cloud.size;
        cloud.y = height * (0.18 + Math.random() * 0.5);
      }
    }

    for (let i = reeds.length - 1; i >= 0; i -= 1) {
      const reed = reeds[i];
      reed.x -= scrollSpeed * dt;
      reed.sway += dt * 1.2;

      if (!reed.scored && reed.x + reed.width < player.x) {
        reed.scored = true;
        updateScore();
      }

      if (reed.x + reed.width < -20) {
        reeds.splice(i, 1);
        continue;
      }

      if (hitsReed(reed)) {
        handleCollision();
      }
    }

    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i];
      spark.x -= scrollSpeed * dt;
      spark.pulse += dt * 4;

      if (spark.x + spark.radius < -20) {
        sparks.splice(i, 1);
        continue;
      }

      const dx = spark.x - player.x;
      const dy = spark.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < spark.radius + player.radius * 0.9) {
        sparks.splice(i, 1);
        sparksCollected += 1;
        if (sparksCollected % 4 === 0) {
          shields += 1;
          player.shieldGlow = 1;
          playSound("shield");
          triggerVibrate([20, 50, 30]);
        } else {
          playSound("spark");
          triggerVibrate(15);
        }
        shieldsEl.textContent = String(shields);
        sparksEl.textContent = String(sparksCollected);
        updateScore();
      }
    }

    if (player.y > height - 34 || player.y < 28) {
      handleCollision();
    }

    updateScore();
    draw();
  }

  function handleCollision() {
    if (flashTimer > 0) {
      return;
    }

    if (shields > 0) {
      shields -= 1;
      shieldsEl.textContent = String(shields);
      flashTimer = 0.7;
      player.velocityY = player.flapForce * 0.45 * scale;
      player.shieldGlow = 1.25;
      playSound("hit");
      triggerVibrate([40, 40, 40]);
      return;
    }

    playSound("gameover");
    triggerVibrate([100, 50, 200]);
    endGame();
  }

  function hitsReed(reed) {
    const withinX = player.x + player.radius > reed.x && player.x - player.radius < reed.x + reed.width;
    if (!withinX) {
      return false;
    }
    return player.y - player.radius < reed.gapTop || player.y + player.radius > reed.gapBottom;
  }

  function updateScore() {
    const totalScore = Math.floor(distanceScore) + sparksCollected * 3;
    if (scoreEl.textContent !== String(totalScore)) {
      scoreEl.textContent = String(totalScore);
    }
    
    let newLevel = 1;
    if (totalScore >= 3000) newLevel = 2;
    if (totalScore >= 6000) newLevel = 3;
    
    if (newLevel > currentLevel) {
      currentLevel = newLevel;
      scrollSpeed += 15; // speed bump!
    }
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    if (currentLevel === 1) {
      sky.addColorStop(0, "#010e28");
      sky.addColorStop(0.35, "#0b2046");
      sky.addColorStop(0.7, "#281b40");
      sky.addColorStop(1, "#0d0914");
    } else if (currentLevel === 2) {
      sky.addColorStop(0, "#2a1738");
      sky.addColorStop(0.35, "#5c3a58");
      sky.addColorStop(0.7, "#d9786c");
      sky.addColorStop(1, "#ffb37b");
    } else {
      sky.addColorStop(0, "#441416");
      sky.addColorStop(0.35, "#a83832");
      sky.addColorStop(0.7, "#df6b30");
      sky.addColorStop(1, "#f8b850");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (currentLevel === 1) {
      ctx.fillStyle = "#ffffff";
      for (const star of stars) {
        const twnk = 0.5 + Math.sin(performance.now() * 0.003 + star.twinkle) * 0.5;
        ctx.globalAlpha = twnk * 0.8;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    const moonX = width * 0.8;
    const moonY = height * 0.2;
    const moonRadius = Math.max(30, height * 0.08);
    
    const mglow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.8, moonX, moonY, moonRadius * 4);
    if (currentLevel === 1) {
      mglow.addColorStop(0, "rgba(255, 252, 230, 0.45)");
      mglow.addColorStop(1, "rgba(255, 252, 230, 0)");
      ctx.fillStyle = mglow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius * 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#fffae6";
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.beginPath();
      ctx.arc(moonX - moonRadius*0.3, moonY - moonRadius*0.2, moonRadius*0.2, 0, Math.PI*2);
      ctx.arc(moonX + moonRadius*0.4, moonY + moonRadius*0.1, moonRadius*0.3, 0, Math.PI*2);
      ctx.arc(moonX - moonRadius*0.1, moonY + moonRadius*0.4, moonRadius*0.15, 0, Math.PI*2);
      ctx.fill();
    } else {
      const sunAlpha = currentLevel === 2 ? "0.5" : "0.6";
      mglow.addColorStop(0, `rgba(255, 220, 100, ${sunAlpha})`);
      mglow.addColorStop(1, "rgba(255, 220, 100, 0)");
      ctx.fillStyle = mglow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = currentLevel === 2 ? "#ffefb3" : "#ffe066";
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = currentLevel === 1 ? "rgba(255, 255, 255, 0.05)" : (currentLevel === 2 ? "rgba(255, 200, 200, 0.15)" : "rgba(255, 150, 100, 0.1)");
    for (const cloud of clouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.size * 1.5, cloud.size, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = currentLevel === 1 ? "rgba(10, 15, 30, 0.6)" : (currentLevel === 2 ? "rgba(40, 20, 35, 0.6)" : "rgba(60, 15, 15, 0.7)");
    for (let i = 0; i < 4; i += 1) {
      const ridgeWidth = width / 3;
      const x = i * ridgeWidth - (performance.now() * 0.005 * (i + 1)) % ridgeWidth;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.quadraticCurveTo(x + ridgeWidth * 0.5, height * 0.6, x + ridgeWidth, height);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawReeds() {
    for (const obs of reeds) {
      const bend = Math.sin(obs.sway) * 8 * scale;
      const tX = obs.x + obs.width / 2;
      
      const trunkColor = currentLevel === 1 ? "#070d14" : (currentLevel === 2 ? "#170b15" : "#1a0505");
      const leafColor = currentLevel === 1 ? "#0c1824" : (currentLevel === 2 ? "#281926" : "#2a1010");
      const canopyColor = currentLevel === 1 ? "#05090f" : (currentLevel === 2 ? "#120710" : "#140404");
      const birdColor = currentLevel === 1 ? "#03060a" : (currentLevel === 2 ? "#0a0308" : "#0a0202");

      const trunkWidth = obs.width * 0.3;
      ctx.fillStyle = trunkColor;
      ctx.fillRect(tX - trunkWidth/2, obs.gapBottom, trunkWidth, height - obs.gapBottom);
      
      ctx.fillStyle = leafColor;
      const tiers = 4;
      const tierHeight = Math.max(80, (height - obs.gapBottom) * 0.6); 
      for(let j=0; j<tiers; j++) {
        const topY = obs.gapBottom + j * (tierHeight / tiers);
        const botY = topY + tierHeight * 0.6;
        const w = obs.width * (1.2 + j * 0.4);
        
        ctx.beginPath();
        ctx.moveTo(tX + bend * (1 - j/tiers), topY);
        ctx.lineTo(tX - w/2, botY);
        ctx.lineTo(tX + w/2, botY);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = canopyColor;
      ctx.beginPath();
      ctx.moveTo(obs.x - 30, 0);
      ctx.lineTo(obs.x + obs.width + 30, 0);
      ctx.lineTo(obs.x + obs.width + 10, obs.gapTop * 0.5);
      ctx.lineTo(tX + bend, obs.gapTop);
      ctx.lineTo(obs.x - 10, obs.gapTop * 0.6);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = birdColor;
      for (let b = 0; b < 2; b++) {
        const bx = obs.x - 10 + b * (obs.width + 20);
        const by = obs.gapTop - 25 - b * 15;
        const bscale = 0.6 * scale;
        
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - 12*bscale, by - 8*bscale, bx - 24*bscale, by - 4*bscale);
        ctx.quadraticCurveTo(bx - 12*bscale, by - 2*bscale, bx, by + 6*bscale);
        ctx.quadraticCurveTo(bx + 12*bscale, by - 2*bscale, bx + 24*bscale, by - 4*bscale);
        ctx.quadraticCurveTo(bx + 12*bscale, by - 8*bscale, bx, by);
        ctx.fill();
      }
    }
  }

  function drawSparks() {
    for (const spark of sparks) {
      const pulseSize = 1 + Math.sin(spark.pulse) * 0.18;
      const glow = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.radius * 2.6);
      glow.addColorStop(0, "rgba(255, 248, 180, 1)");
      glow.addColorStop(0.5, "rgba(255, 183, 3, 0.6)");
      glow.addColorStop(1, "rgba(255, 183, 3, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.radius * 2.6 * pulseSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff4c2";
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.radius * pulseSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer() {
    // Draw trailing embers behind the player
    for (const e of playerEmbers) {
      const alpha = Math.max(0, e.life);
      ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(Math.max(-0.45, Math.min(0.65, player.velocityY / 500)));

    const activeShieldAlpha = Math.max(shields > 0 ? 0.6 : 0, Math.min(0.85, player.shieldGlow));
    if (activeShieldAlpha > 0) {
      ctx.strokeStyle = "rgba(173, 232, 244," + activeShieldAlpha.toFixed(2) + ")";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const time = performance.now() / 1000;
    const flicker = Math.sin(time * 15) * 0.1 + Math.sin(time * 35) * 0.05 + 0.85; 
    
    const wobbleY = Math.sin(time * 8) * player.radius * 0.05;
    const wobbleX = Math.cos(time * 6) * player.radius * 0.05;

    const halo = ctx.createRadialGradient(0, player.radius * 0.5, player.radius * 0.2, 0, 0, player.radius * 3.5);
    halo.addColorStop(0, `rgba(255, 230, 150, ${0.9 * flicker})`);
    halo.addColorStop(0.4, `rgba(255, 140, 0, ${0.4 * flicker})`);
    halo.addColorStop(1, "rgba(255, 60, 0, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 3.5, 0, Math.PI * 2);
    ctx.fill();

    const topRadius = player.radius * 1.3;
    const bottomRadius = player.radius * 0.6;
    const lanternHeight = player.radius * 2.6;
    const bottomY = lanternHeight * 0.5;
    const topY = -lanternHeight * 0.5;

    ctx.beginPath();
    ctx.moveTo(-bottomRadius, bottomY);
    ctx.bezierCurveTo(
      -topRadius * 1.5 - wobbleX, bottomY * 0.2, 
      -topRadius * 1.2, topY, 
      0, topY + wobbleY
    );
    ctx.bezierCurveTo(
      topRadius * 1.2, topY, 
      topRadius * 1.5 + wobbleX, bottomY * 0.2, 
      bottomRadius, bottomY
    );
    ctx.quadraticCurveTo(0, bottomY + player.radius * 0.2, -bottomRadius, bottomY);
    ctx.closePath();

    const lanternBodyGrad = ctx.createLinearGradient(0, bottomY, 0, topY);
    lanternBodyGrad.addColorStop(0, "#ffe8a1"); 
    lanternBodyGrad.addColorStop(0.2, "#ffad33"); 
    lanternBodyGrad.addColorStop(0.6, "#e64d00"); 
    lanternBodyGrad.addColorStop(1, "#b32400"); 
    
    ctx.fillStyle = lanternBodyGrad;
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;
    
    ctx.beginPath();
    ctx.moveTo(0, bottomY + player.radius * 0.1);
    ctx.quadraticCurveTo(wobbleX, 0, 0, topY + wobbleY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-bottomRadius * 0.6, bottomY + player.radius * 0.05);
    ctx.quadraticCurveTo(-topRadius * 0.9, bottomY * 0.2, -topRadius * 0.5, topY * 0.8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bottomRadius * 0.6, bottomY + player.radius * 0.05);
    ctx.quadraticCurveTo(topRadius * 0.9, bottomY * 0.2, topRadius * 0.5, topY * 0.8);
    ctx.stroke();

    ctx.fillStyle = "#3a1c00";
    ctx.beginPath();
    ctx.ellipse(0, bottomY, bottomRadius, player.radius * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    const flameFlickerScale = 0.8 + 0.4 * Math.random(); 
    ctx.fillStyle = "rgba(255, 255, 200, 0.9)";
    ctx.beginPath();
    ctx.ellipse(0, bottomY, bottomRadius * 0.6 * flameFlickerScale, player.radius * 0.08 * flameFlickerScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawFloorGlow() {
    const floor = ctx.createLinearGradient(0, height - 54, 0, height);
    floor.addColorStop(0, "rgba(17, 32, 49, 0)");
    floor.addColorStop(1, "rgba(17, 32, 49, 0.68)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, height - 54, width, 54);
  }

  function draw() {
    drawBackground();
    drawReeds();
    drawSparks();
    drawPlayer();
    drawFloorGlow();

    if (flashTimer > 0) {
      ctx.fillStyle = "rgba(173, 232, 244, 0.18)";
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawRoundedRect(x, y, rectWidth, rectHeight, radius) {
    const safeRadius = Math.min(radius, rectWidth / 2, rectHeight / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + rectWidth - safeRadius, y);
    ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + safeRadius);
    ctx.lineTo(x + rectWidth, y + rectHeight - safeRadius);
    ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - safeRadius, y + rectHeight);
    ctx.lineTo(x + safeRadius, y + rectHeight);
    ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function loop(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
    }
    const dt = Math.min((timestamp - lastTime) / 1000, 0.032);
    lastTime = timestamp;
    update(dt);
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" || event.code === "ArrowUp") {
      event.preventDefault();
      flap();
    }
    if (event.code === "Enter" && state === "gameover") {
      resetGame();
    }
  });

  canvas.addEventListener("pointerdown", flap);
  startButton.addEventListener("click", resetGame);
  restartButton.addEventListener("click", resetGame);

  resize();
  draw();
  requestAnimationFrame(loop);
})();
