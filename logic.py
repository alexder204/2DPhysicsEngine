import math
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# --- Gamezone ---
CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

# --- Momentum ---
DECAY_ENABLED = False   
DECAY_FACTOR = 0.99     # <1.0 means lose velocity each step

# --- Gravity ---
GRAVITY_ENABLED = True
GRAVITY_FORCE = 9.8

# --- Elascticity ---
DEFAULT_ELASTICITY = 1.0

# --- Vector Class ---
class Vectors:
    def __init__(self, x=0, y=0):
        self.x, self.y = x, y

    def __add__(self, o):
        return Vectors(self.x + o.x, self.y + o.y)

    def __sub__(self, o):
        return Vectors(self.x - o.x, self.y - o.y)

    def __mul__(self, s):
        return Vectors(self.x * s, self.y * s)

    def __truediv__(self, s):
        return Vectors(self.x / s, self.y / s)

    def magnitude(self):
        return math.hypot(self.x, self.y)

    def normalize(self):
        m = self.magnitude()
        return self / m if m else Vectors(0, 0)

    def dot(self, o):
        return self.x * o.x + self.y * o.y

    def __repr__(self):
        return f"V({self.x:.2f},{self.y:.2f})"

# --- Body Class ---
class Body:
    def __init__(self, position=None, velocity=None, mass=1.0, elasticity=1.0, type="normal", size=None):
        self.position = position or Vectors(0, 0)
        self.velocity = velocity or Vectors(0, 0)
        self.acceleration = Vectors(0, 0)
        self.mass = float(mass)
        self.force = Vectors(0, 0)
        self.size = float(size) if size is not None else self.mass
        self.radius = self.size * 4.0
        self.elasticity = elasticity
        self.type = type

    def apply_force(self, f):
        self.force += f

    def update(self, dt=1.0):
        if self.mass == 0:
            self.acceleration = Vectors(0, 0)
        else:
            self.acceleration = self.force / self.mass
        self.velocity += self.acceleration * dt
        self.position += self.velocity * dt
        self.force = Vectors(0, 0)

    def check_collision(self, other):
        delta = other.position - self.position
        dist = delta.magnitude()
        if dist == 0:
            delta = Vectors(1, 0)
            dist = 1.0

        overlap = (self.radius + other.radius) - dist
        if overlap <= 0:
            return

        n = delta / dist
        t = Vectors(-n.y, n.x)

        total_mass = self.mass + other.mass
        self.position -= n * (overlap * (other.mass / total_mass))
        other.position += n * (overlap * (self.mass / total_mass))

        v1n = self.velocity.dot(n)
        v1t = self.velocity.dot(t)
        v2n = other.velocity.dot(n)
        v2t = other.velocity.dot(t)

        m1, m2 = self.mass, other.mass
        e = (self.elasticity + other.elasticity) / 2.0

        v1n_prime = ((v1n * (m1 - m2) + 2 * m2 * v2n) / (m1 + m2)) * e
        v2n_prime = ((v2n * (m2 - m1) + 2 * m1 * v1n) / (m1 + m2)) * e

        self.velocity = (t * v1t) + (n * v1n_prime)
        other.velocity = (t * v2t) + (n * v2n_prime)

        if self.type == "sticky":
            self.velocity = Vectors(0, 0)
        if other.type == "sticky":
            other.velocity = Vectors(0, 0)

# --- Bodies ---
bodies = []

@app.route("/")
def index():
    return render_template("index.html")

# --- Keep Information On Bodies ---
@app.route("/bodies")
def get_bodies():
    return jsonify([{
        "x": b.position.x,
        "y": b.position.y,
        "mass": b.mass,
        "size": getattr(b, "size", b.radius / 4.0),
        "radius": b.radius,
        "type": b.type
    } for b in bodies])


# --- Moving Bodies ---
@app.route("/move", methods=["POST"])
def move_body():
    data = request.json
    idx = data.get("index")
    x, y = data.get("x"), data.get("y")
    vx, vy = data.get("vx"), data.get("vy")
    mass = data.get("mass", None)
    size = data.get("size", None)
    elasticity = data.get("elasticity", None)

    if idx is not None:
        if 0 <= idx < len(bodies):
            body = bodies[idx]
            if x is not None and y is not None:
                body.position = Vectors(x, y)
            if vx is not None or vy is not None:
                body.velocity = Vectors(vx or 0, vy or 0)
            if "type" in data:
                body.type = data["type"]
            if mass is not None:
                body.mass = float(mass)
            if size is not None:
                body.size = float(size)
                body.radius = body.size * 4.0
            if elasticity is not None:
                body.elasticity = float(elasticity)
        else:
            new_size = float(size) if size is not None else (float(mass) if mass is not None else None)
            new_body = Body(
                position=Vectors(x, y),
                velocity=Vectors(vx or 0, vy or 0),
                mass=(mass if mass is not None else 5),
                elasticity=(elasticity if elasticity is not None else DEFAULT_ELASTICITY),
                type=data.get("type", "normal"),
                size=new_size
            )
            bodies.append(new_body)
    return jsonify(success=True)

