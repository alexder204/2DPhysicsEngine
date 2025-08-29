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

const sizeInput = document.getElementById("sizeInput");

sizeInput.addEventListener("input", async () => {
  if (selectedIndex === null) return;
  const newSize = parseFloat(sizeInput.value);

  bodies[selectedIndex].size = newSize;
  bodies[selectedIndex].radius = newSize * 4;

  // Send to server
  await fetch("/set_size", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index: selectedIndex, size: newSize })
  });

  draw();
});

fetchBodies();

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

  if (selectedIndex !== null) {
    sizeInput.value = bodies[selectedIndex].radius / 4;
  }

  lastMouse = { x: mx, y: my };
  velocityWhileDragging = { x: 0, y: 0 };
});

// --- Mouse Move ---
canvas.addEventListener("mousemove", e => {
  if (selectedIndex === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  velocityWhileDragging = { x: x - lastMouse.x, y: y - lastMouse.y };
  lastMouse = { x, y };

  // Update locally for smooth dragging
  bodies[selectedIndex].x = x;
  bodies[selectedIndex].y = y;

  // Fire-and-forget server update (async, non-blocking)
  fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index: selectedIndex, x, y })
  }).catch(console.error);

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
    let serverBodies = await res.json();

    if (selectedIndex !== null) {
      // Keep the dragged ball at local position
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

const typeColors = {
    normal: "#fff",    // white
    heavy: "#888",     // gray
    bouncy: "#0f0",    // neon green
    sticky: "#f0f",    // neon magenta
    explosive: "#f00", // red
};

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

let pulseTime = 0; // global for glow pulse

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  pulseTime += 0.05; // increase for pulsating effect
  const pulse = (Math.sin(pulseTime) + 1) / 2; // 0 → 1

  bodies.forEach((b, i) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = typeColors[b.type] || "#fff";
    ctx.fill();

    if (i === selectedIndex) {
      // glowing aura
      ctx.save();
      const glowRadius = b.radius + 5 + pulse * 5;
      const gradient = ctx.createRadialGradient(b.x, b.y, b.radius, b.x, b.y, glowRadius);
      gradient.addColorStop(0, `rgba(255,255,0,0.8)`); // bright center
      gradient.addColorStop(1, `rgba(255,255,0,0)`);   // fade out
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
  const elasticity = parseFloat(document.getElementById("elasticityInput").value) || 1.0;
  const size = parseFloat(document.getElementById("sizeInput").value) || 10;
  const radius = size * 4;

  const type = document.getElementById("typeSelect").value;
  
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

  const newBody = { x: newX, y: newY, vx: 0, vy: 0, mass, size, radius: size * 4, type };
  const newIndex = bodies.length;
  bodies.push(newBody);

  await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      index: newIndex,
      x: newX,
      y: newY,
      vx: 0,
      vy: 0,
      mass: mass,
      size: size,
      elasticity: elasticity,
      type: type
    })
  });
});