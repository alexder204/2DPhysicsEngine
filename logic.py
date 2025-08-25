import math

class Vectors:
    def __init__(self, x=0, y=0):
        self.x = x
        self.y = y
    
    def __add__(self, other):
        return Vectors(self.x + other.x, self.y + other.y)
    
    def __sub__(self, other):
        return Vectors(self.x - other.x, self.y - other.y)
    
    def __mul__(self, scalar):
        return Vectors(self.x * scalar, self.y * scalar)
    
    def __truediv__(self, scalar):
        return Vectors(self.x / scalar, self.y / scalar)
    
    def magnitude(self):
        return math.sqrt(self.x ** 2 + self.y ** 2)
    
    def normalize(self):
        mag = self.magnitude()
        normalized = self / mag
        if mag == 0:
            normalized = Vectors(0, 0)
        return normalized

    def dot(self, other):
        return self.x * other.x + self.y * other.y
    
    def __repr__(self):
        return f"Vectors({self.x}, {self.y})"

v1 = Vectors(3, 4)
v2 = Vectors(1, 0)

print(v1 + v2)        # Vectors(4, 4)
print(v1 - v2)        # Vectors(2, 4)
print(v1 * 2)         # Vectors(6, 8)
print(v1 / 2)         # Vectors(1.5, 2.0)
print(v1.magnitude()) # 5.0
print(v1.normalize())  # Vectors(0.6, 0.8)
print(v1.dot(v2))     # 3 (projection along x-axis)