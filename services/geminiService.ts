/**
 * @file geminiService.ts
 * @description Service layer for interacting with the Google Gemini AI API.
 * Handles tasks such as generating evolving rationales (tutoring feedback) and validating case studies.
 */

import { GoogleGenAI } from "@google/genai";
import { CaseStudy, QuestionItem, DomainTag } from "../types";

// Initialize Gemini client with API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Generates an "Evolutionary Tip" for the student.
 * This function uses the AI to analyze the student's current context (previous answer correctness)
 * and generate a hint or encouragement that bridges their previous performance to the current question.
 * 
 * @param {QuestionItem} currentQuestion - The question currently being viewed.
 * @param {Object|null} previousAnswer - Metadata about the user's answer to the *previous* question.
 * @param {boolean} allPreviousCorrect - Flag indicating if users have answered all prior questions correctly.
 * @returns {Promise<string|null>} The generated tip text, or null if generation fails.
 */
export const getEvolvingRationale = async (
  currentQuestion: QuestionItem,
  previousAnswer: { questionId: string; selectedLabel: string; isCorrect: boolean } | null,
  allPreviousCorrect: boolean
) => {
  if (!process.env.API_KEY) return null;

  const prompt = `
    You are an OT exam tutor. The student is answering a series of linked case-study questions.
    Current Question Stem: "${currentQuestion.stem}"
    Correct Rationale: "${currentQuestion.correctRationale}"
    
    The user's previous performance in this case: ${allPreviousCorrect ? "All correct so far." : "Had some struggle."}
    Previous answer was: ${previousAnswer?.isCorrect ? "Correct" : `Incorrect (Selected ${previousAnswer?.selectedLabel})`}
    
    Generate a 2-sentence "Evolutionary Tip" that acknowledges their path and reinforces the logic for this CURRENT question.
    If they were wrong previously, guide them back to the "competent" path.
  `;

  try {
    // Attempt to generate content using the specified model
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

/**
 * Validates that a Case Study object adheres to the 2026 Blueprint standards.
 * Specifically checks for mandatory inclusions, such as questions related to Culture, Equity, and Justice.
 * 
 * @param {CaseStudy} caseStudy - The case study object to validate.
 * @returns {Promise<{valid: boolean; message: string}>} Validation result object.
 */
export const validateCaseStudy = async (caseStudy: CaseStudy): Promise<{ valid: boolean; message: string }> => {
  // Check for presence of mandatory CEJ_JUSTICE domain question
  const hasJustice = caseStudy.questions.some(q => q.domain === DomainTag.CEJ_JUSTICE);
  
  if (!hasJustice) {
    return { valid: false, message: "CRITICAL: This case study is missing a CEJ_JUSTICE (Culture/Equity) question, which is mandatory for the 2026 Blueprint." };
  }
  
  return { valid: true, message: "Validation Successful: Case matches 2026 Blueprint standards." };
};
