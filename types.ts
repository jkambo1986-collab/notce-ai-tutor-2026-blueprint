/**
 * @file types.ts
 * @description Defines the core data structures and enums used throughout the NOTCE AI-Tutor application.
 * This file serves as the central source of truth for domain entities like Case Studies, Questions, and User Answers.
 */

/**
 * Enum representing the various domains of Occupational Therapy practice.
 * Used for categorizing questions and calculating domain-specific performance statistics.
 */
export enum DomainTag {
  OT_EXP = 'OT_EXP',           // Occupational Therapy Expertise
  CEJ_JUSTICE = 'CEJ_JUSTICE', // Culture, Equity, and Justice
  COMM_COLLAB = 'COMM_COLLAB', // Communication and Collaboration
  PROF_RESP = 'PROF_RESP',     // Professional Responsibility
  EXCELLENCE = 'EXCELLENCE',   // Excellence in Practice
  ENGAGEMENT = 'ENGAGEMENT'    // Engagement in the Profession
}

/**
 * Enum for self-reported confidence levels when answering questions.
 * Used for the SRS (Spaced Repetition System) logic to prioritize low-confidence items.
 */
export enum ConfidenceLevel {
  LOW = 'LOW',
  MED = 'MED',
  HIGH = 'HIGH'
}

/**
 * Represents a single multiple-choice question within a case study.
 */
export interface QuestionItem {
  id: string;
  stem: string; // The main text of the question
  distractors: {
    label: string; // e.g., 'A', 'B', 'C', 'D'
    text: string;  // The content of the answer option
  }[];
  correctLabel: string; // The label of the correct answer
  domain: DomainTag;    // The domain this question assesses
  correctRationale: string; // Explanation for why the correct answer is right
  incorrectRationales: Record<string, string>; // Explanations for why other options are wrong
}

/**
 * Represents a complete clinical case study bundle.
 * Includes the clinical vignette and a set of related questions.
 */
export interface CaseStudy {
  id: string;
  title: string;
  vignette: string; // The descriptive text scenario
  setting: string;  // The clinical setting (e.g., "Community Rehabilitation")
  questions: QuestionItem[];
  tags?: string[];
}


/**
 * Represents a user's submission for a specific question.
 */
export interface UserAnswer {
  questionId: string;
  selectedLabel: string;
  confidence: ConfidenceLevel;
  timestamp: number;
}

/**
 * Represents a highlighted section of text within the vignette.
 * Used for persisting user annotations.
 */
export interface Highlight {
  id: string;
  start: number; // Character index where highlight starts
  end: number;   // Character index where highlight ends
  text: string;  // The actual text content highlighted
}

/**
 * Aggregated performance statistics for a specific domain.
 * Used in the Dashboard to visualize strengths and weaknesses.
 */
export interface DomainStats {
  tag: DomainTag;
  score: number;      // Number of correctly answered questions in this domain
  total: number;      // Total number of questions attempted in this domain
  weight: string;     // The weighting of this domain in the overall exam (display string)
}

/**
 * Represents an AI-identified clinical indicator in the vignette.
 * Used by the Evidence-Link feature to show expert highlights.
 */
export interface ExpertHighlight {
  start: number;       // Character index where indicator starts
  end: number;         // Character index where indicator ends
  text: string;        // The indicator text
  importance: 'critical' | 'supporting'; // How important this indicator is
}

/**
 * Result of comparing user highlights vs expert highlights.
 * Provides feedback on the user's clinical reasoning skills.
 */
export interface EvidenceLinkResult {
  expertHighlights: ExpertHighlight[];    // AI-identified indicators
  matchedCount: number;                   // How many the user found
  missedIndicators: ExpertHighlight[];    // Indicators user missed
  perceptualTip: string;                  // AI-generated training tip
  score: number;                          // 0-100 percentage match
}

/**
 * --- MOCK STUDY TYPES ---
 */

/**
 * Represents a session for the Mock Study Flow.
 */
export interface MockStudySession {
    session_id: string;
    domain: string;
    difficulty: string;
    total_questions: number;
    current_question: number;
    correct_count: number;
    is_active: boolean;
    created_at: string;
    question?: MockQuestion; // Included when starting/fetching next
    message?: string;
}

/**
 * Represents a single question in the Mock Study Flow.
 */
export interface MockQuestion {
    stem: string;
    options: {
        label: string;
        text: string;
    }[];
    domain: string;
}

/**
 * Represents the feedback received after submitting an answer in Mock Study.
 */
export interface MockFeedback {
    is_correct: boolean;
    correct_label: string;
    explanation: string;
    feedback_message: string;
}

/**
 * Subscription and trial metadata attached to a User.
 * Drives access-gating (free vs. paid) and exam-countdown features.
 */
