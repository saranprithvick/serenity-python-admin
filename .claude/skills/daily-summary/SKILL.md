---
name: daily-summary
description: Summarise everything implemented today and save it to docs/daily-logs/
---

When invoked, do the following:

1. Identify all files created or modified in today's implementation
   by running: git diff --name-only HEAD~1 HEAD
   or if uncommitted: git status --short

2. For each file, write a plain-English summary covering:
   - What this file is and its role in the architecture
   - What each class and method does in simple terms
   - How it connects to other files (what it calls, what calls it)
   - Why it was built this way (architectural reason)

3. Write a short "How it all fits together" section at the end
   that explains the request flow end-to-end for the day's feature.
   Example for Day 2:
   "When a user POSTs to /api/auth/login/, the LoginView receives
   the request, passes credentials to AuthService, which calls
   UserRepository to find the user, verifies the password, creates
   a Django session, and returns the user data."

4. Save the document to: docs/daily-logs/day-<N>-summary.md
   Create the docs/daily-logs/ directory if it doesn't exist.

5. Confirm the file was saved and print the full path.

Keep the language simple — explain as if to someone learning Django
for the first time. Avoid jargon where possible. Use analogies where helpful.
