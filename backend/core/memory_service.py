from .models import AgentMemory
from django.contrib.auth.models import User
import json

def store_memory(user_id, key, value, category='general'):
    """
    Stores a memory item for a specific user.
    """
    try:
        user = User.objects.get(id=user_id) if user_id else None
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
    Retrieves a memory item by key.
    """
    try:
        user = User.objects.get(id=user_id) if user_id else None
        memory = AgentMemory.objects.get(user=user, key=key)
        return memory.value
    except AgentMemory.DoesNotExist:
        return None
    except Exception as e:
        print(f"Error retrieving memory: {e}")
        return None

def list_memories(user_id, category=None):
    """
    Lists memories for a user, optionally filtered by category.
    """
    try:
        user = User.objects.get(id=user_id) if user_id else None
        qs = AgentMemory.objects.filter(user=user)
        if category:
            qs = qs.filter(category=category)
        return list(qs.values('key', 'value', 'category'))
    except Exception as e:
        print(f"Error listing memories: {e}")
        return []
