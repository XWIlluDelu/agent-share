# Core eval

This directory is a regression seed for the prompt-first skill. It does not call an
LLM. `cases.json` defines the routing and protocol cases that an external runner such
as promptfoo or LangSmith can execute later; `selftest.py` verifies that the eval set
stays structurally useful and that concrete fixtures still encode the drift their
golden files claim.

Run:

```sh
python3 eval/selftest.py
```

Passing this test means the eval harness is intact. It does not prove that an agent
executes the protocols correctly; that requires running the cases against one or more
agent models and grading the outputs against the checks in `cases.json` and `golden/`.
