---
name: check-tenant-isolation
description: Audit a module for tenant isolation violations
---

Review the specified module's repositories.py and views.py for:

1. Any queryset that does NOT filter by tenant:
   - Flag: Model.objects.all() without .filter(tenant=...)
   - Flag: Model.objects.get(id=...) without tenant check
   - OK: queries using TenantAwareManager (inherits from TenantAwareModel)

2. Any view that does not pass request.tenant to the service

3. Any serializer that exposes tenant_id unnecessarily to the client

Report each violation with file name, line number, and the fix required.
Do not auto-fix — report only so the user can review.
