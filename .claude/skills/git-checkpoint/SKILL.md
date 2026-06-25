---
name: git-checkpoint
description: Commit current working state as a checkpoint before major changes
disable-model-invocation: true
---

Run:
  git add -A
  git status

Show the staged files, then commit with message:
  "checkpoint: <brief description of current state>"

Do not push. Confirm the commit hash after completion.
