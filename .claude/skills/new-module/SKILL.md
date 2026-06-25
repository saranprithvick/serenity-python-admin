---
name: new-module
description: Scaffold a new Django app following the Serenity module pattern
---

When asked to create a new Django module/app:

1. Create the directory under backend/apps/<name>/
2. Generate these files in order:
   - __init__.py
   - apps.py — AppConfig with name = 'apps.<name>'
   - models.py — import TenantAwareModel from apps.tenancy
   - repositories.py — class with get_by_id, get_all_for_tenant
   - services.py — class that calls repository only, no direct ORM
   - serializers.py — DRF ModelSerializer
   - views.py — DRF ViewSet, calls service only
   - permissions.py — uses Module:Action string key format
   - urls.py — router-based URL registration
   - tests.py — tests for each layer
3. Remind the user to:
   - Add 'apps.<name>' to INSTALLED_APPS
   - Include apps/<name>/urls.py in config/urls.py
   - Run makemigrations and migrate
