# Description Optimization (4 Steps)

The description field in SKILL.md frontmatter is the primary mechanism that determines whether an agent invokes a skill. After creating or improving a skill, offer to optimize it.

## Step 1: Generate Trigger Eval Queries

Create 20 eval queries — a mix of should-trigger and should-not-trigger. Save as JSON:

```json
[
  {"query": "the user prompt", "should_trigger": true},
  {"query": "another prompt", "should_trigger": false}
]
```

Queries must be realistic and specific — include file paths, personal context, column names, company names, casual phrasing, and enough detail that the agent would actually benefit from a skill.

**Bad:** `"Format this data"`, `"Extract text from PDF"`, `"Create a chart"`

**Good:** `"ok so my boss just sent me this xlsx file (its in my downloads, called something like 'Q4 sales final FINAL v2.xlsx') and she wants me to add a column that shows the profit margin as a percentage"`

**For should-trigger (8-10 queries):** Cover different phrasings — formal, casual, uncommon use cases, and cases where this skill competes with another but should win.

**For should-not-trigger (8-10 queries):** Focus on near-misses — queries sharing keywords but needing something different. Don't use obviously irrelevant queries; they don't test anything.

## Step 2: Review with User

Present the eval set using the HTML template:
1. Read `assets/eval_review.html`
2. Replace `__EVAL_DATA_PLACEHOLDER__` with the JSON array
3. Replace `__SKILL_NAME_PLACEHOLDER__` and `__SKILL_DESCRIPTION_PLACEHOLDER__`
4. Write to `/tmp/eval_review_<skill-name>.html` and open it
5. User can edit, toggle, add/remove queries, then click "Export Eval Set"

## Step 3: Run the Optimization Loop

```bash
python -m scripts.run_loop \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model <model-id-powering-this-session> \
  --max-iterations 5 \
  --verbose
```

With explicit runtime (for codex/gemini backends):
```bash
python -m scripts.run_loop \
  --runtime codex \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model gpt-5.4 \
  --max-iterations 5 \
  --verbose
```

The script runs automatically: 60/40 train/test split, 3 runs per query for reliability, evaluates up to 5 iterations, returns `best_description` selected by test score (not train score, to avoid overfitting).

Periodically tail the output to give the user progress updates.

## Step 4: Apply the Result

Take `best_description` from the JSON output and update the skill's SKILL.md frontmatter. Show the user before/after and report the scores.

---

## How Triggering Works

Agents consult skills based on name and description. They typically invoke skills only when the base toolset is insufficient. Simple one-step queries (e.g., "read this PDF") may not trigger a skill even with a perfect description — because the base agent can handle them alone. Complex, multi-step, or specialized queries are more diagnostic.

This means eval queries should be substantive enough that the agent would actually benefit from consulting a skill. Simple queries are poor test cases.
