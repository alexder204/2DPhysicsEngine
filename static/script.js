// ========================================
// Canvas & Context
// ========================================
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ========================================
// Constants
// ========================================
const SPAWN_COOLDOWN_MS = 0; // cooldown between spawns (ms)

// Colors by object type
const typeColors = {
  normal: "#fff",    // white
  heavy: "#888",     // gray
  bouncy: "#0f0",    // neon green
  sticky: "#f0f"     // neon magenta
};

// ========================================
// Global State
// ========================================
let bodies = [];               // all physics bodies (from server)
let initialBodies = [];        // snapshot for reset
let selectedIndex = null;      // index of dragged body
let lastMouse = { x: 0, y: 0 };// last mouse position (for velocity calc)
let velocityWhileDragging = { x: 0, y: 0 };
let spawnCooldown = false;
let pulseTime = 0;             // glow pulse animation timer

// ========================================
// Fetch & Initialization
// ========================================
async function fetchBodies() {
  const res = await fetch("/bodies");
  bodies = await res.json();

  // save initial state for reset
  initialBodies = bodies.map(b => ({
    x: b.x,
    y: b.y,
    vx: 0,
    vy: 0,
    mass: b.mass,
    radius: b.radius
  }));

  draw();
}
fetchBodies();

// ========================================
// UI Controls: Size
// ========================================
const sizeInput = document.getElementById("sizeInput");
sizeInput.addEventListener("input", async () => {
  if (selectedIndex === null) return;

  const newSize = parseFloat(sizeInput.value);
  bodies[selectedIndex].size = newSize;
  bodies[selectedIndex].radius = newSize * 4;

  // sync with server
  await fetch("/set_size", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index: selectedIndex, size: newSize })
  });

  draw();
});

// ========================================
// Mouse Events (drag & throw)
// ========================================

// Select body
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  selectedIndex = null;
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    if ((b.x - mx) ** 2 + (b.y - my) ** 2 <= b.radius ** 2) {
      selectedIndex = i;
      break;
    }
  }

  if (selectedIndex !== null) {
    sizeInput.value = bodies[selectedIndex].radius / 4;
  }

  lastMouse = { x: mx, y: my };
  velocityWhileDragging = { x: 0, y: 0 };
});

// Drag body
canvas.addEventListener("mousemove", e => {
  if (selectedIndex === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // compute throw velocity
  velocityWhileDragging = { x: x - lastMouse.x, y: y - lastMouse.y };
  lastMouse = { x, y };

  // update locally for smooth dragging
  bodies[selectedIndex].x = x;
  bodies[selectedIndex].y = y;

  // async update to server
  fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index: selectedIndex, x, y })
  }).catch(console.error);

  draw();
});

// Release body (apply throw velocity)
function releaseBody() {
  if (selectedIndex !== null) {
    const throwFactor = 6.0;
    const vx = velocityWhileDragging.x * throwFactor;
    const vy = velocityWhileDragging.y * throwFactor;

    fetch("/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index: selectedIndex,
        x: bodies[selectedIndex].x,
        y: bodies[selectedIndex].y,
        vx,
        vy
      })
    }).catch(console.error);
  }

  selectedIndex = null;
  velocityWhileDragging = { x: 0, y: 0 };
}
canvas.addEventListener("mouseup", releaseBody);
canvas.addEventListener("mouseleave", releaseBody);

// ========================================
// Main Loop (sync with backend simulation)
// ========================================
async function loop() {
  try {
    const res = await fetch("/step");
    let serverBodies = await res.json();

    // override with local drag position if dragging
    if (selectedIndex !== null) {
      serverBodies[selectedIndex].x = bodies[selectedIndex].x;
      serverBodies[selectedIndex].y = bodies[selectedIndex].y;
      serverBodies[selectedIndex].vx = 0;
      serverBodies[selectedIndex].vy = 0;
    }

    bodies = serverBodies;
    draw();
  } catch (e) {
    console.error(e);
  }

  requestAnimationFrame(loop);
}
loop();

// ========================================
// UI Controls: Physics Toggles
// ========================================
const decaySlider = document.getElementById("decaySlider");
const gravitySlider = document.getElementById("gravitySlider");

