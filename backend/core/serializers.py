"""
Django REST Framework serializers for the core app.

These translate the models in ``models.py`` to/from JSON for the API. Most are
plain ModelSerializers; UserSerializer additionally handles secure user creation
(password hashing via ``create_user``).
"""
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import CaseStudy, Question, Distractor, UserProfile, UserAnswer, Highlight, UserSession

class UserProfileSerializer(serializers.ModelSerializer):
    """Serializes UserProfile, exposing subscription/trial state (including the
    computed `is_trial_active` and `trial_end_date` properties) to the client."""
    class Meta:
        model = UserProfile
        fields = ('subscription_tier', 'is_paid', 'target_exam_date', 'is_trial_active', 'trial_end_date')

class UserSerializer(serializers.ModelSerializer):
    """
    Serializes Django's User, with the nested UserProfile read-only. Used for
    registration: `password` is write-only and `create()` routes through
    `User.objects.create_user` so the password is properly hashed (never stored
    in plaintext).
    """
    password = serializers.CharField(write_only=True)  # accepted on input, never returned in responses
    userprofile = UserProfileSerializer(read_only=True)
    # B2B: the orgs this user belongs to and their role in each, so the frontend
    # can render role-gated UI (admin console / instructor dashboard).
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'userprofile', 'memberships')

    def get_memberships(self, obj):
        # Only active memberships; lightweight shape for the client.
        from .models import MembershipStatus
        rows = (obj.org_memberships
                .filter(status=MembershipStatus.ACTIVE)
                .select_related('organization'))
        return [{
            'org_id': m.organization_id,
            'org_slug': m.organization.slug,
            'org_name': m.organization.name,
            'role': m.role,
        } for m in rows]

    def create(self, validated_data):
        # create_user hashes the password rather than storing it in plaintext.
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user

# ... existings ...


class DistractorSerializer(serializers.ModelSerializer):
    """Serializes a single Distractor (answer option) of a Question."""
    class Meta:
        model = Distractor
        fields = ['label', 'text', 'incorrect_rationale']

class QuestionSerializer(serializers.ModelSerializer):
    """Serializes a Question with its answer options nested (read-only)."""
    distractors = DistractorSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'stem', 'distractors', 'correct_label', 'domain', 'correct_rationale']

class CaseStudySerializer(serializers.ModelSerializer):
    """Serializes a CaseStudy with its full set of questions nested (read-only)."""
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = CaseStudy
        fields = ['id', 'title', 'vignette', 'setting', 'tags', 'questions']

from .models import AgentMemory

class AgentMemorySerializer(serializers.ModelSerializer):
    """Serializes AgentMemory entries; `user` is set from the request, not the payload."""
    class Meta:
        model = AgentMemory
        fields = ['id', 'key', 'value', 'category', 'created_at']
        read_only_fields = ['user', 'created_at']  # owner/timestamp set server-side

class UserSessionSerializer(serializers.ModelSerializer):
    """Serializes a UserSession (per-case progress); `user` bound server-side."""
    class Meta:
        model = UserSession
        fields = ['case_study', 'current_question_index', 'is_completed', 'last_accessed']
        read_only_fields = ['user', 'last_accessed']  # owner/timestamp set server-side

class UserAnswerSerializer(serializers.ModelSerializer):
    """Serializes a UserAnswer. `is_correct` is computed server-side (never trusted
    from the client), and `user`/`timestamp` are set on the server."""
    class Meta:
        model = UserAnswer
        fields = ['question', 'selected_label', 'confidence', 'is_correct', 'timestamp']
        read_only_fields = ['is_correct', 'timestamp', 'user']  # graded/owned server-side

class HighlightSerializer(serializers.ModelSerializer):
    """Serializes a Highlight; `user` is set from the request, not the payload."""
    class Meta:
        model = Highlight
        fields = ['id', 'case_study', 'start_index', 'end_index', 'text']
        read_only_fields = ['user']  # owner set server-side

from .models import BankCase, BankQuestion, BankDistractor


class BankDistractorSerializer(serializers.ModelSerializer):
    """Serializes a single answer option of a premium BankQuestion."""
    class Meta:
        model = BankDistractor
        fields = ['label', 'text', 'incorrect_rationale']


class BankQuestionSerializer(serializers.ModelSerializer):
    """Serializes a premium BankQuestion with nested options and the NOTCE 2026
    Blueprint scenario descriptors (read-only options)."""
    distractors = BankDistractorSerializer(many=True, read_only=True)

    class Meta:
        model = BankQuestion
        fields = [
            'id', 'domain', 'difficulty', 'format', 'case', 'stem',
            'distractors', 'correct_label', 'correct_rationale',
            'explain_differently', 'core_concept',
            'topic', 'cognitive_level',
            # NOTCE 2026 Blueprint scenario descriptors
            'client_type', 'practice_setting', 'age_group', 'pronouns',
            'representation', 'diagnosis_category',
        ]


class BankCaseSerializer(serializers.ModelSerializer):
    """Serializes a premium BankCase with its nested bank questions and the NOTCE
    2026 Blueprint scenario descriptors (read-only questions)."""
    questions = BankQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = BankCase
        fields = [
            'id', 'title', 'vignette', 'setting', 'domain', 'tags', 'questions',
            # NOTCE 2026 Blueprint scenario descriptors
            'client_type', 'practice_setting', 'age_group', 'pronouns',
            'representation', 'diagnosis_category',
        ]


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


# --- B2B multi-tenancy serializers ---

from .models import Organization, OrgMembership, OrgInvite, OrgRole


class MemberUserSerializer(serializers.ModelSerializer):
    """Minimal user shape embedded in a membership row (roster views)."""
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class OrgMembershipSerializer(serializers.ModelSerializer):
    """A member of an org with their role/status; `user` nested read-only."""
    user = MemberUserSerializer(read_only=True)

    class Meta:
        model = OrgMembership
        fields = ('id', 'user', 'role', 'status', 'joined_at')
        read_only_fields = ('id', 'user', 'status', 'joined_at')


class OrganizationSerializer(serializers.ModelSerializer):
    """An organization with seat/license state and the caller's own role.

    Seat counts and license validity are computed (read-only); `my_role` is
    derived from the requesting user's membership via serializer context.
    """
    seats_used = serializers.IntegerField(read_only=True)
    seats_available = serializers.IntegerField(read_only=True)
    has_active_license = serializers.BooleanField(read_only=True)
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = (
            'id', 'name', 'slug', 'seats_total', 'seats_used', 'seats_available',
            'license_tier', 'license_active', 'license_expires_at',
            'has_active_license', 'my_role',
        )
        # License/seat fields are managed via admin or the Stripe flow, never the
        # member-facing API — keep them read-only here.
        read_only_fields = (
            'id', 'slug', 'seats_total', 'license_tier', 'license_active',
            'license_expires_at',
        )

    def get_my_role(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        m = obj.memberships.filter(user=request.user).first()
        return m.role if m else None


class OrgInviteSerializer(serializers.ModelSerializer):
    """A pending invitation to join an org by email + role."""
    is_pending = serializers.BooleanField(read_only=True)

    class Meta:
        model = OrgInvite
        fields = ('id', 'email', 'role', 'accepted_at', 'expires_at', 'created_at', 'is_pending')
        read_only_fields = ('id', 'accepted_at', 'created_at', 'is_pending')

