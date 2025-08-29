const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// ---- Constants ----
const SPAWN_COOLDOWN_MS = 0; // 2000 ms = 2 second cooldown

// ---- State ----
let bodies = [];
let initialBodies = [];
let selectedIndex = null;
let lastMouse = { x: 0, y: 0 };
let velocityWhileDragging = { x: 0, y: 0 };
let spawnCooldown = false;

// ---- Fetch and initialize ----
async function fetchBodies() {
  const res = await fetch("/bodies");
  bodies = await res.json();

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

// ---- Drawing ----
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  bodies.forEach((b, i) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    ctx.strokeStyle = i === selectedIndex ? "yellow" : "#3cf";
    ctx.lineWidth = i === selectedIndex ? 2 : 1;
    ctx.stroke();
  });
}

// ---- Mouse Click ----
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

  lastMouse = { x: mx, y: my };
  velocityWhileDragging = { x: 0, y: 0 };
});

// --- Mouse Move ---
canvas.addEventListener("mousemove", async e => {
  if (selectedIndex === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  velocityWhileDragging = { x: x - lastMouse.x, y: y - lastMouse.y };
  lastMouse = { x, y };

  bodies[selectedIndex].x = x;
  bodies[selectedIndex].y = y;

  await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index: selectedIndex, x, y })
  });

  draw();
});

// --- Mouse Unclick ---
canvas.addEventListener("mouseup", async () => {
  if (selectedIndex !== null) {
    const throwFactor = 6.0;
    const vx = velocityWhileDragging.x * throwFactor;
    const vy = velocityWhileDragging.y * throwFactor;

    await fetch("/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index: selectedIndex,
        x: bodies[selectedIndex].x,
        y: bodies[selectedIndex].y,
        vx,
        vy
      })
    });
  }
  selectedIndex = null;
  velocityWhileDragging = { x: 0, y: 0 };
});

// ---- Mouse leave ----
canvas.addEventListener("mouseleave", async () => {
  if (selectedIndex !== null) {
    const throwFactor = 6.0;
    const vx = velocityWhileDragging.x * throwFactor;
    const vy = velocityWhileDragging.y * throwFactor;

    await fetch("/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index: selectedIndex,
        x: bodies[selectedIndex].x,
        y: bodies[selectedIndex].y,
        vx,
        vy
      })
    });
  }
  selectedIndex = null;
  velocityWhileDragging = { x: 0, y: 0 };
});

// ---- Main loop ----
async function loop() {
  try {
    const res = await fetch("/step");
    bodies = await res.json();
    draw();
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(loop);
}

loop();

// ---- Momentum Button ----
const decaySlider = document.getElementById("decaySlider");
document.getElementById("toggleDecay").addEventListener("click", async () => {
  const res = await fetch("/toggle_decay", { method: "POST" });
  const data = await res.json();

  document.getElementById("decayState").textContent = data.enabled ? "ON" : "OFF";
  document.getElementById("decayState").style.color = data.enabled ? "lime" : "red";

  // Enable/disable slider
  decaySlider.disabled = !data.enabled;
});

// ---- Gravity Button ----
const gravitySlider = document.getElementById("gravitySlider");
document.getElementById("toggleGravity").addEventListener("click", async () => {
  const res = await fetch("/toggle_gravity", { method: "POST" });
  const data = await res.json();

  document.getElementById("gravityState").textContent = data.enabled ? "ON" : "OFF";
  document.getElementById("gravityState").style.color = data.enabled ? "lime" : "red";

  // Enable/disable slider
  gravitySlider.disabled = !data.enabled;
});

// ---- Slider change listeners ----
decaySlider.addEventListener("input", async () => {
  const value = parseFloat(decaySlider.value);
  await fetch("/set_decay_factor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ factor: value })
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

const elasticityInput = document.getElementById("elasticityInput");
elasticityInput.addEventListener("input", async () => {
  const value = parseFloat(elasticityInput.value);
  await fetch("/set_elasticity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ elasticity: value })
  });
});

// --- Reset Button ---
document.getElementById("resetBodies").addEventListener("click", async () => {
  await fetch("/reset_bodies", { method: "POST" });
  await fetchBodies();  // reload bodies from server
});

// --- Status Of Buttons ---
async function fetchStatus() {
  const res = await fetch("/status");
  const data = await res.json();

  document.getElementById("decayState").textContent = data.decay ? "ON" : "OFF";
  document.getElementById("decayState").style.color = data.decay ? "lime" : "red";

  document.getElementById("gravityState").textContent = data.gravity ? "ON" : "OFF";
  document.getElementById("gravityState").style.color = data.gravity ? "lime" : "red";
}
fetchStatus();

// ---- Spawn object button ----
document.getElementById("spawnObject").addEventListener("click", async () => {
  if (spawnCooldown) {
    alert("Wait before spawning another object!");
    return;
  }

  spawnCooldown = true;
  setTimeout(() => (spawnCooldown = false), SPAWN_COOLDOWN_MS);

  let newX = Math.random() * canvas.width;
  let newY = Math.random() * canvas.height;
  const massInput = document.getElementById("massInput");
  const mass = parseFloat(massInput.value) || 10; // default to 10 if input invalid
  const radius = mass * 4;

  // Push out of overlaps
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

  const newBody = { x: newX, y: newY, vx: 0, vy: 0, mass, radius };
  bodies.push(newBody);

  await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      index: bodies.length - 1,
      x: newX,
      y: newY,
      vx: 0,
      vy: 0,
      mass: mass
    })
  });

  draw();
});
