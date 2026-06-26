"""
Database models for the NOTCE AI Tutor backend.

This module defines the persistent data layer of the app, grouped into:
  * Enums (TextChoices) mirroring the frontend ``types.ts`` and the NOTCE 2026
    Blueprint taxonomy used to balance exam-form coverage.
  * Content models (CaseStudy / Question / Distractor) for the live, Gemini-backed
    case study experience.
  * User-data models (UserProfile, sessions, answers, highlights) tracking each
    learner's subscription, progress, and activity.
  * Premium question-bank models (BankCase / BankQuestion / BankDistractor) holding
    pre-minted, independently audited items.
  * Mock study models for on-the-fly practice/exam sessions.
"""
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# --- ENUMS (Mapped from types.ts) ---
# TextChoices enums shared with the frontend; the string values are persisted in
# the DB while the second tuple element is the human-readable display label.

class DomainTag(models.TextChoices):
    # The six NOTCE competency domains every question is tagged against.
    OT_EXP = 'OT_EXP', 'OT Expertise'
    CEJ_JUSTICE = 'CEJ_JUSTICE', 'Culture/Equity/Justice'
    COMM_COLLAB = 'COMM_COLLAB', 'Comm & Collab'
    PROF_RESP = 'PROF_RESP', 'Prof Responsibility'
    EXCELLENCE = 'EXCELLENCE', 'Excellence in Practice'
    ENGAGEMENT = 'ENGAGEMENT', 'Engagement in OT'

class ConfidenceLevel(models.TextChoices):
    # Self-reported confidence a learner attaches to each answer.
    LOW = 'LOW', 'Low'
    MED = 'MED', 'Medium'
    HIGH = 'HIGH', 'High'

# --- NOTCE 2026 BLUEPRINT "OTHER CODES / DESCRIPTORS" ---
# Source: NOTCE Resource Manual (Blueprint - September 2026), "Other codes/descriptors".
# The exam samples items across these descriptors; we store them per-scenario so the
# bank's coverage can be tracked the way a real exam form is balanced.

class CognitiveLevel(models.TextChoices):
    # Manual taxonomy: "knowledge, application, critical thinking"
    KNOWLEDGE = 'knowledge', 'Knowledge'
    APPLICATION = 'application', 'Application'
    CRITICAL_THINKING = 'critical_thinking', 'Critical Thinking'

class ClientType(models.TextChoices):
    INDIVIDUAL = 'individual', 'Individual'
    FAMILY = 'family', 'Family'
    GROUP = 'group', 'Group'
    COMMUNITY = 'community', 'Community'
    ORGANIZATION = 'organization', 'Organization'
    POPULATION = 'population', 'Population'

class PracticeSetting(models.TextChoices):
    REHAB_CENTRE = 'rehab_centre', 'Rehabilitation Centre'
    LTC = 'ltc', 'Long-Term Care Facility'
    PEDIATRIC = 'pediatric', 'Pediatric Facility'
    HOME_CARE = 'home_care', 'Home Care'
    COMMUNITY_AGENCY = 'community_agency', 'Community Agency'
    REGULATORY_GOV = 'regulatory_gov', 'Regulatory/Government Office'
    CRIMINAL_JUSTICE = 'criminal_justice', 'Criminal Justice'
    WORKPLACE = 'workplace', 'Workplace'
    EDUCATION = 'education', 'Education System'
    HOSPITAL_INPATIENT = 'hospital_inpatient', 'Hospital Inpatient'
    HOSPITAL_OUTPATIENT = 'hospital_outpatient', 'Hospital Outpatient'
    MH_INPATIENT = 'mh_inpatient', 'Mental Health Facility Inpatient'
    MH_OUTPATIENT = 'mh_outpatient', 'Mental Health Facility Outpatient'
    INSURANCE = 'insurance', 'Insurance (WSIB/WCB/Auto)'

class AgeGroup(models.TextChoices):
    CHILD = 'child', 'Child'
    ADOLESCENT = 'adolescent', 'Adolescent'
    ADULT = 'adult', 'Adult'
    OLDER_ADULT = 'older_adult', 'Older Adult'

class Pronouns(models.TextChoices):
    HE = 'he', 'He/Him'
    SHE = 'she', 'She/Her'
    THEY = 'they', 'They/Them'
    NON_BINARY = 'non_binary', 'Non-binary'
    TRANSGENDER = 'transgender', 'Transgender'