export interface UserProfile {
    subscription_tier: string;      // Plan name returned by the backend (e.g., "free", "pro")
    is_paid: boolean;               // True when the user has an active paid subscription
    target_exam_date: string | null; // User's chosen exam date (ISO string) or null if unset
    is_trial_active: boolean;       // True while the free trial period is still valid
    trial_end_date: string | null; // When the trial expires (ISO string) or null if no trial
}

/**
 * RBAC role a user holds within a B2B organization (tenant).
 * Mirrors the backend `OrgRole` choices.
 */
export type OrgRole = 'owner' | 'admin' | 'instructor' | 'member';

/**
 * One of the organizations a user belongs to, plus their role in it.
 * Returned (flattened) by /auth/me/ so the frontend can render role-gated UI.
 */
export interface OrgMembership {
    org_id: number;
    org_slug: string;
    org_name: string;
    role: OrgRole;
}

/**
 * The authenticated user as returned by the Django backend.
 * Wraps the related UserProfile for subscription/trial state.
 */
export interface User {
    id: number;
    username: string;
    email: string;
    userprofile: UserProfile; // Nested profile holding subscription/trial details
    memberships?: OrgMembership[]; // B2B org memberships + roles (empty for pure B2C users)
}

/**
 * An organization (tenant) as returned by /organizations/ — seat/license state
 * plus the caller's own role.
 */
export interface Organization {
    id: number;
    name: string;
    slug: string;
    seats_total: number;
    seats_used: number;
    seats_available: number;
    license_tier: string;
    license_active: boolean;
    license_expires_at: string | null;
    has_active_license: boolean;
    my_role: OrgRole | null;
}

/** A member row in an org roster (/organizations/{id}/members/). */
export interface OrgMember {
    id: number;
    user: { id: number; username: string; email: string };
    role: OrgRole;
    status: string;
    joined_at: string;
}

/** Per-student + rollup analytics (/organizations/{id}/analytics/). */
export interface OrgAnalytics {
    organization: { id: number; name: string; slug: string };
    summary: {
        members: number;
        active_learners: number;
        answered: number;
        correct: number;
        accuracy: number | null;
    };
    students: {
        user_id: number;
        username: string;
        email: string;
        role: OrgRole;
        answered: number;
        correct: number;
        accuracy: number | null;
    }[];
}

/**
 * --- PERFORMANCE HUB ---
 * Cross-session analytics payload returned by GET /api/performance/.
 * Mirrors backend/core/performance_service.compute_performance().
 */
export interface Performance {
    overall: { answered: number; correct: number; accuracy: number; enough_data: boolean };
    pass_projection: {
        projected_accuracy: number;
        band: string;
        enough_data: boolean;
        sample_size: number;
    };
    by_domain: { domain: string; answered: number; correct: number; accuracy: number }[];
    confidence: { level: 'HIGH' | 'MED' | 'LOW'; answered: number; correct: number; accuracy: number }[];
    trend: { date: string; answered: number; correct: number; accuracy: number }[];
    activity: {
        study_days: number;
        sessions_completed: number;
        total_sessions: number;
        answers_last_7_days: number;
    };
    exam_date: string | null;
    days_to_exam: number | null;
    /** One-tap "Smart Drill" target: the domain to practice next. */
    recommended_drill: { domain: string; reason: string; accuracy: number; answered: number };
}

/**
 * --- ADAPTIVE REVIEW QUEUE ---
 * Weak item to revisit, returned by GET /api/review-queue/.
 * Mirrors backend/core/review_service.compute_review_queue().
 */
export interface ReviewItem {
    id: string;
    source: 'case' | 'bank';
    stem: string;
    domain: string;
    options: { label: string; text: string }[];
    your_label: string | null;
    correct_label: string;
    correct_text: string;
    rationale: string;
    reason: 'incorrect' | 'low_confidence';
}

export interface ReviewQueue {
    count: number;
    items: ReviewItem[];
}

/**
 * --- RATIONALE NOTEBOOK ---
 * A saved rationale/learning-aid entry (GET/POST/DELETE /api/notebook/).
 */
export interface NoteEntry {
    id: string;
    stem: string;
    domain: string;
    correct_label: string;
    correct_text: string;
    rationale: string;
    source: string;
}

/**
 * --- EXAM NAVIGATOR ---
 * The full, pre-generated exam returned by start (exam mode) / exam_state.
 * Questions are answer-free; answers/flags are tracked by index.
 */
export interface ExamQuestion {
    index: number;
    stem: string;
    options: { label: string; text: string }[];
    domain: string;
}

export interface ExamState {
    session_id: string;
    mode: 'exam';
    total_questions: number;
    questions: ExamQuestion[];
    answers: Record<string, string>;
    flags: number[];
    is_active: boolean;
    timed: boolean;
    remaining_seconds: number | null;
    highlights: any[];
}
