# Evaluation Workflow (5 Steps)

This is one continuous sequence — don't stop partway through. Do NOT use `/skill-test` or any other testing skill.

Put results in `<skill-name>-workspace/` as a sibling to the skill directory. Within the workspace, organize by iteration (`iteration-1/`, `iteration-2/`) and within that, by test case (`eval-0/`, `eval-1/`). Don't create all directories upfront — create as you go.

## Step 1: Spawn All Runs in the Same Turn

For each test case, spawn two subagents in the **same turn** — one with-skill, one baseline. Don't do with-skill first and come back for baselines later.

**With-skill run:**
```
Execute this task:
- Skill path: <path-to-skill>
- Task: <eval prompt>
- Input files: <eval files if any, or "none">
- Save outputs to: <workspace>/iteration-<N>/eval-<ID>/with_skill/outputs/
- Outputs to save: <what the user cares about>
```

**Baseline run** (same prompt, different context):
- **New skill**: no skill at all → save to `without_skill/outputs/`
- **Improving existing skill**: snapshot the old skill first (`cp -r <skill-path> <workspace>/skill-snapshot/`), point baseline at snapshot → save to `old_skill/outputs/`

Write `eval_metadata.json` for each test case:
```json
{
  "eval_id": 0,
  "eval_name": "descriptive-name-here",
  "prompt": "The user's task prompt",
  "assertions": []
}
```

## Step 2: Draft Assertions While Runs Are In Progress

Don't wait — use this time productively. Draft quantitative assertions for each test case and explain them to the user. Update `eval_metadata.json` files and `evals/evals.json` with assertions once drafted.

Good assertions are objectively verifiable and have descriptive names. Subjective skills (writing style, design) are better evaluated qualitatively.

## Step 3: Capture Timing Data As Runs Complete

When each subagent task completes, you receive a notification with `total_tokens` and `duration_ms`. Save immediately to `timing.json` in the run directory:

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

This is the only opportunity to capture this data.

## Step 4: Grade, Aggregate, and Launch Viewer

1. **Grade each run** — spawn a grader subagent that reads `agents/grader.md` and evaluates assertions against outputs. Save to `grading.json`. Use field names `text`, `passed`, `evidence` (not `name`/`met`/`details`). For programmatically checkable assertions, write and run a script.

2. **Aggregate into benchmark:**
   ```bash
   python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>
   ```
   Produces `benchmark.json` and `benchmark.md`. Put each with_skill version before its baseline.

3. **Do an analyst pass** — read `agents/analyzer.md` ("Analyzing Benchmark Results") for what to look for: non-discriminating assertions (always pass regardless of skill), high-variance evals (possibly flaky), time/token tradeoffs.

4. **Launch the viewer:**
   ```bash
   nohup python <skill-creator-path>/eval-viewer/generate_review.py \
     <workspace>/iteration-N \
     --skill-name "my-skill" \
     --benchmark <workspace>/iteration-N/benchmark.json \
     > /dev/null 2>&1 &
   VIEWER_PID=$!
   ```
   For iteration 2+, add `--previous-workspace <workspace>/iteration-<N-1>`.

   **Headless environments:** Use `--static <output_path>` for a standalone HTML file instead of a server. Feedback will download as `feedback.json` when user clicks "Submit All Reviews".

5. **Tell the user**: "I've opened the results in your browser. There are two tabs — 'Outputs' for qualitative review, 'Benchmark' for quantitative comparison. Come back when you're done."

## Step 5: Read the Feedback

When the user says they're done, read `feedback.json`:

```json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "the chart is missing axis labels", "timestamp": "..."},
    {"run_id": "eval-1-with_skill", "feedback": "", "timestamp": "..."},
    {"run_id": "eval-2-with_skill", "feedback": "perfect, love this", "timestamp": "..."}
  ],
  "status": "complete"
}
```

Empty feedback means the user thought it was fine. Focus improvements on cases with specific complaints.

Kill the viewer server when done:
```bash
kill $VIEWER_PID 2>/dev/null
```
