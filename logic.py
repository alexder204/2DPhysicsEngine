import math
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600

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

class Body:
    def __init__(self, position=None, velocity=None, mass=1.0):
        self.position = position or Vectors(0, 0)
        self.velocity = velocity or Vectors(0, 0)
        self.acceleration = Vectors(0, 0)
        self.mass = float(mass)
        self.force = Vectors(0, 0)
        self.radius = self.mass * 4.0

    def apply_force(self, f): self.force += f

    def update(self, dt=1.0):
        self.acceleration = self.force / self.mass
        self.velocity += self.acceleration * dt
        self.position += self.velocity * dt
        self.force = Vectors(0, 0)

    def tech_with_tim_resolve(self, other):
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
        v1n_prime = (v1n * (m1 - m2) + 2 * m2 * v2n) / (m1 + m2)
        v2n_prime = (v2n * (m2 - m1) + 2 * m1 * v1n) / (m1 + m2)

        self.velocity = (t * v1t) + (n * v1n_prime)
        other.velocity = (t * v2t) + (n * v2n_prime)

bodies = [
    Body(position=Vectors(200, 200), mass=8),
    Body(position=Vectors(400, 300), mass=6),
    Body(position=Vectors(600, 150), mass=4),
]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/bodies")
def get_bodies():
    return jsonify([{
        "x": b.position.x,
        "y": b.position.y,
        "mass": b.mass,
        "radius": b.radius
    } for b in bodies])

@app.route("/move", methods=["POST"])
def move_body():
    data = request.json
    idx = data.get("index")
    x, y = data.get("x"), data.get("y")
    vx, vy = data.get("vx"), data.get("vy")
    if idx is not None and 0 <= idx < len(bodies):
        bodies[idx].position = Vectors(x, y)
        if vx is not None and vy is not None:
            bodies[idx].velocity = Vectors(vx, vy)
        else:
            bodies[idx].velocity = Vectors(0, 0)
    return jsonify(success=True)

@app.route("/step")
def step():
    dt = 0.1
    G = 50.0

    for i, a in enumerate(bodies):
        for j, b in enumerate(bodies):
            if i == j: continue
            r_vec = b.position - a.position
            dist = max(r_vec.magnitude(), 5.0)
            force_mag = G * a.mass * b.mass / (dist * dist)
            a.apply_force(r_vec.normalize() * force_mag)

    for b in bodies:
        b.update(dt)

    for i in range(len(bodies)):
        for j in range(i + 1, len(bodies)):
            bodies[i].tech_with_tim_resolve(bodies[j])

    for b in bodies:
        r = b.radius
        if b.position.x - r < 0:
            b.position.x = r; b.velocity.x *= -1
        if b.position.x + r > CANVAS_WIDTH:
            b.position.x = CANVAS_WIDTH - r; b.velocity.x *= -1
        if b.position.y - r < 0:
            b.position.y = r; b.velocity.y *= -1
        if b.position.y + r > CANVAS_HEIGHT:
            b.position.y = CANVAS_HEIGHT - r; b.velocity.y *= -1

    return jsonify([{
        "x": b.position.x,
        "y": b.position.y,
        "mass": b.mass,
        "radius": b.radius
    } for b in bodies])

if __name__ == "__main__":
    app.run(debug=True)