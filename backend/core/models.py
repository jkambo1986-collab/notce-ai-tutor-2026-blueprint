from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# --- ENUMS (Mapped from types.ts) ---

class DomainTag(models.TextChoices):
    OT_EXP = 'OT_EXP', 'OT Expertise'
    CEJ_JUSTICE = 'CEJ_JUSTICE', 'Culture/Equity/Justice'
    COMM_COLLAB = 'COMM_COLLAB', 'Comm & Collab'
    PROF_RESP = 'PROF_RESP', 'Prof Responsibility'
    EXCELLENCE = 'EXCELLENCE', 'Excellence in Practice'
    ENGAGEMENT = 'ENGAGEMENT', 'Engagement in OT'

class ConfidenceLevel(models.TextChoices):
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
    id = models.CharField(max_length=50, primary_key=True)  # Using manual ID to match 'case-001' format
    title = models.CharField(max_length=255)
    vignette = models.TextField()
    setting = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    tags = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.title

class AgentMemory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    key = models.CharField(max_length=255, db_index=True)
    value = models.JSONField()
    category = models.CharField(max_length=50, default='general')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'key']),
        ]

    def __str__(self):
        return f"{self.key} ({self.user})"

class Question(models.Model):
    id = models.CharField(max_length=50, primary_key=True) # e.g., 'q-1'
    case_study = models.ForeignKey(CaseStudy, related_name='questions', on_delete=models.CASCADE)
    stem = models.TextField()
    domain = models.CharField(max_length=20, choices=DomainTag.choices)
    correct_label = models.CharField(max_length=1)  # 'A', 'B', 'C', 'D'
    correct_rationale = models.TextField()
    
    def __str__(self):
        return f"{self.id} - {self.stem[:50]}..."

class Distractor(models.Model):
    question = models.ForeignKey(Question, related_name='distractors', on_delete=models.CASCADE)
    label = models.CharField(max_length=1)  # 'A', 'B', 'C', 'D'
    text = models.CharField(max_length=500)
    incorrect_rationale = models.TextField(blank=True, null=True) # Optional, as correct answer wont have one

    class Meta:
        unique_together = ('question', 'label')
        ordering = ['label']

    def __str__(self):
        return f"{self.question.id} - {self.label}"

# --- USER DATA MODELS ---

class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    target_exam_date = models.DateField(null=True, blank=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    subscription_tier = models.CharField(max_length=50, default='free') # 'free', 'crammer', 'guarantee', 'beta'
    is_paid = models.BooleanField(default=False)
    trial_start_date = models.DateTimeField(null=True, blank=True)

    @property
    def is_trial_active(self):
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
    email_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=100, blank=True, null=True)

class UserSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    case_study = models.ForeignKey(CaseStudy, on_delete=models.CASCADE)
    current_question_index = models.IntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'case_study')

    def __str__(self):
        return f"{self.user.username} - {self.case_study.title} ({self.current_question_index})"

class UserAnswer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_label = models.CharField(max_length=1)
    confidence = models.CharField(max_length=4, choices=ConfidenceLevel.choices)
    timestamp = models.DateTimeField(auto_now_add=True)
    is_correct = models.BooleanField()

    def __str__(self):
        return f"{self.user.username} - {self.question.id} - {self.is_correct}"

class Highlight(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    case_study = models.ForeignKey(CaseStudy, on_delete=models.CASCADE) # Context for the highlight
    start_index = models.IntegerField()
    end_index = models.IntegerField()
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
    bank_question = models.ForeignKey(BankQuestion, related_name='distractors', on_delete=models.CASCADE)
    label = models.CharField(max_length=1)  # 'A', 'B', 'C', 'D'
    text = models.CharField(max_length=600)
    incorrect_rationale = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('bank_question', 'label')
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

