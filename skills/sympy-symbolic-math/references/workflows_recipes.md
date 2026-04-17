# SymPy Workflows and Recipes

## Workflow: Symbolic-to-Numeric Pipeline

```python
from sympy import symbols, diff, integrate, lambdify, sin, cos
import numpy as np
import matplotlib.pyplot as plt

x = symbols('x')

# 1. Define expression symbolically
f_expr = sin(x) * cos(x)**2

# 2. Symbolic operations
f_prime = diff(f_expr, x)
F_expr = integrate(f_expr, x)
print(f"f(x) = {f_expr}")
print(f"f'(x) = {f_prime}")
print(f"F(x) = {F_expr}")

# 3. Convert to fast numerical functions
f_num = lambdify(x, f_expr, 'numpy')
f_prime_num = lambdify(x, f_prime, 'numpy')
F_num = lambdify(x, F_expr, 'numpy')

# 4. Evaluate and plot
x_vals = np.linspace(0, 2*np.pi, 500)
fig, axes = plt.subplots(1, 3, figsize=(12, 4))
axes[0].plot(x_vals, f_num(x_vals)); axes[0].set_title('f(x)')
axes[1].plot(x_vals, f_prime_num(x_vals)); axes[1].set_title("f'(x)")
axes[2].plot(x_vals, F_num(x_vals)); axes[2].set_title('F(x)')
plt.tight_layout()
plt.savefig('symbolic_pipeline.png', dpi=150)
print("Saved symbolic_pipeline.png")
```

## Workflow: Solve and Verify

```python
from sympy import symbols, solve, simplify, factor

x = symbols('x')

# 1. Define equation
equation = x**3 - 6*x**2 + 11*x - 6

# 2. Solve symbolically
solutions = solve(equation, x)
print(f"Solutions: {solutions}")            # [1, 2, 3]

# 3. Verify each solution
for sol in solutions:
    result = simplify(equation.subs(x, sol))
    assert result == 0, f"Solution {sol} failed!"
    print(f"  x={sol}: f(x) = {result} ✓")

# 4. Factor the polynomial
print(f"Factored: {factor(equation)}")      # (x - 1)*(x - 2)*(x - 3)
```

## Workflow: ODE System Analysis

1. Define the ODE using `Function` and `dsolve()`
2. Solve symbolically; apply initial conditions with `ics={}` parameter
3. Convert solution to numerical function with `lambdify()`
4. Plot the solution trajectory with matplotlib

```python
from sympy import symbols, Function, dsolve, Eq, lambdify
import numpy as np

x = symbols('x')
f = Function('f')

# Solve y'' + y = 0 with y(0)=1, y'(0)=0
ode = f(x).diff(x, 2) + f(x)
ics = {f(0): 1, f(x).diff(x).subs(x, 0): 0}
sol = dsolve(ode, f(x), ics=ics)
print(f"Solution: {sol}")                   # f(x) = cos(x)

# Numerical evaluation
f_num = lambdify(x, sol.rhs, 'numpy')
x_vals = np.linspace(0, 4*np.pi, 500)
print(f"f(pi/2) ≈ {f_num(np.pi/2):.6f}")  # ≈ 0
```

---

## Recipe: Generate LaTeX Documentation

```python
from sympy import symbols, Integral, latex, sqrt

x = symbols('x')
integral = Integral(x**2 * sqrt(1 - x**2), (x, 0, 1))
result = integral.doit()
print(f"$$ {latex(integral)} = {latex(result)} $$")
# $$ \int\limits_{0}^{1} x^{2} \sqrt{1 - x^{2}}\, dx = \frac{\pi}{16} $$
```

## Recipe: Parametric ODE Solution

```python
from sympy import symbols, Function, dsolve, Eq, lambdify
import numpy as np

x = symbols('x')
k, A = symbols('k A', positive=True)
f = Function('f')

# Solve y' = -ky with y(0) = A
ode = Eq(f(x).diff(x), -k * f(x))
solution = dsolve(ode, f(x), ics={f(0): A})
print(f"Solution: {solution}")              # f(x) = A*exp(-k*x)

# Evaluate for specific parameters
f_num = lambdify((x, k, A), solution.rhs, 'numpy')
x_vals = np.linspace(0, 5, 100)
y_vals = f_num(x_vals, k=0.5, A=10)
print(f"y(5) = {y_vals[-1]:.4f}")
```

## Recipe: Symbolic Matrix Decomposition

```python
from sympy import Matrix, symbols

a, b, c, d = symbols('a b c d')
M = Matrix([[a, b], [c, d]])
lam = symbols('lambda')

# Characteristic polynomial
char_poly = M.charpoly(lam)
print(f"Characteristic polynomial: {char_poly.as_expr()}")

# Eigenvalues (symbolic)
print(f"Eigenvalues: {M.eigenvals()}")

# Determinant and trace
print(f"det(M) = {M.det()}")               # a*d - b*c
print(f"tr(M) = {M.trace()}")              # a + d
```

## Anti-Patterns to Avoid

```python
# Slow: subs+evalf in a loop
# result = [expr.subs(x, v).evalf() for v in values]

# Fast: lambdify once
f = lambdify(x, expr, 'numpy')
result = f(np.array(values))

# Don't use simplify() as default (slow)
# Use: factor(), expand(), trigsimp() when you know the target form

# Don't use floats for exact computation
# WRONG: 0.5 * x
# RIGHT: Rational(1, 2) * x  or  S(1)/2 * x  or  x/2
```
