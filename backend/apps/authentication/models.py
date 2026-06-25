from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Manager that keys users off email rather than username."""

    use_in_migrations = True

    def _create_user(self, email, username, password, **extra_fields):
        if not email:
            raise ValueError('The email must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, username, password, **extra_fields)

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(email, username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Tenant-scoped user. ``email`` is the login identifier.

    A null ``tenant`` denotes a platform-level account (e.g. superusers) that
    belongs to no single tenant.
    """

    id = models.AutoField(primary_key=True)
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email
