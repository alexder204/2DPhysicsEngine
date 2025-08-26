const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
// canvas is fixed 800x600 to match server bounds

let bodies = [];
let selectedIndex = null;
let lastMouse = { x: 0, y: 0 };
let velocityWhileDragging = { x: 0, y: 0 };

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  bodies.forEach((b, i) => {
    // filled circle
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();

    // thin physics outline to visualize exact collision size
    ctx.strokeStyle = "#3cf";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (i === selectedIndex) {
      // highlight when dragging
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  selectedIndex = null;
  // pick the topmost first that contains mouse
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    const dx = b.x - mx, dy = b.y - my;
    if (dx * dx + dy * dy <= b.radius * b.radius) {
      selectedIndex = i;
      break;
    }
  }
  lastMouse = { x: mx, y: my };
  velocityWhileDragging = { x: 0, y: 0 };
});

canvas.addEventListener("mousemove", async (e) => {
  if (selectedIndex === null) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  velocityWhileDragging = { x: x - lastMouse.x, y: y - lastMouse.y };
  lastMouse = { x, y };

  // Move locally for immediate feedback
  bodies[selectedIndex].x = x;
  bodies[selectedIndex].y = y;

  // Tell server we are dragging (velocity kept zero while dragging)
  await fetch("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ index: selectedIndex, x, y })
  });

  draw();
});

canvas.addEventListener("mouseup", async () => {
  if (selectedIndex !== null) {
    // throw velocity (tweak factor to taste)
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

// Sim loop: step the server and use returned positions (no extra /bodies call)
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