class Representation(models.TextChoices):
    # Manual descriptor: "Black, Indigenous, Person of Colour"
    NOT_SPECIFIED = 'not_specified', 'Not specified'
    BLACK = 'black', 'Black'
    INDIGENOUS = 'indigenous', 'Indigenous'
    PERSON_OF_COLOUR = 'person_of_colour', 'Person of Colour'

class DiagnosisCategory(models.TextChoices):
    NEUROLOGICAL = 'neurological', 'Neurological'
    MUSCULOSKELETAL = 'musculoskeletal', 'Musculoskeletal'
    MENTAL_HEALTH = 'mental_health', 'Mental Health'
    GENERAL_MEDICAL = 'general_medical', 'General Medical'

class BlueprintDescriptors(models.Model):
    """
    Abstract mixin holding the NOTCE 2026 Blueprint "other codes/descriptors" that
    apply to a clinical scenario. All optional (blank=''); used for coverage tracking.
    Carried on a BankCase (case-based items inherit from their case) and directly on a
    standalone BankQuestion.
    """
    client_type = models.CharField(max_length=16, choices=ClientType.choices, blank=True, default='')
    practice_setting = models.CharField(max_length=24, choices=PracticeSetting.choices, blank=True, default='')
    age_group = models.CharField(max_length=16, choices=AgeGroup.choices, blank=True, default='')
    pronouns = models.CharField(max_length=16, choices=Pronouns.choices, blank=True, default='')
    representation = models.CharField(max_length=20, choices=Representation.choices, blank=True, default='')
    diagnosis_category = models.CharField(max_length=20, choices=DiagnosisCategory.choices, blank=True, default='')

    class Meta:
        abstract = True

# --- CONTENT MODELS ---

class CaseStudy(models.Model):
    """
    A clinical case study: a patient/practice vignette plus its related questions.
    This is the core unit of the standard (non-premium) study experience.
    """
    id = models.CharField(max_length=50, primary_key=True)  # Using manual ID to match 'case-001' format
    title = models.CharField(max_length=255)
    vignette = models.TextField()
    setting = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    tags = models.JSONField(default=list, blank=True)  # free-form list of topic/keyword strings

    def __str__(self):
        return self.title

class AgentMemory(models.Model):
    """
    Key/value memory store for the AI tutor agent. Lets the agent persist arbitrary
    state (preferences, learned facts, context) per user across sessions.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)  # null = global/anonymous memory
    key = models.CharField(max_length=255, db_index=True)
    value = models.JSONField()  # arbitrary JSON payload the agent stores under `key`
    category = models.CharField(max_length=50, default='general')  # namespace/grouping for memories
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'key']),
        ]

    def __str__(self):
        return f"{self.key} ({self.user})"

class Question(models.Model):
    """
    A single multiple-choice question belonging to a CaseStudy. The correct option
    is stored here; the wrong options live in related Distractor rows.
    """
    id = models.CharField(max_length=50, primary_key=True) # e.g., 'q-1'
    case_study = models.ForeignKey(CaseStudy, related_name='questions', on_delete=models.CASCADE)  # parent vignette
    stem = models.TextField()
    domain = models.CharField(max_length=20, choices=DomainTag.choices)  # NOTCE competency domain tag
    correct_label = models.CharField(max_length=1)  # 'A', 'B', 'C', 'D'
    correct_rationale = models.TextField()
    
    def __str__(self):
        return f"{self.id} - {self.stem[:50]}..."

class Distractor(models.Model):
    """
    One selectable answer option for a Question. Includes the correct option too;
    `incorrect_rationale` explains why a wrong option is wrong (blank for the right one).
    """
    question = models.ForeignKey(Question, related_name='distractors', on_delete=models.CASCADE)
    label = models.CharField(max_length=1)  # 'A', 'B', 'C', 'D'
    text = models.CharField(max_length=500)
    incorrect_rationale = models.TextField(blank=True, null=True) # Optional, as correct answer wont have one

    class Meta:
        unique_together = ('question', 'label')  # each label appears once per question
        ordering = ['label']

    def __str__(self):
        return f"{self.question.id} - {self.label}"

# --- USER DATA MODELS ---

class UserProfile(models.Model):
    """
    Extends Django's built-in User with app-specific data: billing/subscription
    state (Stripe), trial tracking, email verification, and study preferences.
    One-to-one with User.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    target_exam_date = models.DateField(null=True, blank=True)  # learner's goal exam date
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)  # links to the Stripe customer for billing
    subscription_tier = models.CharField(max_length=50, default='free') # 'free', 'crammer', 'guarantee', 'beta'
    is_paid = models.BooleanField(default=False)  # True once the user has an active paid subscription
    trial_start_date = models.DateTimeField(null=True, blank=True)  # set when a free trial begins; drives is_trial_active

    @property
    def is_trial_active(self):
        # Trial is active for 7 days from trial_start_date, and only while not paid.
        if self.is_paid:
            return False
        if not self.trial_start_date:
            return False
        trial_end = self.trial_start_date + timezone.timedelta(days=7)
        return timezone.now() < trial_end

    @property
    def trial_end_date(self):
        if not self.trial_start_date:
            return None
        return self.trial_start_date + timezone.timedelta(days=7)
    email_verified = models.BooleanField(default=False)  # True after the user confirms their email
    verification_token = models.CharField(max_length=100, blank=True, null=True)  # one-time token emailed for verification

