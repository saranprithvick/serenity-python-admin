from django.db import models

from .managers import TenantAwareManager


class Tenant(models.Model):
    """A tenant — the top-level isolation boundary every other module hangs off."""

    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class TenantAwareModel(models.Model):
    """Abstract base for any model that stores tenant-scoped data.

    Concrete subclasses gain a ``tenant`` FK; the ``%(class)s_set`` related
    name keeps reverse accessors unique per subclass.
    """

    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        related_name='%(class)s_set',
    )

    objects = TenantAwareManager()

    class Meta:
        abstract = True
