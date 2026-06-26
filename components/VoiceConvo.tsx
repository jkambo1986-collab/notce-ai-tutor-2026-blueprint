/**
 * @file VoiceConvo.tsx
 * @description Thin wrappers that configure the generic ConversationPracticeModal
 * for the two spoken scored-conversation features:
 *   - TeachBackModal (#2): you teach a concept aloud to a curious AI student.
 *   - HandoverModal (#4): you give a spoken SBAR handover to an AI colleague.
 */

import React from 'react';
import ConversationPracticeModal, { ConvoConfig } from './ConversationPracticeModal';
import { api } from '../services/api';

const TEACHBACK: ConvoConfig = {
  api: api.teachback,
  title: 'Teach-It-Back',
  accent: 'from-violet-600 to-indigo-600',
  personaHeader: (p) => `Teaching: ${p.concept}${p.blueprint_domain ? ` · ${p.blueprint_domain}` : ''}`,
  intro: (p) => <span><b>Teach this aloud:</b> {p.concept}. The student will ask follow-ups — clarify until they get it.</span>,
  aiLabel: 'Student',
  userLabel: 'You',
  inputPlaceholder: 'Explain it to the student…',
  hint: 'Tap the mic and teach it out loud. The student probes your gaps — then "End & Score".',
  minTurns: 2,
  rubricLabels: {
    accuracy: 'Accuracy', clarity: 'Clarity', completeness: 'Completeness',
    use_of_examples: 'Use of examples', responsiveness: 'Responsiveness',
  },
  negKey: 'misconceptions',
  negLabel: 'Misconceptions to fix',
};

const HANDOVER: ConvoConfig = {
  api: api.handover,
  title: 'SBAR Handover',
  accent: 'from-cyan-600 to-blue-600',
  personaHeader: (p) => `${p.title} · ${p.setting} · handing over to ${p.colleague_name}`,
  intro: (p) => <span><b>Your case:</b> {p.brief}</span>,
  aiLabel: 'Colleague',
  userLabel: 'OT',
  inputPlaceholder: 'Give your SBAR handover…',
  hint: 'Read the case, then hand it over aloud (Situation · Background · Assessment · Recommendation). The colleague will probe gaps.',
  minTurns: 1,
  rubricLabels: {
    situation: 'Situation', background: 'Background', assessment: 'Assessment',
    recommendation: 'Recommendation', prioritization: 'Prioritization', professional_language: 'Professional language',
  },
  negKey: 'missed',
  negLabel: 'Missed / omitted',
};

export const TeachBackModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  <ConversationPracticeModal isOpen={isOpen} onClose={onClose} config={TEACHBACK} />
);

export const HandoverModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  <ConversationPracticeModal isOpen={isOpen} onClose={onClose} config={HANDOVER} />
);
