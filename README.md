# Sky Lantern Sprint

**Live Demo:** [Play Sky Lantern Sprint](https://chaitanyax.github.io/sky-lantern-game/)

**Sky Lantern Sprint** is an interactive, browser-based endless runner game designed with plain HTML, CSS, and Vanilla JavaScript. Guide a tiny lantern spirit through a storm of reeds, maneuver carefully, and collect sparks to earn collision shields. 

The game is engineered to be lightweight, cross-platform compatible, and "Hybrid-ready", meaning it functions beautifully in a standard web browser as well as inside native mobile app viewports.

---

## 🎮 Game Design & Mechanics

### Theme
You play as a delicate flying lantern navigating through a dense field of swaying storm reeds. The environment is stormy yet stylized, featuring volumetric clouds drifting in the background. Interactive elements smoothly catch the glow of the spirit lantern. 

### Core Gameplay Loop
- **Objective:** Survive as long as possible by navigating through gaps in the incoming reeds, avoiding the ground, and staying within the screen boundaries. 
- **Controls:** Tap, click, spacebar, or the Up Arrow key provides a short burst of upward momentum (*"flap"*). Gravity constantly pulls the lantern downward.
- **Scoring:** Points are awarded continuously based on distance traveled, plus a bonus of 3 points for each successfully banked spark.
- **The Shield Mechanic:** Collect yellow floating sparks throughout the journey. Every 4 banked sparks grant a **shield burst**. If you hit a reed or the canyon floor while shielded, the shield is consumed, pushing you backward to safety with a short glowing flash instead of abruptly terminating the flight!

---

## 📐 Mathematics & Core Logic Deep-Dive

The engine runs relying purely on 2D mathematical physics simulated over continuous increments (`dt` — Delta Time).

### 1. Game Loop & Delta Time (`dt`)
The rendering and logic loop relies on `requestAnimationFrame(loop)`. 
```javascript
const dt = Math.min((timestamp - lastTime) / 1000, 0.032);
```
`dt` is clamped to a maximum of `0.032` seconds (equivalent to ~30FPS) to prevent physics glitches if the browser tab goes to sleep or frame drops occur. It guarantees deterministic physical updates.

### 2. Player Physics & Trajectory
The lantern's vertical position relies on Newton's equations of motion, scaled dynamically based on screen resolution (`scale`).
- **Gravity:** Set constantly at `980`.
- **Flap Force:** Applying a hop sets the velocity to `-340 * scale`.
- **Update Logic:**
  ```javascript
  player.velocityY += player.gravity * dt * scale;
  player.y += player.velocityY * dt;
  ```
- **Rotation:** The player sprite rotates visually based on vertical velocity, mapped between bounds for a smooth visual pitch:
  ```javascript
  // Angle bounds from looking up slightly to pointing downward
  ctx.rotate(Math.max(-0.45, Math.min(0.65, player.velocityY / 500)));
  ```

### 3. Obstacle Generation (Reeds)
Reeds spawn sequentially every `1.35` seconds. Each reed has an opening gap for the player to pass through.
- **Gap Size Formula:** Depends heavily on window height (`height`).
  ```javascript
  const gap = Math.max(150, Math.min(210, height * 0.3));
  ```
  *Ensures the gap is never smaller than 150px and never larger than 210px or 30% of the screen height.*
- **Top Reed Bound:** 
  ```javascript
  const topHeight = 90 + Math.random() * (height - gap - 220);
  ```
  *Randomizes the vertical position of the passage gap while respecting roof bounds.*

### 4. Continuous Progression
To increase difficulty naturally, screen scroll speed is not static.
- **Starting Scroll Speed:** `260`
- **Acceleration over Time:** `scrollSpeed += dt * 1.4`
- Reeds and sparks progressively scan across the screen linearly based strictly on this calculated `scrollSpeed`: `reed.x -= scrollSpeed * dt`.

### 5. Spark Spawning & Circular Hitbox (Euclidean Distance)
Sparks are strategically spawned within the "safe gap" of the most recently generated reed:
```javascript
spark.y = reed.gapTop + (reed.gapBottom - reed.gapTop) * (0.2 + Math.random() * 0.6);
```
*They always spawn somewhere between 20% and 80% through the vertical center of the particular gap.*

**Checking Player-Spark Intersect:**
Using the distance formula (`a² + b² = c²`):
```javascript
const dx = spark.x - player.x;
const dy = spark.y - player.y;
const distance = Math.sqrt(dx * dx + dy * dy);

if (distance < spark.radius + player.radius * 0.9) {
    // Spark is collected!
}
```
*Notice multiplying by 0.9 limits the player's collecting box very slightly, ensuring players securely overlap the spark before registering it.*

### 6. Reed Hitbox detection (AABB collision)
The Reed checks employ **Axis-Aligned Bounding Box (AABB)** intersections logic mixed with logic to allow the player sphere.
```javascript
// Check if horizontal X-planes overlap
const withinX = player.x + player.radius > reed.x && player.x - player.radius < reed.x + reed.width;

if (withinX) {
    // Verify Y bounds against the pipe layout gap
    const hitWall = player.y - player.radius < reed.gapTop || player.y + player.radius > reed.gapBottom;
}
```

### 7. Sine Wave Animations (`Math.sin()`)
Several aesthetic features employ sinusoidal waves for natural, breath-like motion:
- **Reed Swaying in Wind:** 
  ```javascript
  reed.sway += dt * 1.2;
  const bend = Math.sin(reed.sway) * 8 * scale;
  ```
  *Bends the bottom half of the reeds slightly on the X-axis over time algorithmically.*
- **Spark Pulsing:**
  ```javascript
  spark.pulse += dt * 4;
  const pulseSize = 1 + Math.sin(spark.pulse) * 0.18; // Scales radius dynamically +/- 18%
  ```

---

## 🏗 Rendering Architecture

### 2D Graphical Canvas
Instead of importing `.png` or `.svg` files, **100% of game assets are drawn algorithmically mapped at runtime**.
- The main sky is composed using linear multi-color gradients `ctx.createLinearGradient()`.
- Sparks and player glowing halos utilize multi-step radial gradients built at exact coordinate points via `ctx.createRadialGradient()`.
- Translucent white semi-circles are utilized to mock atmospheric storm clouds (`ctx.ellipse()`).

### Device Resolution Rescaling (Retina Displays)
```javascript
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.floor(rect.width * dpr);
canvas.height = Math.floor(rect.height * dpr);
ctx.scale(dpr, dpr);
```
Multiplying by the `devicePixelRatio` avoids the game becoming a blurry pixelated mess on high dynamic density screens like Apple's Super Retina mobile devices or high-end OLED Android phones. We aggressively max out DPI scaling at `2` to preserve computing power for rendering frame loops.

---

## 🛠 Project Files 

```text
sky-lantern/
 ├── index.html     # Semantic layout, DOM overlay modals, score HUD panels
 ├── styles.css     # HUD grid systems and blur (glassmorphism) layout
 └── app.js         # Core infinite game loop, math logic, and Canvas painting
```

The application functions independently utilizing core web logic (Vanilla ES6 modules and Canvas). No node modules, build pipes, or web-bundlers are inherently necessary.
