
import { CaseStudy } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const api = {
  /**
   * Fetches all available case studies.
   */
  async getCases(): Promise<CaseStudy[]> {
    const response = await fetch(`${API_BASE_URL}/cases/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch cases: ${response.statusText}`);
    }
    const data = await response.json();
    return data.map(transformCaseStudy);
  },

  /**
   * Fetches a single case study by ID.
   */
  async getCase(id: string): Promise<CaseStudy> {
    const response = await fetch(`${API_BASE_URL}/cases/${id}/`);
    if (!response.ok) {
      throw new Error(`Failed to fetch case ${id}: ${response.statusText}`);
    }
    const data = await response.json();
    return transformCaseStudy(data);
  },

  /**
   * Requests an evolving rationale from the AI.
   */
  async getRationale(context: { 
    question_id: string; 
    previous_answer?: { is_correct: boolean; selected_label: string };
    all_previous_correct: boolean; 
  }): Promise<string> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}/answers/get_rationale/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(context)
    });
    if (!response.ok) {
      console.warn('Failed to fetch rationale:', response.status);
      return ''; // Return empty string instead of throwing to avoid breaking the UI
    }
    const data = await response.json();
    return data.rationale;
  },

  /**
   * Triggers the generation of a new AI case study.
   */
  async generateCase(domain: string, difficulty: string): Promise<CaseStudy> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}/cases/generate/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ domain, difficulty })
    });
    
    if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
    }
    const data = await response.json();
    return transformCaseStudy(data);
  },

  /**
   * Register a new user.
   */
  async register(username: string, password: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(JSON.stringify(errorData) || 'Registration failed');
    }
  },

  /**
   * Log in and retrieve tokens.
   */
  async login(username: string, password: string): Promise<{ access: string, refresh: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, { // Changed to specific login path if needed, but using standard JWT endpoint usually
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!response.ok) {
        throw new Error('Login failed');
    }
    return response.json();
  },

  /**
   * Saves the user's progress for a specific case.
   */
  async saveSession(caseId: string, index: number, isCompleted: boolean): Promise<void> {
    const token = localStorage.getItem('auth_token'); // Mock auth support
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/sessions/save_progress/`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ 
            case_study_id: caseId, 
            current_index: index, 
            is_completed: isCompleted 
        })
    });
    
    if (response.status === 401 || response.status === 403) {
        console.warn("User not logged in, progress not saved to server.");
        return;
    }
  },

  /**
   * Resumes the last session for a specific case.
   */
  async getSession(caseId: string): Promise<{ currentIndex: number, isCompleted: boolean } | null> {
    const token = localStorage.getItem('auth_token');
    if (!token) return null; // No auth, no server session

    const response = await fetch(`${API_BASE_URL}/sessions/resume/?case_id=${caseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
        const data = await response.json();
        if (data && typeof data.current_question_index === 'number') {
            return { 
                currentIndex: data.current_question_index, 
                isCompleted: data.is_completed 
            };
        }
    }
    return null;
  },

  /**
   * Analyzes user highlights against expert clinical indicators.
   */
  async getEvidenceLink(params: {
    vignette: string;
    question_id: string;
    user_highlights: { start: number; end: number; text: string }[];
  }): Promise<{
    expert_highlights: { start: number; end: number; text: string; importance: string }[];
    matched_count: number;
    missed_indicators: { start: number; end: number; text: string; importance: string }[];
    perceptual_tip: string;
    score: number;
  }> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}/answers/evidence_link/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      console.warn('Failed to get evidence link:', response.status);
      return {
        expert_highlights: [],
        matched_count: 0,
        missed_indicators: [],
        perceptual_tip: 'Evidence analysis unavailable.',
        score: 0
      };
    }
    
    return response.json();
  },


  /**
   * Mock Study Flow API
   */
  mockStudy: {
    async start(domain: string, difficulty: string, total_questions: number, mode: 'practice' | 'exam' = 'practice'): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/mock-study/start/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain, difficulty, total_questions, mode })
        });
        if (!response.ok) throw new Error('Failed to start session');
        return response.json();
    },

    async submitAnswer(sessionId: string, selectedLabel: string): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/mock-study/submit/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, selected_label: selectedLabel })
        });
        if (!response.ok) throw new Error('Failed to submit answer');
        return response.json();
    },

    async nextQuestion(sessionId: string): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/mock-study/next/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        if (!response.ok) throw new Error('Failed to fetch next question');
        return response.json();
    },

    async getActiveSession(): Promise<any> {
        const token = localStorage.getItem('auth_token');
        if (!token) return null;
        
        const response = await fetch(`${API_BASE_URL}/mock-study/get_active/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.status === 200) {
            const data = await response.json();
            return data;
        }
        return null; // No active session
    },

    async saveSession(sessionId: string, highlights: any[]): Promise<void> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch(`${API_BASE_URL}/mock-study/save_progress/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId, highlights })
        });
    },

    async pivotQuestion(sessionId: string): Promise<any> {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}/mock-study/pivot/`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ session_id: sessionId })
        });
        
        if (!response.ok) throw new Error('Failed to generate pivot');
        return response.json();
    }


  }
};

// --- DATA TRANSFORMERS ---

function transformCaseStudy(data: any): CaseStudy {
  return {
    id: data.id,
    title: data.title,
    vignette: data.vignette,
    setting: data.setting,
    questions: data.questions.map((q: any) => ({
      id: q.id,
      stem: q.stem,
      domain: q.domain, // Enum matching relies on string equality
      correctLabel: q.correct_label,
      correctRationale: q.correct_rationale,
      distractors: q.distractors.map((d: any) => ({
        label: d.label,
        text: d.text
      })),
      incorrectRationales: q.distractors.reduce((acc: any, d: any) => {
        if (d.incorrect_rationale) {
          acc[d.label] = d.incorrect_rationale;
        }
        return acc;
      }, {} as Record<string, string>)
    }))
  };
}
