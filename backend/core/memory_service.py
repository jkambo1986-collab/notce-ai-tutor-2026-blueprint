"""
Agent memory service.

Thin persistence layer over the ``AgentMemory`` model providing simple
key/value storage scoped per user (a ``None`` user_id maps to the global/anonymous
row). Used by the AI agent to remember facts about a learner across requests.

All functions are defensive: any DB error is logged and a safe default
(``None`` / empty list) is returned rather than raising.
"""

from .models import AgentMemory
from django.contrib.auth.models import User
import json

def store_memory(user_id, key, value, category='general'):
    """
    Stores (creates or updates) a memory item for a specific user.

    Args:
        user_id: The owning user's id, or falsy for the global/anonymous scope.
        key: Unique-per-user identifier for this memory.
        value: The value to persist.
        category: Optional grouping label (defaults to 'general').

    Returns:
        The persisted ``AgentMemory`` instance, or ``None`` on error.

    Side effects:
        Writes to the database (upsert) and prints a diagnostic on failure.
    """
    try:
        user = User.objects.get(id=user_id) if user_id else None
        # Upsert on (user, key): update value/category if the row exists, else
        # create it. ``created`` flag is unused here.
        memory, created = AgentMemory.objects.update_or_create(
            user=user,
            key=key,
            defaults={
                'value': value,
                'category': category
            }
        )
        return memory
    except Exception as e:
        print(f"Error storing memory: {e}")
        return None

def retrieve_memory(user_id, key):
    """
    Retrieves a single memory value by key.

    Args:
        user_id: The owning user's id, or falsy for the global/anonymous scope.
        key: The memory key to look up.

    Returns:
        The stored value, or ``None`` if it does not exist or on error.

    Side effects:
        Prints a diagnostic on unexpected (non-DoesNotExist) errors.
    """
    try:
        user = User.objects.get(id=user_id) if user_id else None
        memory = AgentMemory.objects.get(user=user, key=key)
        return memory.value
    except AgentMemory.DoesNotExist:
        # Missing key is an expected case -> return None quietly.
        return None
    except Exception as e:
        print(f"Error retrieving memory: {e}")
        return None

def list_memories(user_id, category=None):
    """
    Lists memories for a user, optionally filtered by category.

    Args:
        user_id: The owning user's id, or falsy for the global/anonymous scope.
        category: Optional category to filter by; when ``None``, returns all.

    Returns:
        A list of dicts with keys 'key', 'value', 'category'; empty on error.

    Side effects:
        Prints a diagnostic on error.
    """
    try:
        user = User.objects.get(id=user_id) if user_id else None
        qs = AgentMemory.objects.filter(user=user)
        # Narrow to a single category only when one was requested.
        if category:
            qs = qs.filter(category=category)
        return list(qs.values('key', 'value', 'category'))
    except Exception as e:
        print(f"Error listing memories: {e}")
        return []