class UserSession(models.Model):
    """
    Tracks a user's progress through a specific CaseStudy (which question they are on
    and whether they finished). One row per (user, case_study) pair.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    case_study = models.ForeignKey(CaseStudy, on_delete=models.CASCADE)
    # Tenant denormalization: the org the user belonged to when this activity was
    # created. Set at write time so cohort analytics stay accurate even if the
    # student later leaves the org. Null = individual (B2C) activity.
    organization = models.ForeignKey(
        'Organization', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='user_sessions'
    )
    current_question_index = models.IntegerField(default=0)  # resume position within the case's questions
    is_completed = models.BooleanField(default=False)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'case_study')  # one progress record per user per case

    def __str__(self):
        return f"{self.user.username} - {self.case_study.title} ({self.current_question_index})"

class UserAnswer(models.Model):
    """
    A record of one answer a user submitted to a Question, including their chosen
    option, self-rated confidence, and whether it was correct. Used for analytics
    and review.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    # Tenant denormalization (see UserSession.organization). Null = B2C activity.
    organization = models.ForeignKey(
        'Organization', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='user_answers'
    )
    selected_label = models.CharField(max_length=1)  # the option the user picked ('A'-'D')
    confidence = models.CharField(max_length=4, choices=ConfidenceLevel.choices)  # learner's self-rated confidence
    timestamp = models.DateTimeField(auto_now_add=True)
    is_correct = models.BooleanField()  # computed at submit time vs. the question's correct_label

    def __str__(self):
        return f"{self.user.username} - {self.question.id} - {self.is_correct}"

class Highlight(models.Model):
    """
    A text passage a user highlighted within a CaseStudy vignette. Stores the
    selected text plus its character offsets so the highlight can be re-rendered.
    """
    id = models.CharField(max_length=50, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    case_study = models.ForeignKey(CaseStudy, on_delete=models.CASCADE) # Context for the highlight
    start_index = models.IntegerField()  # char offset where the highlight begins
    end_index = models.IntegerField()    # char offset where the highlight ends
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.text[:20]}"

# --- PREMIUM QUESTION BANK MODELS ---

class BankCase(BlueprintDescriptors):
    """A clinical vignette that groups several case-based premium bank questions."""
    id = models.CharField(max_length=64, primary_key=True)  # deterministic hash id
    title = models.CharField(max_length=255)
    vignette = models.TextField()
    setting = models.CharField(max_length=120)  # free-text label for display; coded form is practice_setting
    domain = models.CharField(max_length=20, choices=DomainTag.choices)
    tags = models.JSONField(default=list, blank=True)
    # Audit trail: minted_by, solver verdicts, audit scores, revision count, timestamps
    provenance = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"[Case] {self.title}"


