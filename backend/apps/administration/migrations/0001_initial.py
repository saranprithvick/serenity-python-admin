from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('tenancy', '0002_alter_tenant_options'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = []
