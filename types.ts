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

