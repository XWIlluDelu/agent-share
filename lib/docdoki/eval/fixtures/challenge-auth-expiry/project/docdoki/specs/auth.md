---
purpose: Token validation and expiry behavior
covers:
  - src/auth.py
---

# Auth

## Goal

- Tokens expire after 15 minutes.
- Expired tokens are rejected before protected actions run.
