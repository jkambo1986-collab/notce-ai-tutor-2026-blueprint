from rest_framework import viewsets, status, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from .models import CaseStudy, Question, UserAnswer, Highlight, DomainTag, UserSession
from .serializers import CaseStudySerializer, UserAnswerSerializer, HighlightSerializer, UserSessionSerializer, UserSerializer
from .mock_study_service import generate_practice_question, generate_answer_feedback, generate_pivot_scenario
from django.utils import timezone

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer

class UserSessionViewSet(viewsets.ModelViewSet):
    queryset = UserSession.objects.all()
    serializer_class = UserSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserSession.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def save_progress(self, request):
        """
        Saves the current question index for a specific case.
        Expects: { "case_study_id": "case-1", "current_index": 2 }
        """
        case_id = request.data.get('case_study_id')
        index = request.data.get('current_index', 0)
        is_completed = request.data.get('is_completed', False)

        case = get_object_or_404(CaseStudy, id=case_id)
        
        session, created = UserSession.objects.update_or_create(
            user=request.user,
            case_study=case,
            defaults={
                'current_question_index': index,
                'is_completed': is_completed
            }
        )
        return Response({"status": "saved", "index": session.current_question_index})
    
    @action(detail=False, methods=['get'])
    def resume(self, request):
        """
        Gets the last session for a specific case.
        Query param: ?case_id=case-1
        """
        case_id = request.query_params.get('case_id')
        if not case_id:
            return Response({"error": "case_id required"}, status=400)
        
        session = UserSession.objects.filter(user=self.request.user, case_study_id=case_id).first()
        if session:
            return Response(self.get_serializer(session).data)
        return Response({}, status=200)

from .gemini_service import get_evolving_rationale

