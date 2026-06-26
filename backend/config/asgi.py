"""
ASGI config for config project.

Entry point for ASGI-compatible (async) web servers. It exposes the ASGI
callable as a module-level variable named ``application``. The project is
deployed via WSGI (see wsgi.py); this module exists for async-capable servers.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_asgi_application()
