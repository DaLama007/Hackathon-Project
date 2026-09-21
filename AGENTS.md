# Agent instructions

This repo is a timed hackathon (PlateWise diet planner). Follow `.cursorrules` for coding style, stack, and demo rules.

## Shared tasklist

**`TASKS.md` is the backlog every agent can select from.**

If the user did not name a specific feature:

1. Read `TASKS.md`.
2. List open, unclaimed tasks (`- [ ]` and no `(@…)` on the title).
3. Pick one (highest priority first: P0 then P1). If the user named an **ID** (`frontend-ui`, `offers-recipes-loop`, `camera-ai-scan`), take that one if it is still open.
4. **Claim immediately** before writing feature code:
   - Put `(@your-branch-name)` on the task title line.
   - Set **Status**: `claimed`.
   - Commit + push that claim so parallel agents see it.
5. Implement only that task. Do not start a second open task in the same run.
6. When done: check the box `[x]`, **Status**: `done`, leave the `(@branch)` for history, CHANGELOG bullet, smoke checklist.

If every P0/P1 task is claimed or done, stop and say so — do not invent extra scope.

## Claim example

```markdown
- [ ] Polish frontend UI (@cursor/frontend-ui-xxxx)
  - **Status**: claimed
```

## Conflict rule

Same-file parallel edits are the #1 merge-conflict sink. If your task’s **Files** overlap a claimed task, pick a different task or wait.