class BankQuestion(BlueprintDescriptors):
    """
    A pre-minted, independently-solved-and-audited premium question.
    Unlike Question (case-bound, Gemini-live) and MockStudySession (on-the-fly),
    these are vetted, persisted, and reusable across the app.

    Scenario descriptors (from BlueprintDescriptors) are carried directly for
    standalone questions; case-based questions inherit them from their `case`.
    """
    DIFFICULTY_CHOICES = [('Easy', 'Easy'), ('Medium', 'Medium'), ('Hard', 'Hard')]
    FORMAT_CHOICES = [('standalone', 'Standalone'), ('case', 'Case-based')]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('approved', 'Approved'),
        ('needs_review', 'Needs Review'),
        ('rejected', 'Rejected'),
    ]

    id = models.CharField(max_length=64, primary_key=True)  # deterministic hash for idempotent import
    domain = models.CharField(max_length=20, choices=DomainTag.choices)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES)
    format = models.CharField(max_length=12, choices=FORMAT_CHOICES, default='standalone')
    case = models.ForeignKey(BankCase, related_name='questions', on_delete=models.CASCADE, null=True, blank=True)
    stem = models.TextField()
    correct_label = models.CharField(max_length=1)  # 'A', 'B', 'C', 'D'
    correct_rationale = models.TextField()
    # Student learning aids (pre-minted): an alternate framing of the answer and
    # the underlying OT concept the item tests.
    explain_differently = models.TextField(blank=True, default='')
    core_concept = models.TextField(blank=True, default='')
    topic = models.CharField(max_length=160, blank=True)
    # NOTCE 2026 cognitive taxonomy: knowledge / application / critical thinking
    cognitive_level = models.CharField(max_length=20, choices=CognitiveLevel.choices, default=CognitiveLevel.APPLICATION)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='draft', db_index=True)
    # Full pipeline audit trail: minted_by model, blind-solver answer+verdict, audit scores, revisions
    provenance = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['domain', 'difficulty']
        indexes = [models.Index(fields=['domain', 'difficulty', 'status'])]

    def __str__(self):
        return f"[{self.domain}/{self.difficulty}] {self.stem[:48]}"


class BankDistractor(models.Model):
    """
    An answer option for a BankQuestion (the question-bank equivalent of Distractor).
    Includes the correct option; `incorrect_rationale` is set only for wrong options.
    """
    bank_question = models.ForeignKey(BankQuestion, related_name='distractors', on_delete=models.CASCADE)
    label = models.CharField(max_length=1)  # 'A', 'B', 'C', 'D'
    text = models.CharField(max_length=600)
    incorrect_rationale = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('bank_question', 'label')  # each label appears once per bank question
        ordering = ['label']

    def __str__(self):
        return f"{self.bank_question_id} - {self.label}"


# --- MOCK STUDY MODELS ---

class MockStudySession(models.Model):
    """
    Tracks a user's mock study practice session.
    Unlike full case studies, mock study sessions generate individual questions
    on-the-fly without a connecting vignette narrative.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    # Tenant denormalization (see UserSession.organization). Null = B2C activity.
    organization = models.ForeignKey(
        'Organization', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='mock_sessions'
    )
    domain = models.CharField(max_length=50)
    difficulty = models.CharField(max_length=20)  # Easy, Medium, Hard
    total_questions = models.IntegerField()
    current_question = models.IntegerField(default=0)
    correct_count = models.IntegerField(default=0)
    topics_covered = models.JSONField(default=list, blank=True)
    # Store the current question data so we can validate answers
    current_question_data = models.JSONField(null=True, blank=True)
    # Prefetched question for latency reduction
    next_question_data = models.JSONField(null=True, blank=True)

    session_history = models.JSONField(default=list, blank=True)
    highlights = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    started_at = models.DateTimeField(auto_now_add=True)
    last_accessed = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    mode = models.CharField(max_length=20, default='practice') # 'practice' or 'exam'
    timer_start = models.DateTimeField(null=True, blank=True)
    exam_config = models.JSONField(default=dict, blank=True) # e.g. {"book": 1, "total_books": 2}
    
    class Meta:
        ordering = ['-started_at']
    
    def __str__(self):
        status = "Active" if self.is_active else "Completed"
        return f"{self.user.username if self.user else 'Anonymous'} [{self.mode}] - {self.domain} ({self.current_question}/{self.total_questions}) [{status}]"


# --- B2B MULTI-TENANCY MODELS ---
# An Organization is the tenant (a school / OT program / exam-prep cohort buyer).
# Students remain individual Django Users; they join an org via OrgMembership,
# which carries their RBAC role. Premium entitlement can be inherited from the
# org's seat license (see core/entitlements.py) in addition to the per-user
# Stripe path, so org students get premium without an individual subscription.

class OrgRole(models.TextChoices):
    OWNER = 'owner', 'Owner'            # billing + everything admin can do
    ADMIN = 'admin', 'Admin'           # manage members/seats/roles, all analytics
    INSTRUCTOR = 'instructor', 'Instructor'  # view cohort analytics; no seat/billing control
    MEMBER = 'member', 'Member'         # student: consumes content, sees only own data


class MembershipStatus(models.TextChoices):
    INVITED = 'invited', 'Invited'   # invite issued, not yet accepted (placeholder membership)
    ACTIVE = 'active', 'Active'      # full member, counts against a seat
    REMOVED = 'removed', 'Removed'   # soft-removed; frees a seat, keeps history


class Organization(models.Model):
    """A B2B tenant: a school / program / cohort buyer that purchases seats.

    The seat license (seats_total + license_active + license_expires_at) is what
    grants premium access to its members. It can be set manually via Django admin
    or, once payments are enabled, by the Stripe seat-subscription flow.
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)  # stable url-safe handle
    # Seat license
    seats_total = models.PositiveIntegerField(default=0)  # purchased seats; active members must not exceed this
    license_tier = models.CharField(max_length=50, default='org')  # label for the org plan
    license_active = models.BooleanField(default=False)  # master on/off for inherited premium
    license_expires_at = models.DateTimeField(null=True, blank=True)  # null = no expiry
    # Billing linkage (used in Phase 4)
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def seats_used(self):
        # A seat is consumed by each active membership.
        return self.memberships.filter(status=MembershipStatus.ACTIVE).count()

    @property
    def seats_available(self):
        return max(self.seats_total - self.seats_used, 0)

    @property
    def has_active_license(self):
        # Premium is inherited only while the license is on and unexpired.
        if not self.license_active:
            return False
        if self.license_expires_at and self.license_expires_at < timezone.now():
            return False
        return True

    def __str__(self):
        return f"{self.name} ({self.slug})"


