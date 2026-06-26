"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os
from pathlib import Path

# Load environment variables from .env file if it exists
from dotenv import load_dotenv
env_path = Path(__file__).resolve().parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Ensure static files are collected before WhiteNoise initializes.
# The Railway deploy's start command does not run collectstatic, so STATIC_ROOT
# would be missing and the Django admin CSS would 404. Collect once per boot if
# the directory isn't present (cheap, idempotent, start-command-agnostic).
try:
    import django
    django.setup()
    from django.conf import settings as _settings
    if _settings.STATIC_ROOT and not Path(_settings.STATIC_ROOT).exists():
        from django.core.management import call_command
        call_command('collectstatic', '--noinput', verbosity=0)
except Exception as _e:  # never block app startup on static collection
    print(f"[wsgi] collectstatic on boot skipped: {_e}")

application = get_wsgi_application()