# --- Update Frames ---
@app.route("/step")
def step():
    global bodies, GRAVITY_FORCE, DECAY_FACTOR
    dt = 0.1
    min_bounce = 0.01

    # Update bodies
    for b in bodies:
        if GRAVITY_ENABLED:
            gravity_force = GRAVITY_FORCE * b.mass
            if DECAY_ENABLED and b.type == "heavy":
                gravity_force *= 0.7  # heavy falls slower only with momentum loss
            b.apply_force(Vectors(0, gravity_force))

        if b.type == "heavy":
            b.elasticity = 0.2
        if b.type == "bouncy":
            b.elasticity = 1.2  # constant high elasticity
        elif b.type == "sticky":
            b.elasticity = 0  
        else:
            b.elasticity = DEFAULT_ELASTICITY

        # Update physics
        b.update(dt)

        # Apply momentum decay
        if DECAY_ENABLED:
            decay_per_frame = DECAY_FACTOR ** dt
            b.velocity *= decay_per_frame

    for i in range(len(bodies)):
        for j in range(i + 1, len(bodies)):
            bodies[i].check_collision(bodies[j])

    # Keep bodies inside canvas
    for b in bodies:
        r = b.radius

        # Floor
        if b.position.y + r > CANVAS_HEIGHT:
            b.position.y = CANVAS_HEIGHT - r
            if abs(b.velocity.y) > min_bounce:
                b.velocity.y = -b.velocity.y * b.elasticity
            else:
                b.velocity.y = 0

        # Ceiling
        if b.position.y - r < 0:
            b.position.y = r
            if abs(b.velocity.y) > min_bounce:
                b.velocity.y = -b.velocity.y * b.elasticity
            else:
                b.velocity.y = 0

        # Left wall
        if b.position.x - r < 0:
            b.position.x = r
            if b.type == "sticky":
                b.velocity = Vectors(0, 0)
            if abs(b.velocity.x) > min_bounce:
                b.velocity.x = -b.velocity.x * b.elasticity
            else:
                b.velocity.x = 0

        # Right wall
        if b.position.x + r > CANVAS_WIDTH:
            b.position.x = CANVAS_WIDTH - r
            if b.type == "sticky":
                b.velocity = Vectors(0, 0)
            if abs(b.velocity.x) > min_bounce:
                b.velocity.x = -b.velocity.x * b.elasticity
            else:
                b.velocity.x = 0

    # Return updated positions
    return jsonify([{
        "x": b.position.x,
        "y": b.position.y,
        "mass": b.mass,
        "size": getattr(b, "size", b.radius / 4.0),
        "radius": b.radius,
        "type": b.type
    } for b in bodies])

# --- Momentum Toggle Button ---
@app.route("/toggle_decay", methods=["POST"])
def toggle_decay():
    global DECAY_ENABLED
    DECAY_ENABLED = not DECAY_ENABLED
    return jsonify(enabled=DECAY_ENABLED)

# --- Gravity Toggle Button ---
@app.route("/toggle_gravity", methods=["POST"])
def toggle_gravity():
    global GRAVITY_ENABLED
    GRAVITY_ENABLED = not GRAVITY_ENABLED
    return jsonify(enabled=GRAVITY_ENABLED)

# Keep a copy of initial bodies
initial_bodies = [Body(position=Vectors(b.position.x, b.position.y), mass=b.mass, size=getattr(b, "size", b.radius / 4.0)) for b in bodies]

# --- Reset Button ---
@app.route("/reset_bodies", methods=["POST"])
def reset_bodies():
    global bodies
    bodies = [Body(position=Vectors(b.position.x, b.position.y), mass=b.mass, size=getattr(b, "size", b.radius / 4.0)) for b in initial_bodies]
    return jsonify(success=True)

# --- Set Size ---
@app.route("/set_size", methods=["POST"])
def set_size():
    data = request.get_json()
    idx = data.get("index")
    new_size = float(data.get("size", 1.0))

    if idx is not None and 0 <= idx < len(bodies):
        bodies[idx].size = new_size
        bodies[idx].radius = new_size * 4.0

    return jsonify(success=True, size=new_size)

# --- Status Of Buttons ---
@app.route("/status")
def status():
    return jsonify({
        "decay": DECAY_ENABLED,
        "gravity": GRAVITY_ENABLED
    })

# --- Set Decay Factor ---
@app.route("/set_decay_factor", methods=["POST"])
def set_decay_factor():
    global DECAY_FACTOR
    data = request.json
    slider_value = float(data.get("slider", 0))

    # 0 = no decay, 1 = max decay
    DECAY_FACTOR = 1 - slider_value * 0.1  # tweak last number for max per-frame decay

    return jsonify(success=True, factor=DECAY_FACTOR)

# --- Set Gravity Force ---
@app.route("/set_gravity_force", methods=["POST"])
def set_gravity_force():
    global GRAVITY_FORCE
    data = request.json
    GRAVITY_FORCE = float(data.get("gravity", 9.8))
    return jsonify(success=True, gravity=GRAVITY_FORCE)

# --- Set Elasticity ---
@app.route("/set_elasticity", methods=["POST"])
def set_elasticity():
    global DEFAULT_ELASTICITY
    data = request.get_json()
    try:
        new_elasticity = float(data.get("elasticity", 1.0))
        new_elasticity = max(0.0, min(1.0, new_elasticity))
        DEFAULT_ELASTICITY = new_elasticity
        return jsonify({"status": "ok", "default_elasticity": DEFAULT_ELASTICITY})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True)