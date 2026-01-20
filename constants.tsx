/**
 * @file constants.tsx
 * @description Contains constant data configurations and mock data for the application.
 * This includes domain weighting information and the initial mock case study used for the blueprint demo.
 */

import { DomainTag, CaseStudy } from './types';

/**
 * Configuration map for each domain, maintaining labels and exam weighting.
 * Keys are DomainTag enum values.
 */
export const DOMAIN_INFO = {
  [DomainTag.OT_EXP]: { label: 'OT Expertise', weight: '20-25%' },
  [DomainTag.CEJ_JUSTICE]: { label: 'Culture/Equity/Justice', weight: '20-25%' },
  [DomainTag.COMM_COLLAB]: { label: 'Comm & Collab', weight: '19-21%' },
  [DomainTag.PROF_RESP]: { label: 'Prof Responsibility', weight: '13-15%' },
  [DomainTag.EXCELLENCE]: { label: 'Excellence in Practice', weight: '11-14%' },
  [DomainTag.ENGAGEMENT]: { label: 'Engagement in OT', weight: '5-8%' },
};

/**
 * A mock case study used to populate the application with initial data.
 * Represents a "Community Integration Post-TBI" scenario with 3 linked questions.
 */
export const MOCK_CASE: CaseStudy = {
  id: 'case-001',
  title: 'Community Integration Post-TBI',
  setting: 'Community Rehabilitation',
  vignette: `Mr. Thompson is a 42-year-old male who sustained a moderate traumatic brain injury (TBI) six months ago following a motor vehicle accident. He was recently discharged from an inpatient rehabilitation unit and has returned to his two-story home, which he shares with his spouse and two teenage children. Prior to his injury, he worked as a senior software engineer.

Currently, Mr. Thompson presents with executive functioning deficits, specifically in multi-tasking and cognitive flexibility. He also experiences mild left-sided neglect and fatigue after 30 minutes of sustained attention. His spouse reports that he is "not himself," often becoming irritable during family dinners or when trying to manage household finances. Mr. Thompson expresses a strong desire to return to work, but he is struggling with basic instrumental activities of daily living (IADLs) like meal preparation and route finding in his local neighborhood. 

During an initial home visit, the OT observes Mr. Thompson attempting to boil water for tea while simultaneously trying to answer a text message. He forgets the stove is on until the kettle whistles persistently, causing him visible distress.`,
  questions: [
    {
      id: 'q-1',
      stem: 'Based on the initial observation of Mr. Thompson in his home, which assessment should the OT prioritize to evaluate his safety during IADLs?',
      domain: DomainTag.OT_EXP,
      distractors: [
        { label: 'A', text: 'Montreal Cognitive Assessment (MoCA)' },
        { label: 'B', text: 'Assessment of Motor and Process Skills (AMPS)' },
        { label: 'C', text: 'Kettle Test' },
        { label: 'D', text: 'Catherine Bergego Scale (CBS)' }
      ],
      correctLabel: 'C',
      correctRationale: 'The Kettle Test is a top-down, functional assessment of complex IADLs that specifically evaluates executive function and safety in a familiar task, mirroring the exact breakdown observed.',
      incorrectRationales: {
        'A': 'The MoCA is a screening tool, not a functional assessment of IADL safety.',
        'B': 'While AMPS is excellent, it requires specific certification and may be more time-consuming than necessary for an initial safety screen.',
        'D': 'The CBS focuses on unilateral neglect; while relevant, cognitive safety in tasks is the more immediate functional priority.'
      }
    },
    {
      id: 'q-2',
      stem: 'Mr. Thompson identifies as an Indigenous person and expresses concern that the "Standardized Canadian Work Assessments" do not reflect his community values or his role within his family. How should the OT proceed?',
      domain: DomainTag.CEJ_JUSTICE,
      distractors: [
        { label: 'A', text: 'Explain that the assessments are validated for all Canadians and necessary for insurance.' },
        { label: 'B', text: 'Collaborate with Mr. Thompson to integrate his cultural values and traditional occupations into the assessment process.' },
        { label: 'C', text: 'Refer him to an Indigenous health liaison and postpone the work assessment.' },
        { label: 'D', text: 'Use the assessments as written but add a footnote about his cultural background.' }
      ],
      correctLabel: 'B',
      correctRationale: 'In alignment with the 2026 Blueprint on Cultural Safety, OTs must move beyond just noting bias; they must actively collaborate to modify or select assessments that respect Indigenous worldviews.',
      incorrectRationales: {
        'A': 'This dismisses the client\'s valid concerns and reinforces systemic bias.',
        'C': 'While a liaison is helpful, the OT must still exercise clinical leadership and not "pass off" the responsibility for cultural safety.',
        'D': 'A footnote is a passive approach that does not fix the inherent mismatch in the assessment process.'
      }
    },
    {
      id: 'q-3',
      stem: 'Mr. Thompson’s employer is hesitant to provide accommodations, citing the "high-stakes" nature of software engineering. What is the most effective advocacy role for the OT in this scenario?',
      domain: DomainTag.COMM_COLLAB,
      distractors: [
        { label: 'A', text: 'Advise Mr. Thompson to seek legal counsel for a human rights complaint.' },
        { label: 'B', text: 'Provide the employer with a generic brochure on TBI recovery in the workplace.' },
        { label: 'C', text: 'Request a meeting with HR to present a job-site analysis and propose specific, incremental cognitive accommodations.' },
        { label: 'D', text: 'Recommend that Mr. Thompson consider a career change to a less demanding field.' }
      ],
      correctLabel: 'C',
      correctRationale: 'Collaboration involves bridging the gap between clinical needs and employer requirements. A job-site analysis provides evidence-based data for reasonable accommodations.',
      incorrectRationales: {
        'A': 'This is premature and might damage the relationship with the employer.',
        'B': 'Generic information is rarely effective for specific complex cognitive cases.',
        'D': 'This is non-collaborative and gives up on the client\'s stated goal of returning to his chosen profession.'
      }
    }
  ]
};
