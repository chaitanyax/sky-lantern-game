# Sky Lantern Sprint

**Sky Lantern Sprint** is an interactive, browser-based endless runner game designed with plain HTML, CSS, and Vanilla JavaScript. Guide a tiny lantern spirit through a storm of reeds, maneuver carefully, and collect sparks to earn collision shields. 

The game is engineered to be lightweight, cross-platform compatible, and "Hybrid-ready", meaning it functions beautifully in a standard web browser as well as inside native mobile app webviews (like Capacitor or Cordova).

---

## 🎮 Game Design & Mechanics

### Theme
You play as a delicate lantern navigating through a dense field of swaying reeds. The environment is stormy yet stylized, with volumetric clouds passing closely in the background and interactive elements catching the glow of your spirit. 

### Core Gameplay Loop
- **Objective:** Survive as long as possible by navigating through gaps in the incoming reeds, avoiding the ground, and staying within the screen boundaries. 
- **Controls:** Tap, click, spacebar, or the Up Arrow key provides a short burst of upward momentum (*"flap"*). Gravity constantly pulls the lantern downwards.
- **Scoring:** Points are awarded continuously based on distance traveled, plus a bonus of 3 points for each successfully banked spark.
- **The Shield Mechanic:** Collect yellow floating sparks (sparks drawn toward the lantern) throughout the journey. Every 4 banked sparks grant a **shield burst**. If you hit a reed or the canyon floor while shielded, the shield gets consumed, pushing you to safety with a short glowing flash instead of abruptly terminating the flight!

### Game States
1. **Idle Navigation (`idle`):** The lantern floats gently in the center screen, awaiting the user's first tap.
2. **Running (`running`):** The sky continuously shifts, rendering the scrolling obstacles. Score accumulates.
3. **Run Ended (`gameover`):** Colliding with a reed unshielded, or plummeting to the floor or out-of-bounds, halts the game, showing a summary of points and sparks banked. Best score is preserved in local storage.

---

## 🏗 System Architecture

The project maintains a deliberate architecture to separate structure, style, and behavior:

- **Structure:** `index.html` orchestrates everything. It contains standard overlays, persistent score cards (`<div class="hud">`), and the central rendering `<canvas>` surface.
- **Styling:** `styles.css` handles responsive grid layouts, styling cards using modern glassmorphism (translucency + blur) techniques, and scaling overlays. Media queries gracefully condense the application shell on narrow viewports.
- **Engine/Logic:** `app.js` runs a tailored, high-performance HTML5 Canvas rendering loop wrapped safely within an IIFE (Immediately Invoked Function Expression).

### Key Architectural Technicalities

#### 2D Canvas Engine
Game rendering is implemented entirely via the HTML5 `<canvas>` API (`CanvasRenderingContext2D`). The engine bypasses DOM-based rendering overhead when simulating the high-frequency entity movements:
- Uses `ctx.translate()` and `ctx.rotate()` to realistically pitch the lantern up and down depending on trajectory and momentum.
- Reeds and sparks leverage gradients (`ctx.createLinearGradient`, `ctx.createRadialGradient`) painted within path shapes to build visual depth programmatically rather than depending on external graphic assets.
- Entity data (e.g., coordinates, velocity, sizes, sway parameters) are simple JavaScript objects processed during each frame step.

#### Game Loop Pattern (`requestAnimationFrame`)
Animation logic relies on a smooth `requestAnimationFrame()` iteration mechanism that computes `delta time (dt)` (capped at a max step). 
- **`update(dt)`:** Evaluates physics equations (gravity vs flap velocity), triggers spawning timers, increments scroll speed, and checks intersection paths (collisions & picking up sparks). 
- **`draw()`:** Wipes the canvas efficiently and layers elements sequentially (background, clouds, obstacles, items, player, UI flash overlays).

#### State Management
Instead of complex Redux/Flux paradigms, state is contained within localized module variables due to minimal scope requirements. Modifying `state = "running"` or `state = "gameover"` triggers logic branches during the `update()` phase, eliminating memory leaks and nested recursive loops. Persistent "Best Score" syncing is implemented using standard `localStorage`.

#### Responsive Canvas Scaling
Mobile support requires strict responsiveness:
1. `resize()` intercepts container measurements via `getBoundingClientRect()`.
2. Hardware display resolution compensation is applied (`window.devicePixelRatio`) to retain sharpness on high-density Retina or OLED mobile screens.
3. Positional ratios (like gap layouts, obstacle scale, and player radius) automatically remap based on window space. The player model adjusts to remain precisely proportionate to the environment dimensions.

---

## 🛠 File Structure & Dependencies

```text
sky-lantern/
 ├── index.html     # HTML semantics, app shell, and UI overlays
 ├── styles.css     # CSS Variables, grid setup, modern responsive layout
 └── app.js         # Canvas game loop, input listeners, and entity physics
```

There are **zero external dependencies** (no React, Phaser, Babel, or Webpack required to run). 
The application can be deployed instantly using GitHub Pages, Vercel, or opened as a local file (`file:///`) in modern browsers.
