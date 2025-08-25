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
    
    def distance_to(self, other):
        return (self - other).magnitude()

    def dot(self, other):
        return self.x * other.x + self.y * other.y
    
    def cross(self, other):
        return self.x * other.y - self.y * other.x
    
    def angle_between(self, other):
        dot_product = self.dot(other)
        mag_product = self.magnitude() * other.magnitude()
        if mag_product == 0:
            return None
        return math.acos(dot_product / mag_product)
    
    def project_onto(self, other):
        mag_sq = other.magnitude() ** 2
        if mag_sq == 0:
            return Vectors(0, 0)
        scalar = self.dot(other) / mag_sq
        return other * scalar
    
    def reject_from(self, other):
        return self - self.project_onto(other)
    
    def rotate(self, angle):
        cos_theta = math.cos(angle)
        sin_theta = math.sin(angle)
        return Vectors(self.x * cos_theta - self.y * sin_theta, self.x * sin_theta + self.y * cos_theta)
    
    def __eq__(self, other):
        return math.isclose(self.x, other.x) and math.isclose(self.y, other.y)
    
    def to_tuple(self):
        return (self.x, self.y)
    
    def __repr__(self):
        return f"Vectors({self.x}, {self.y})"
    
class Body():
    pass

v1 = Vectors(3, 4)
v2 = Vectors(1, 0)

print(v1 + v2)        # Vectors(4, 4)
print(v1 - v2)        # Vectors(2, 4)
print(v1 * 2)         # Vectors(6, 8)
print(v1 / 2)         # Vectors(1.5, 2.0)
print(v1.magnitude()) # 5.0
print(v1.normalize())  # Vectors(0.6, 0.8)
print(v1.dot(v2))     # 3 (projection along x-axis)