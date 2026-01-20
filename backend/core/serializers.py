from rest_framework import serializers
from django.contrib.auth.models import User
from .models import CaseStudy, Question, Distractor, UserProfile, UserAnswer, Highlight, UserSession

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('subscription_tier', 'is_paid', 'target_exam_date')

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    profile = UserProfileSerializer(source='userprofile', read_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'password', 'profile')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password']
        )
        UserProfile.objects.create(user=user)
        return user

# ... existings ...


class DistractorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Distractor
        fields = ['label', 'text', 'incorrect_rationale']

class QuestionSerializer(serializers.ModelSerializer):
    distractors = DistractorSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'stem', 'distractors', 'correct_label', 'domain', 'correct_rationale']

class CaseStudySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = CaseStudy
        fields = ['id', 'title', 'vignette', 'setting', 'tags', 'questions']

from .models import AgentMemory

class AgentMemorySerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentMemory
        fields = ['id', 'key', 'value', 'category', 'created_at']
        read_only_fields = ['user', 'created_at']

class UserSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSession
        fields = ['case_study', 'current_question_index', 'is_completed', 'last_accessed']
        read_only_fields = ['user', 'last_accessed']

class UserAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAnswer
        fields = ['question', 'selected_label', 'confidence', 'is_correct', 'timestamp']
        read_only_fields = ['is_correct', 'timestamp', 'user']

class HighlightSerializer(serializers.ModelSerializer):
    class Meta:
        model = Highlight
        fields = ['id', 'case_study', 'start_index', 'end_index', 'text']
        read_only_fields = ['user']

from .models import MockStudySession

class MockStudySessionSerializer(serializers.ModelSerializer):
    """Serializer for Mock Study sessions."""
    class Meta:
        model = MockStudySession
        fields = [
            'id', 'domain', 'difficulty', 'total_questions', 
            'current_question', 'correct_count', 'is_active', 
            'started_at', 'completed_at'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']

