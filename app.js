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
    const t = audioCtx.currentTime;
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
    for (let i = 0; i < 7; i += 1) {
      clouds.push({
        x: (width / 7) * i,
        y: height * (0.18 + Math.random() * 0.5),
        speed: 14 + Math.random() * 22,
        size: 24 + Math.random() * 42,
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
    player.y = height * 0.5;
    player.velocityY = 0;
    player.shieldGlow = 0;
    reeds.length = 0;
    sparks.length = 0;
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
    const gap = Math.max(150, Math.min(210, height * 0.3));
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
    scrollSpeed += dt * 1.4;
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
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#09253f");
    sky.addColorStop(0.52, "#1f6f8b");
    sky.addColorStop(1, "#f6bd60");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (const cloud of clouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.size * 1.5, cloud.size, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(16, 58, 77, 0.22)";
    for (let i = 0; i < 4; i += 1) {
      const ridgeWidth = width / 3;
      const x = i * ridgeWidth - (performance.now() * 0.01 * (i + 1)) % ridgeWidth;
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.quadraticCurveTo(x + ridgeWidth * 0.5, height * 0.58, x + ridgeWidth, height);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawReeds() {
    for (const reed of reeds) {
      const bend = Math.sin(reed.sway) * 8 * scale;
      const gradient = ctx.createLinearGradient(reed.x, 0, reed.x + reed.width, 0);
      gradient.addColorStop(0, "#1f5138");
      gradient.addColorStop(1, "#2d6a4f");
      ctx.fillStyle = gradient;

      ctx.fillRect(reed.x, 0, reed.width, reed.gapTop);
      ctx.fillRect(reed.x + bend, reed.gapBottom, reed.width, height - reed.gapBottom);

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(reed.x + reed.width * 0.2, 0, reed.width * 0.12, reed.gapTop);
      ctx.fillRect(reed.x + bend + reed.width * 0.2, reed.gapBottom, reed.width * 0.12, height - reed.gapBottom);
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

    const halo = ctx.createRadialGradient(0, 0, player.radius * 0.35, 0, 0, player.radius * 2.8);
    halo.addColorStop(0, "rgba(255, 234, 167, 0.95)");
    halo.addColorStop(0.4, "rgba(255, 183, 3, 0.42)");
    halo.addColorStop(1, "rgba(255, 183, 3, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius * 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffcf56";
    drawRoundedRect(-player.radius, -player.radius * 1.1, player.radius * 2, player.radius * 2.2, 8);
    ctx.fill();

    ctx.fillStyle = "#fb8500";
    ctx.fillRect(-player.radius * 0.72, -player.radius * 1.34, player.radius * 1.44, player.radius * 0.38);

    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-player.radius * 0.62, -player.radius * 0.42);
    ctx.lineTo(-player.radius * 0.62, player.radius * 0.72);
    ctx.moveTo(player.radius * 0.62, -player.radius * 0.42);
    ctx.lineTo(player.radius * 0.62, player.radius * 0.72);
    ctx.stroke();

    ctx.fillStyle = "#fffdf6";
    ctx.beginPath();
    ctx.arc(-player.radius * 0.28, -player.radius * 0.12, player.radius * 0.14, 0, Math.PI * 2);
    ctx.arc(player.radius * 0.28, -player.radius * 0.12, player.radius * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#112031";
    ctx.beginPath();
    ctx.arc(-player.radius * 0.28, -player.radius * 0.12, player.radius * 0.07, 0, Math.PI * 2);
    ctx.arc(player.radius * 0.28, -player.radius * 0.12, player.radius * 0.07, 0, Math.PI * 2);
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
