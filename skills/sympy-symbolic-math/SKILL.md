---
name: sympy-symbolic-math
description: "Symbolic mathematics in Python: exact algebra, calculus (derivatives, integrals, limits), equation solving, symbolic matrices, differential equations, code generation (lambdify, C/Fortran). Use when exact symbolic results are needed, not numerical approximations. For numerical computing use numpy/scipy; for statistical modeling use statsmodels."
license: BSD-3-Clause
---

# SymPy — Symbolic Mathematics

## Overview

SymPy is a Python library for exact symbolic computation using mathematical symbols. Covers algebra, calculus, equation solving, linear algebra, physics, and code generation — pure Python, no external dependencies.

## When to Use

- Solving equations symbolically (algebraic, systems, differential equations)
- Calculus operations (derivatives, integrals, limits, series expansions)
- Simplifying and manipulating algebraic expressions
- Matrix operations symbolically (eigenvalues, determinants, decompositions)
- Converting symbolic expressions to fast numerical functions (`lambdify → NumPy`)
- Generating code from math expressions (C, Fortran, LaTeX)
- Needing exact results (e.g., `sqrt(2)` not `1.414...`)
- For **numerical computing** (array operations on data), use numpy/scipy
- For **statistical modeling** (regression, hypothesis testing), use statsmodels

## Prerequisites

```bash
pip install sympy
pip install numpy matplotlib  # optional, for lambdify and plotting
```

## Quick Start

```python
from sympy import symbols, solve, diff, integrate, sqrt, pi

x = symbols('x')
print(solve(x**2 - 5*x + 6, x))          # [2, 3]
print(diff(x**3 + 2*x, x))                # 3*x**2 + 2
print(integrate(x**2, (x, 0, 1)))         # 1/3
print(sqrt(8))                              # 2*sqrt(2)
print(pi.evalf(30))                        # 30 digits of pi
```

## API Reference and Workflows

For complete code examples across all domains:
- **[references/api_reference.md](references/api_reference.md)** — Symbols/expressions, calculus, equation solving, matrices, code generation, physics module
- **[references/workflows_recipes.md](references/workflows_recipes.md)** — Symbolic-to-numeric pipeline, solve-and-verify workflow, ODE analysis, LaTeX generation, parametric ODE, matrix decomposition

## Key Concepts

### Solver Selection Guide

| Solver | Use When | Returns |
|--------|----------|---------|
| `solve(eq, x)` | General purpose (legacy) | List of solutions |
| `solveset(eq, x, domain)` | Algebraic equations (preferred) | Set (may be infinite) |
| `linsolve(system, vars)` | Linear systems | FiniteSet of tuples |
| `nonlinsolve(system, vars)` | Nonlinear systems | FiniteSet of tuples |
| `dsolve(ode, f(x))` | Ordinary differential equations | Equality (Eq) |
| `nsolve(eq, x0)` | Numerical root finding | Float approximation |

### Common Simplification Functions

| Function | Does | Example |
|----------|------|---------|
| `simplify()` | General simplification (slow, tries everything) | `sin(x)**2 + cos(x)**2` → `1` |
| `expand()` | Distribute multiplication | `(x+1)**2` → `x**2+2*x+1` |
| `factor()` | Factor into irreducibles | `x**2-1` → `(x-1)*(x+1)` |
| `collect()` | Group by variable | Collect terms in `x` |
| `cancel()` | Cancel common factors in fractions | `(x**2-1)/(x-1)` → `x+1` |
| `trigsimp()` | Simplify trig (faster than `simplify`) | Trig identities |
| `powsimp()` | Simplify powers/exponentials | Combine `x**a * x**b` |

## Key Parameters

| Parameter | Function | Default | Options | Effect |
|-----------|----------|---------|---------|--------|
| `domain` | `solveset()` | `S.Complexes` | `S.Reals`, `S.Integers` | Restrict solution domain |
| `force` | `simplify()` | False | True/False | Aggressive simplification |
| `n` | `diff(expr, x, n)` | 1 | 1–∞ | Order of derivative |
| Precision | `evalf(n)` | 15 | 1–1000+ | Digits of numerical precision |
| Backend | `lambdify()` | "math" | "numpy", "scipy", "mpmath" | Numerical backend |
| `rational` | `nsimplify()` | True | True/False | Find exact rational approximation |

## Best Practices

1. **Always use `Rational()` or `S()` for fractions**: `0.5 * x` introduces floats that break exact computation. Use `Rational(1, 2) * x` or `S(1)/2 * x`.
2. **Add assumptions to symbols**: `symbols('x', positive=True)` enables `sqrt(x**2) → x`; without assumptions SymPy handles the general complex case.
3. **Use `lambdify` not `subs().evalf()` loops**: `lambdify` is 100–1000× faster for vectorized evaluation.
4. **Use specific simplification functions**: `simplify()` is slow; use `factor`, `expand`, `trigsimp` when you know the target form.
5. **Prefer `solveset` over `solve`**: returns proper mathematical sets and handles edge cases better.
6. **Use `nsolve` when no closed form**: avoids waiting for `solve` to fail.
7. **Use `init_printing()` in Jupyter**: enables LaTeX rendering in notebooks.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `NameError: name 'x' is not defined` | Symbol not created | `x = symbols('x')` before use |
| Unexpected float results | Using `0.5` instead of `Rational(1,2)` | Use `Rational()` or `S()` |
| `simplify()` very slow | Tries all strategies on complex expr | Use `factor()`, `expand()`, `trigsimp()` |
| `solve()` returns empty list | No closed-form solution | Use `nsolve(eq, x0)` |
| `sqrt(x**2)` returns `sqrt(x**2)` | No assumption on `x` | `x = symbols('x', positive=True)` |
| `lambdify` wrong results | SymPy-specific functions | Specify backend: `lambdify(x, expr, 'numpy')` |
| `NotImplementedError` in `dsolve` | ODE type not supported | Use `scipy.integrate.odeint` instead |

## References

- [SymPy documentation](https://docs.sympy.org/)
- [SymPy tutorial](https://docs.sympy.org/latest/tutorials/intro-tutorial/index.html)
- Meurer et al. (2017) "SymPy: symbolic computing in Python" — [PeerJ CS](https://doi.org/10.7717/peerj-cs.103)
