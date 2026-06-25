---
name: run-tests
description: Run the Django test suite and report results
---

Run tests with:
  cd backend && python manage.py test apps.<module> --verbosity=2

If tests fail:
1. Show the full traceback
2. Identify which layer failed (model, repository, service, view)
3. Propose a fix without modifying unrelated files

If all tests pass, confirm and summarize what was tested.
