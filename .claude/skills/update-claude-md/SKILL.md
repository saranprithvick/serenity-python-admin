---
name: update-claude-md
description: Update the Project State table in CLAUDE.md to reflect today's completed work
---

When invoked:

1. Read the current CLAUDE.md from the project root

2. Find the Project State table (the markdown table with Day, Module, Status columns)

3. Update the row for today's completed day:
   - Change ⬜ Pending or 🔄 In progress → ✅ Done
   - Set the next day's status to 🔄 In progress

4. Find the "Current task:" line below the table and update it
   to describe the next day's task based on the plan:
   Day 3 → "Implement RBAC: roles, permissions, permission keys, decorators"
   Day 4 → "Implement multi-tenancy middleware and queryset filtering"
   Day 5 → "Implement Administration UI: users, roles, permissions management"
   Day 6 → "Implement Customer module: model, API, serializer, service"
   Day 7 → "Implement Customer grid and modal form in React"
   Day 8 → "UI polish: dashboard, charts, responsive layout"
   Day 9 → "Testing: tenant isolation, permissions, CRUD flows"
   Day 10 → "Presentation prep: architecture diagram, screenshots, demo flow"

5. Write the updated content back to CLAUDE.md
   Do not modify any other section of CLAUDE.md

6. Show a diff of exactly what changed before saving and ask
   for confirmation before writing

7. After saving, confirm with:
   "CLAUDE.md updated. Day N marked complete. Day N+1 set to In progress."