// Momentum toggle
document.getElementById("toggleDecay").addEventListener("click", async () => {
  const res = await fetch("/toggle_decay", { method: "POST" });
  const data = await res.json();

  document.getElementById("decayState").textContent = data.enabled ? "ON" : "OFF";
  document.getElementById("decayState").style.color = data.enabled ? "lime" : "red";

  decaySlider.disabled = !data.enabled;
});

// Gravity toggle
document.getElementById("toggleGravity").addEventListener("click", async () => {
  const res = await fetch("/toggle_gravity", { method: "POST" });
  const data = await res.json();

  document.getElementById("gravityState").textContent = data.enabled ? "ON" : "OFF";
  document.getElementById("gravityState").style.color = data.enabled ? "lime" : "red";

  gravitySlider.disabled = !data.enabled;
});

// Slider listeners
decaySlider.addEventListener("input", async () => {
  const value = parseFloat(decaySlider.value);
  await fetch("/set_decay_factor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slider: value })
  });
});
gravitySlider.addEventListener("input", async () => {
  const value = parseFloat(gravitySlider.value);
  await fetch("/set_gravity_force", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gravity: value })
  });
});

// Elasticity
const elasticityInput = document.getElementById("elasticityInput");
elasticityInput.addEventListener("input", async () => {
  const value = parseFloat(elasticityInput.value);
  await fetch("/set_elasticity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elasticity: value })
  });
});

// Reset button
document.getElementById("resetBodies").addEventListener("click", async () => {
  await fetch("/reset_bodies", { method: "POST" });
  await fetchBodies();
});

// Initial toggle states from server
async function fetchStatus() {
  const res = await fetch("/status");
  const data = await res.json();

  document.getElementById("decayState").textContent = data.decay ? "ON" : "OFF";
  document.getElementById("decayState").style.color = data.decay ? "lime" : "red";

  document.getElementById("gravityState").textContent = data.gravity ? "ON" : "OFF";
  document.getElementById("gravityState").style.color = data.gravity ? "lime" : "red";
}
fetchStatus();

// ========================================
// Drawing Function
// ========================================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  pulseTime += 0.05;
  const pulse = (Math.sin(pulseTime) + 1) / 2; // range [0..1]

  bodies.forEach((b, i) => {
    // main fill
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = typeColors[b.type] || "#fff";
    ctx.fill();

    // highlight selected body
    if (i === selectedIndex) {
      ctx.save();
      const glowRadius = b.radius + 5 + pulse * 5;
      const gradient = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, glowRadius);
      gradient.addColorStop(0, "rgba(255,255,0,0.8)");
      gradient.addColorStop(1, "rgba(255,255,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(b.x, b.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = "#3cf";
      ctx.lineWidth = 1;
    }

    ctx.stroke();
  });
}

// ========================================
// Spawn Object Button
// ========================================
document.getElementById("spawnObject").addEventListener("click", async () => {
  if (spawnCooldown) {
    alert("Wait before spawning another object!");
    return;
  }

  spawnCooldown = true;
  setTimeout(() => (spawnCooldown = false), SPAWN_COOLDOWN_MS);

  // random position
  let newX = Math.random() * canvas.width;
  let newY = Math.random() * canvas.height;

  // read inputs
  const mass = parseFloat(document.getElementById("massInput").value) || 10;
  const elasticity = parseFloat(elasticityInput.value) || 1.0;
  const size = parseFloat(sizeInput.value) || 10;
  const radius = size * 4;
  const type = document.getElementById("typeSelect").value;

  // prevent spawn overlaps
  bodies.forEach(b => {
    const dx = newX - b.x;
    const dy = newY - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < radius + b.radius) {
      const overlap = radius + b.radius - dist;
      const nx = dx / dist;
      const ny = dy / dist;
      newX += nx * overlap;
      newY += ny * overlap;
    }
  });

  // create locally
  const newBody = { x: newX, y: newY, vx: 0, vy: 0, mass, size, radius, type };
  const newIndex = bodies.length;
  bodies.push(newBody);

  // sync with server
  await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      index: newIndex,
      x: newX,
      y: newY,
      vx: 0,
      vy: 0,
      mass,
      size,
      elasticity,
      type
    })
  });
});