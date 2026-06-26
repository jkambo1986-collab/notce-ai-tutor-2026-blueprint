/**
 * @file LegalPage.tsx
 * @description Minimal Privacy / Terms / Contact pages. Previously the landing
 * footer linked these to dead "#" anchors — institutional (B2B) buyers expect
 * real, linkable policy pages, so this provides honest boilerplate at stable
 * routes (/privacy, /terms, /contact). Content is intentionally generic and
 * should be reviewed by the operator before launch.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

export type LegalDoc = 'privacy' | 'terms' | 'contact';

const UPDATED = 'June 2026';

const DOCS: Record<LegalDoc, { title: string; body: React.ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    body: (
      <>
        <p>NOTCE AI-Tutor ("we") provides exam-preparation tools for the Canadian NOTCE examination. This policy explains what we collect and why.</p>
        <h3>What we collect</h3>
        <ul>
          <li><strong>Account data</strong> — your username and email, used to sign you in and contact you about your account.</li>
          <li><strong>Study activity</strong> — questions you answer, confidence ratings, highlights, and session results, used to power your analytics, readiness projection, and review queue.</li>
          <li><strong>Billing</strong> — payments are processed by Stripe; we store a customer reference, never your card details.</li>
        </ul>
        <h3>How we use it</h3>
        <p>To operate the product, personalize your study plan, and improve question quality. If your organization provides your seat, your instructors can see your aggregate progress within that organization.</p>
        <h3>Your choices</h3>
        <p>You can edit your study profile in Settings and request account deletion at any time.</p>
      </>
    ),
  },
  terms: {
    title: 'Terms of Service',
    body: (
      <>
        <p>By using NOTCE AI-Tutor you agree to these terms.</p>
        <h3>The service</h3>
        <p>We provide practice questions, simulations, and analytics for exam preparation. The content is a study aid and does not guarantee any examination outcome.</p>
        <h3>Accounts</h3>
        <p>You're responsible for activity under your account. Don't share, scrape, or redistribute question content.</p>
        <h3>Subscriptions</h3>
        <p>Paid tiers and organization seat licenses are billed via Stripe per the plan you select. Access continues for the paid period.</p>
        <h3>Disclaimer</h3>
        <p>The service is provided "as is." We are not affiliated with CAOT and this is not the official NOTCE exam.</p>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    body: (
      <>
        <p>Need help or have a question about your account or organization?</p>
        <ul>
          <li>If your seat was provided by a school or program, your organization administrator can help with access and billing.</li>
          <li>For everything else, reply to any email you've received from NOTCE AI-Tutor and our team will follow up.</li>
        </ul>
      </>
    ),
  },
};

const LegalPage: React.FC<{ doc: LegalDoc }> = ({ doc }) => {
  const navigate = useNavigate();
  const { title, body } = DOCS[doc];

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-200 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-white mb-8">← Back to home</button>
        <h1 className="text-3xl font-extrabold text-white mb-1">{title}</h1>
        <p className="text-xs text-slate-500 mb-8">Last updated {UPDATED}</p>
        <div className="space-y-4 leading-relaxed text-slate-300 [&_h3]:text-white [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_strong]:text-white">
          {body}
        </div>
        <div className="mt-10 flex gap-4 text-sm">
          <button onClick={() => navigate('/privacy')} className="text-slate-400 hover:text-white">Privacy</button>
          <button onClick={() => navigate('/terms')} className="text-slate-400 hover:text-white">Terms</button>
          <button onClick={() => navigate('/contact')} className="text-slate-400 hover:text-white">Contact</button>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