class CaseStudyViewSet(viewsets.ModelViewSet):  # Changed to ModelViewSet to allow creation
    queryset = CaseStudy.objects.all()
    serializer_class = CaseStudySerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Triggers AI generation of a new case study, saves it, and returns it.
        """
        domain = request.data.get('domain', 'OT Expertise')
        difficulty = request.data.get('difficulty', 'Medium')
        
        try:
            from .gemini_service import generate_full_case_study
            import json
            import uuid
            from .models import CaseStudy, Question, Distractor
            
            json_str = generate_full_case_study(domain, difficulty)
            if not json_str:
                return Response({"error": "AI Generation failed (returned empty). Possible API Key issue."}, status=503)
            
            data = json.loads(json_str)
            
            # Create Case
            case_id = f"case-{uuid.uuid4().hex[:8]}"
            case = CaseStudy.objects.create(
                id=case_id,
                title=data.get('title', 'Untitled Case'),
                vignette=data.get('vignette', ''),
                setting=data.get('setting', 'General'),
                tags=["AI-Generated", domain, difficulty] # Add tags
            )
            
            # Record in Agent Memory
            from .memory_service import store_memory
            store_memory(
                user_id=request.user.id if request.user.is_authenticated else None,
                key=f"generated_case:{case_id}",
                value={"title": case.title, "domain": domain},
                category="case_history"
            )
            
            # Create Questions & Distractors
            for idx, q_data in enumerate(data.get('questions', [])):
                q_id = f"{case_id}-q{idx+1}"
                question = Question.objects.create(
                    id=q_id,
                    case_study=case,
                    stem=q_data.get('stem'),
                    domain=q_data.get('domain', 'OT_EXP'),
                    correct_label=q_data.get('correct_label'),
                    correct_rationale=q_data.get('correct_rationale')
                )
                
                for d_data in q_data.get('distractors', []):
                    Distractor.objects.create(
                        question=question,
                        label=d_data.get('label'),
                        text=d_data.get('text'),
                        incorrect_rationale=d_data.get('incorrect_rationale')
                    )
            
            # Return serialized full structure
            serializer = self.get_serializer(case)
            return Response(serializer.data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
            
    @action(detail=False, methods=['post'])

    def prefetch(self, request):
        """
        Generates a new case study in the background and saves it to the library.
        """
        domain = request.data.get('domain', 'OT Expertise')
        difficulty = request.data.get('difficulty', 'Medium')
        
        # We'll just reuse the generation logic
        try:
            from .gemini_service import generate_full_case_study
            import json
            import uuid
            from .models import CaseStudy, Question, Distractor
            
            json_str = generate_full_case_study(domain, difficulty)
            if not json_str:
                return Response({"status": "failed", "reason": "empty"}, status=503)
            
            data = json.loads(json_str)
            case_id = f"case-{uuid.uuid4().hex[:8]}"
            case = CaseStudy.objects.create(
                id=case_id,
                title=data.get('title', 'Untitled Case'),
                vignette=data.get('vignette', ''),
                setting=data.get('setting', 'General'),
                tags=["Prefetched", domain, difficulty]
            )
            
            for idx, q_data in enumerate(data.get('questions', [])):
                q_id = f"{case_id}-q{idx+1}"
                question = Question.objects.create(
                    id=q_id,
                    case_study=case,
                    stem=q_data.get('stem'),
                    domain=q_data.get('domain', 'OT_EXP'),
                    correct_label=q_data.get('correct_label'),
                    correct_rationale=q_data.get('correct_rationale')
                )
                for d_data in q_data.get('distractors', []):
                    Distractor.objects.create(
                        question=question,
                        label=d_data.get('label'),
                        text=d_data.get('text'),
                        incorrect_rationale=d_data.get('incorrect_rationale')
                    )
            return Response({"status": "success", "case_id": case_id}, status=201)
        except Exception as e:
            return Response({"status": "failed", "error": str(e)}, status=500)


from .models import AgentMemory
from .serializers import AgentMemorySerializer

class AgentMemoryViewSet(viewsets.ModelViewSet):
    """
    API endpoint for the agent to store/retrieve persistent memory.
    """
    queryset = AgentMemory.objects.all()
    serializer_class = AgentMemorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users only see their own memories? Or global agent memories?
        # For this prototype, return user's memories.
        return AgentMemory.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class UserAnswerViewSet(viewsets.ModelViewSet):
    queryset = UserAnswer.objects.all()
    serializer_class = UserAnswerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        # Auto-grade
        question = serializer.validated_data['question']
        selected = serializer.validated_data['selected_label']
        is_correct = (selected.upper() == question.correct_label.upper())
        serializer.save(user=self.request.user, is_correct=is_correct)

    @action(detail=False, methods=['post'])
    def get_rationale(self, request):
        """
        Custom endpoint to fetch AI rationale based on current state.
        Expects: { 
            "question_id": "q-2",
            "previous_answer": { "is_correct": false, "selected_label": "A" },
            "all_previous_correct": true
        }
        """
        data = request.data
        question = get_object_or_404(Question, id=data.get('question_id'))
        
        previous_ans = data.get('previous_answer', None) # Dict or None
        prev_correct = previous_ans['is_correct'] if previous_ans else True
        prev_label = previous_ans['selected_label'] if previous_ans else None
        
        rationale = get_evolving_rationale(
            current_question_stem=question.stem,
            current_correct_rationale=question.correct_rationale,
            previous_answer_correct=prev_correct,
            previous_selected_label=prev_label,
            all_previous_correct=data.get('all_previous_correct', True)
        )
        
        if rationale:
            return Response({"rationale": rationale})
        return Response({"error": "Failed to generate rationale"}, status=503)

    @action(detail=False, methods=['post'])
    def evidence_link(self, request):
        """
        Analyzes user highlights against expert clinical indicators.
        POST /api/answers/evidence_link/
        Expects: { 
            "vignette": "...",
            "question_id": "q-1",
            "user_highlights": [{"start": 0, "end": 50, "text": "..."}]
        }
        Returns: {
            "expert_highlights": [...],
            "matched_count": int,
            "missed_indicators": [...],
            "perceptual_tip": str,
            "score": int
        }
        """
        from .gemini_service import analyze_evidence_link
        
        try:
            data = request.data
            question_id = data.get('question_id')
            
            if not question_id:
                return Response({"error": "question_id required", "expert_highlights": [], "matched_count": 0, "missed_indicators": [], "perceptual_tip": "Question ID missing.", "score": 0}, status=200)
            
            question = Question.objects.filter(id=question_id).first()
            if not question:
                return Response({"error": f"Question {question_id} not found", "expert_highlights": [], "matched_count": 0, "missed_indicators": [], "perceptual_tip": "Question not found.", "score": 0}, status=200)
            
            # Get the correct answer text
            correct_distractor = question.distractor_set.filter(label=question.correct_label).first()
            correct_answer_text = correct_distractor.text if correct_distractor else question.correct_label
            
            result = analyze_evidence_link(
                vignette=data.get('vignette', ''),
                question_stem=question.stem,
                correct_answer=correct_answer_text,
                correct_rationale=question.correct_rationale,
                user_highlights=data.get('user_highlights', [])
            )
            
            return Response(result)
        except Exception as e:
            print(f"Evidence Link Error: {e}")
            return Response({"error": str(e), "expert_highlights": [], "matched_count": 0, "missed_indicators": [], "perceptual_tip": "Analysis error.", "score": 0}, status=200)

class HighlightViewSet(viewsets.ModelViewSet):
    queryset = Highlight.objects.all()
    serializer_class = HighlightSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Highlight.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# --- MOCK STUDY VIEWS ---

from .models import MockStudySession
from .serializers import MockStudySessionSerializer
# Imports moved to top of file

class MockStudyViewSet(viewsets.ModelViewSet):
    """
    API endpoints for Mock Study Flow.
    Allows users to practice with AI-generated questions one at a time.
    """
    queryset = MockStudySession.objects.all()
    serializer_class = MockStudySessionSerializer
    permission_classes = [permissions.AllowAny]  # Allow anonymous for now
    
    def get_queryset(self):
        if self.request.user.is_authenticated:
            return MockStudySession.objects.filter(user=self.request.user)
        return MockStudySession.objects.none()
    
    @action(detail=False, methods=['post'])
    def start(self, request):
        """
        Start a new mock study session.
        Expects: { "domain": "OT_EXP", "difficulty": "Medium", "total_questions": 10 }
        Returns: session info with first question
        """
        domain = request.data.get('domain', 'OT_EXP')
        difficulty = request.data.get('difficulty', 'Medium')
        total_questions = request.data.get('total_questions', 10)
        
        mode = request.data.get('mode', 'practice')
        
        # Override for exam mode
        if mode == 'exam':
            # Default to 200 questions (2 books)
            total_questions = request.data.get('total_questions', 200)
            # Or 100 if just one book is selected (simplified for now)
            # Initialize with empty exam config if none provided
            exam_config = {"book": 1, "total_books": 2} if total_questions == 200 else {"book": 1, "total_books": 1}
        else:
             exam_config = {}

        # Validate total_questions for practice mode
        if mode == 'practice' and total_questions not in [10, 25, 50]:
            total_questions = 10
        
        # Create session
        session = MockStudySession.objects.create(
            user=request.user if request.user.is_authenticated else None,
            domain=domain,
            difficulty=difficulty,
            total_questions=total_questions,
            current_question=1,
            topics_covered=[],
            is_active=True,
            mode=mode,
            exam_config=exam_config,
            timer_start=timezone.now() if mode == 'exam' else None
        )
        
        # Generate first question
        question_data = generate_practice_question(
            domain=domain,
            difficulty=difficulty,
            question_number=1,
            total_questions=total_questions,
            topics_covered=[]
        )
        
        if not question_data:
            session.delete()
            return Response({"error": "Failed to generate question"}, status=503)
        
        # Store current question data for answer validation
        session.current_question_data = question_data
        session.save()
        
        # Return session info and question (without correct answer)
        return Response({
            "session_id": session.id,
            "domain": domain,
            "difficulty": difficulty,
            "total_questions": total_questions,
            "current_question": 1,
            "question": {
                "stem": question_data.get("stem"),
                "options": question_data.get("options", [])
            }
        }, status=201)

    @action(detail=False, methods=['post'])
    def prefetch(self, request):
        """
        Background endpoint to generate the NEXT question ahead of time.
        """
        session_id = request.data.get('session_id')
        try:
            session = MockStudySession.objects.get(id=session_id, is_active=True)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        
        # Don't prefetch if we're at the end
        if session.current_question >= session.total_questions:
            return Response({"status": "no_more_questions"})

        # Only generate if we don't already have one
        if not session.next_question_data:
            next_num = session.current_question + 1
            question_data = generate_practice_question(
                domain=session.domain,
                difficulty=session.difficulty,
                question_number=next_num,
                total_questions=session.total_questions,
                topics_covered=session.topics_covered or []
            )
            if question_data:
                session.next_question_data = question_data
                session.save()
                return Response({"status": "prefetched", "question_number": next_num})
        
        return Response({"status": "already_prefetched"})

    
    @action(detail=False, methods=['post'])
    def save_progress(self, request):
        """
        Saves the current session state (e.g. highlights).
        Expects: { "session_id": 1, "highlights": [...] }
        """
        session_id = request.data.get('session_id')
        highlights = request.data.get('highlights', [])
        
        try:
            session = MockStudySession.objects.get(id=session_id, is_active=True)
            session.highlights = highlights
            session.save()
            return Response({"status": "saved"})
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)

    @action(detail=False, methods=['get'])
    def get_active(self, request):
        """
        Gets the user's most recent active session.
        """
        if not request.user.is_authenticated:
            return Response(None)
            
        session = MockStudySession.objects.filter(
            user=request.user, 
            is_active=True
        ).order_by('-last_accessed').first()
        
        if not session:
            return Response(None)
            
        return Response({
            "session_id": session.id,
            "domain": session.domain,
            "difficulty": session.difficulty,
            "total_questions": session.total_questions,
            "current_question": session.current_question,
            "question": {
                "stem": session.current_question_data.get("stem"),
                "options": session.current_question_data.get("options", [])
            },
            "highlights": session.highlights,
            "progress": {
                "current": session.current_question,
                "total": session.total_questions,
                "correct": session.correct_count
            }
        })

    @action(detail=False, methods=['post'])
    def submit(self, request):
        """
        Submit an answer for the current question.
        Expects: { "session_id": 1, "selected_label": "A" }
        Returns: feedback and updated progress
        """
        session_id = request.data.get('session_id')
        selected_label = request.data.get('selected_label', '').upper()
        
        try:
            session = MockStudySession.objects.get(id=session_id)
            # We don't check is_active here strictly to allow viewing results of completed, 
            # but for submission it should be active.
            if not session.is_active:
                 return Response({"error": "Session is already completed"}, status=400)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
        
        question_data = session.current_question_data
        if not question_data:
            return Response({"error": "No active question"}, status=400)
        
        # Generate feedback
        feedback = generate_answer_feedback(
            question_stem=question_data.get("stem", ""),
            selected_label=selected_label,
            correct_label=question_data.get("correct_label", ""),
            correct_rationale=question_data.get("correct_rationale", ""),
            incorrect_rationales=question_data.get("incorrect_rationales", {})
        )
        
        # Update session stats
        is_correct = feedback["is_correct"]
        if is_correct:
            session.correct_count += 1
        
        # Add topic to covered list
        topic = question_data.get("topic", "")
        if topic and topic not in session.topics_covered:
            topics = session.topics_covered or []
            topics.append(topic)
            session.topics_covered = topics
            
        # Record history
        history_item = {
            "question_number": session.current_question,
            "stem": question_data.get("stem"),
            "selected_label": selected_label,
            "correct_label": question_data.get("correct_label"),
            "is_correct": is_correct,
            "timestamp": timezone.now().isoformat()
        }
        history = session.session_history or []
        history.append(history_item)
        session.session_history = history
        
        is_complete = session.current_question >= session.total_questions
        
        session.save()
        
        response_data = {
            "progress": {
                "current": session.current_question,
                "total": session.total_questions,
                "correct": session.correct_count,
                "percentage": int((session.current_question / session.total_questions) * 100)
            },
            "is_complete": is_complete
        }

        # If exam mode, DO NOT return feedback
        if session.mode == 'exam':
            response_data["feedback"] = None # Explicitly None
            response_data["next_question_ready"] = True # Simplified for now
        else:
            response_data["feedback"] = feedback

        return Response(response_data)

    @action(detail=False, methods=['post'])
    def pivot(self, request):
        """
        Generates a pivot scenario for the current question.
        Expects: { "session_id": 1 }
        """
        session_id = request.data.get('session_id')
        
        try:
            session = MockStudySession.objects.get(id=session_id)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found"}, status=404)
            
        question_data = session.current_question_data
        if not question_data:
            return Response({"error": "No active question data to pivot"}, status=400)
            
        pivot_data = generate_pivot_scenario(
            original_stem=question_data.get("stem", ""),
            original_correct_label=question_data.get("correct_label", ""),
            original_correct_rationale=question_data.get("correct_rationale", "")
        )
        
        if not pivot_data:
            return Response({"error": "Failed to generate pivot"}, status=503)
            
        return Response(pivot_data)
    
    @action(detail=False, methods=['post'])
    def next(self, request):
        """
        Get the next question in the session.
        Expects: { "session_id": 1 }
        Returns: next question or completion status
        """
        from django.utils import timezone
        
        session_id = request.data.get('session_id')
        
        try:
            session = MockStudySession.objects.get(id=session_id, is_active=True)
        except MockStudySession.DoesNotExist:
            return Response({"error": "Session not found or expired"}, status=404)
        
        # Check if session is complete
        if session.current_question >= session.total_questions:
            session.is_active = False
            session.completed_at = timezone.now()
            session.save()
            
            return Response({
                "is_complete": True,
                "final_score": {
                    "correct": session.correct_count,
                    "total": session.total_questions,
                    "percentage": int((session.correct_count / session.total_questions) * 100)
                }
            })
        
        # Advance to next question
        session.current_question += 1
        
        # USE PREFETCHED DATA IF AVAILABLE
        if session.next_question_data:
            question_data = session.next_question_data
            session.next_question_data = None # Clear it
        else:
            # Fallback to synchronous generation
            question_data = generate_practice_question(
                domain=session.domain,
                difficulty=session.difficulty,
                question_number=session.current_question,
                total_questions=session.total_questions,
                topics_covered=session.topics_covered or []
            )
        
        if not question_data:
            return Response({"error": "Failed to generate question"}, status=503)
        
        session.current_question_data = question_data
        session.save()
        
        return Response({
            "is_complete": False,
            "current_question": session.current_question,
            "total_questions": session.total_questions,
            "question": {
                "stem": question_data.get("stem"),
                "options": question_data.get("options", [])
            },
             "highlights": session.highlights
        })

from .stripe_service import create_checkout_session, handle_stripe_webhook
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

class CreateCheckoutSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        tier = request.data.get('tier')
        success_url = request.data.get('success_url', 'http://localhost:5173/?session_id={CHECKOUT_SESSION_ID}')
        cancel_url = request.data.get('cancel_url', 'http://localhost:5173/?cancel=true')

        try:
            session = create_checkout_session(request.user, tier, success_url, cancel_url)
            return Response({'sessionId': session.id, 'url': session.url})
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')

        try:
            handle_stripe_webhook(payload, sig_header)
            return Response(status=200)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