class OrgMembership(models.Model):
    """Links a User to an Organization and carries their RBAC role.

    One row per (organization, user). `status` distinguishes a pending invite
    placeholder from an active, seat-consuming member.
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='org_memberships')
    role = models.CharField(max_length=16, choices=OrgRole.choices, default=OrgRole.MEMBER)
    status = models.CharField(max_length=10, choices=MembershipStatus.choices, default=MembershipStatus.ACTIVE)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'user')  # a user has at most one membership per org
        indexes = [models.Index(fields=['organization', 'status'])]

    @property
    def is_admin(self):
        return self.role in (OrgRole.OWNER, OrgRole.ADMIN)

    @property
    def can_view_analytics(self):
        return self.role in (OrgRole.OWNER, OrgRole.ADMIN, OrgRole.INSTRUCTOR)

    def __str__(self):
        return f"{self.user.username} @ {self.organization.slug} [{self.role}]"


class OrgInvite(models.Model):
    """A pending email invitation to join an Organization with a given role.

    The invitee may not have an account yet, so invites are keyed by email and
    redeemed via a one-time token after sign-up/login.
    """
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invites')
    email = models.EmailField()
    role = models.CharField(max_length=16, choices=OrgRole.choices, default=OrgRole.MEMBER)
    token = models.CharField(max_length=64, unique=True, db_index=True)  # one-time redemption token
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_invites')
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)  # null = still pending
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # At most one live invite per (org, email); re-inviting reuses the row.
        unique_together = ('organization', 'email')
        ordering = ['-created_at']

    @property
    def is_pending(self):
        if self.accepted_at:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True

    def __str__(self):
        state = 'accepted' if self.accepted_at else 'pending'
        return f"invite {self.email} -> {self.organization.slug} [{state}]"


# --- SPACED REPETITION (SRS) ---

class ReviewItem(models.Model):
    """Per-user spaced-repetition scheduling for a single reviewable question.

    Items enter the schedule when the user gets a question wrong or rates it
    low-confidence (discovered from answer history). Each review grades the item
    remembered/forgot and reschedules it via a Leitner box ladder, so material
    resurfaces just before it would be forgotten instead of all at once.

    ``item_key`` is "case:<question_id>" or "bank:<bank_question_id>" — stable
    across sessions and used to rehydrate the full question for review.
    """
    SOURCE_CHOICES = [('case', 'Case'), ('bank', 'Bank')]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='review_items')
    item_key = models.CharField(max_length=80)
    source = models.CharField(max_length=8, choices=SOURCE_CHOICES)
    domain = models.CharField(max_length=20, blank=True, default='')
    box = models.PositiveSmallIntegerField(default=0)  # Leitner box index → interval
    due_at = models.DateTimeField(db_index=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    reps = models.PositiveIntegerField(default=0)       # total graded reviews
    lapses = models.PositiveIntegerField(default=0)     # times forgotten
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'item_key')
        indexes = [models.Index(fields=['user', 'due_at'])]

    def __str__(self):
        return f"{self.user.username} · {self.item_key} (box {self.box})"

