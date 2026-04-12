# SymPy Core API Reference

## 1. Symbols and Expressions

```python
from sympy import symbols, Symbol, Rational, S, oo, pi, E, I
from sympy import simplify, expand, factor, collect, cancel, trigsimp

# Define symbols
x, y, z = symbols('x y z')

# With assumptions (improves simplification)
n = symbols('n', integer=True)
t = symbols('t', positive=True, real=True)
from sympy import sqrt
print(sqrt(t**2))   # t (not Abs(t), because t is positive)

# Exact fractions (avoid floats!)
expr = Rational(1, 3) * x + S(1)/7
print(expr)  # x/3 + 1/7

# Simplification
print(simplify(x**2 + 2*x + 1))          # (x + 1)**2
print(expand((x + 1)**3))                 # x**3 + 3*x**2 + 3*x + 1
print(factor(x**3 - x))                   # x*(x - 1)*(x + 1)
print(collect(x*y + x - 3 + 2*x**2 - z*x**2, x))  # x**2*(2 - z) + x*(y + 1) - 3
```

## 2. Calculus

```python
from sympy import symbols, diff, integrate, limit, series, oo, sin, cos, exp, log

x = symbols('x')

# Derivatives
print(diff(sin(x**2), x))                 # 2*x*cos(x**2)
print(diff(x**4, x, 3))                   # 24*x (third derivative)

# Partial derivatives
x, y = symbols('x y')
f = x**2 * y**3
print(diff(f, x, y))                      # 6*x*y**2

# Integrals
x = symbols('x')
print(integrate(x**2, x))                 # x**3/3 (indefinite)
print(integrate(exp(-x**2), (x, -oo, oo)))  # sqrt(pi) (Gaussian)
print(integrate(x * exp(-x), (x, 0, oo)))  # 1

# Limits
print(limit(sin(x)/x, x, 0))             # 1
print(limit((1 + 1/x)**x, x, oo))        # E

# Taylor series
print(series(exp(x), x, 0, 5))           # 1 + x + x**2/2 + x**3/6 + x**4/24 + O(x**5)
```

## 3. Equation Solving

```python
from sympy import symbols, solve, solveset, Eq, S, linsolve, nonlinsolve, Function, dsolve

x, y = symbols('x y')

# Single equation
print(solve(x**2 - 4, x))                 # [-2, 2]
print(solveset(x**2 - 4, x, S.Reals))     # {-2, 2}

# System of linear equations
print(linsolve([x + y - 5, 2*x - y - 1], x, y))  # {(2, 3)}

# System of nonlinear equations
print(nonlinsolve([x**2 + y - 4, x + y**2 - 4], x, y))

# Differential equation: y'' + y = 0
f = Function('f')
ode = f(x).diff(x, 2) + f(x)
print(dsolve(ode, f(x)))                  # Eq(f(x), C1*sin(x) + C2*cos(x))

# With initial conditions
ics = {f(0): 1, f(x).diff(x).subs(x, 0): 0}
print(dsolve(ode, f(x), ics=ics))         # Eq(f(x), cos(x))
```

## 4. Matrices and Linear Algebra

```python
from sympy import Matrix, symbols

# Create matrix
M = Matrix([[1, 2], [3, 4]])
print(f"Det: {M.det()}")                   # -2
print(f"Inverse:\n{M**-1}")

# Symbolic matrices
a, b = symbols('a b')
M = Matrix([[a, b], [b, a]])
print(f"Eigenvalues: {M.eigenvals()}")     # {a - b: 1, a + b: 1}

# Eigenvectors and diagonalization
eigendata = M.eigenvects()
P, D = M.diagonalize()

# Solve linear system Ax = b
A = Matrix([[1, 2], [3, 4]])
b_vec = Matrix([5, 6])
x = A.solve(b_vec)
print(f"Solution: {x.T}")

# Matrix calculus
t = symbols('t')
M_t = Matrix([[t, t**2], [1, t]])
print(f"dM/dt:\n{M_t.diff(t)}")
```

## 5. Code Generation

```python
import numpy as np
from sympy import symbols, lambdify, sin, exp, ccode, fcode, latex

x, y = symbols('x y')
expr = sin(x) * exp(-x**2 / 2)

# lambdify: symbolic → fast NumPy function
f = lambdify(x, expr, 'numpy')
x_vals = np.linspace(-5, 5, 1000)
y_vals = f(x_vals)
print(f"Shape: {y_vals.shape}, Max: {y_vals.max():.4f}")

# Multi-variable lambdify
expr2 = x**2 + y**2
f2 = lambdify((x, y), expr2, 'numpy')
print(f"f(3, 4) = {f2(3, 4)}")            # 25

# C code generation
print(ccode(expr))                          # sin(x)*exp(-1.0/2.0*pow(x, 2))

# Fortran code generation
print(fcode(expr))

# LaTeX output
print(latex(expr))                          # \sin{\left(x \right)} e^{- \frac{x^{2}}{2}}
```

## 6. Physics Module

```python
from sympy import symbols, Rational, cos, Function
from sympy.physics.mechanics import dynamicsymbols, LagrangesMethod, ReferenceFrame
from sympy.physics.vector import dot, cross

# Vector analysis
N = ReferenceFrame('N')
v1 = 3*N.x + 4*N.y + 0*N.z
v2 = 1*N.x + 0*N.y + 2*N.z
print(f"Dot: {dot(v1, v2)}")               # 3
print(f"Cross: {cross(v1, v2)}")            # 8*N.x - 6*N.y - 4*N.z

# Simple pendulum via Lagrangian mechanics
q = dynamicsymbols('q')       # Generalized coordinate (angle)
m, g, l = symbols('m g l', positive=True)
T = Rational(1, 2) * m * (l * q.diff())**2          # Kinetic energy
V = m * g * l * (1 - cos(q))                         # Potential energy
L = T - V                                            # Lagrangian
print(f"Lagrangian: {L}")
```

## Exact vs Numerical Arithmetic

```python
from sympy import Rational, S, sqrt, pi

# WRONG: introduces floating-point error
expr_bad = 0.5 * x           # Float 0.5, loses exactness

# CORRECT: exact symbolic arithmetic
expr_good = Rational(1, 2) * x    # Exact 1/2
expr_good = S(1)/2 * x            # Alternative
expr_good = x / 2                  # Also exact

# Numerical evaluation when needed
print(sqrt(2).evalf())         # 1.41421356237310
print(pi.evalf(50))            # 50 digits of precision
```
