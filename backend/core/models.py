from django.db import models
from django.contrib.auth.models import User

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

