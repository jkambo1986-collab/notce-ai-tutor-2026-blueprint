/**
 * @file NotebookModal.tsx
 * @description Viewer for the user's saved rationale notebook (GET /api/notebook/).
 * Lists saved rationales, supports removing entries, and exports a clean,
 * printable study sheet (opens a print-friendly window — no PDF dependency).
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { NoteEntry } from '../types';
import { DOMAIN_INFO } from '../constants';
import { useToast } from './ui/Feedback';

interface NotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const domainLabel = (code: string) =>
  (DOMAIN_INFO as Record<string, { label: string }>)[code]?.label || code;

const escapeHtml = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const NotebookModal: React.FC<NotebookModalProps> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const [items, setItems] = useState<NoteEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setItems(null); setError(false);
    api.getNotebook().then(r => { if (active) setItems(r.items); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const remove = async (id: string) => {
    try {
      const r = await api.removeNote(id);
      setItems(r.items);
    } catch {
      toast('Could not remove that note.', 'error');
    }
  };

  const exportSheet = () => {
    if (!items || items.length === 0) return;
    const rows = items.map((n, i) => `
      <div class="card">
        <div class="meta">${i + 1}. ${escapeHtml(domainLabel(n.domain))}</div>
        <div class="stem">${escapeHtml(n.stem)}</div>
        <div class="ans"><b>Correct (${escapeHtml(n.correct_label)}):</b> ${escapeHtml(n.correct_text)}</div>
        <div class="rat">${escapeHtml(n.rationale)}</div>
      </div>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>NOTCE Study Sheet</title>
      <style>
        body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937;max-width:760px;margin:32px auto;padding:0 16px}
        h1{font-size:22px;margin:0 0 4px} .sub{color:#6b7280;margin:0 0 24px;font-size:13px}
        .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:14px;break-inside:avoid}
        .meta{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8b5cf6;font-weight:700;margin-bottom:6px}
        .stem{font-weight:600;margin-bottom:8px}
        .ans{background:#ecfdf5;border:1px solid #d1fae5;border-radius:8px;padding:8px 10px;font-size:14px;margin-bottom:8px}
        .rat{font-size:14px;color:#374151;line-height:1.5}
        @media print{body{margin:0}}
      </style></head><body>
      <h1>NOTCE Study Sheet</h1>
      <p class="sub">${items.length} saved rationale${items.length === 1 ? '' : 's'} · NOTCE AI-Tutor</p>
      ${rows}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to export your study sheet.', 'info'); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-200 flex flex-col">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">My Notebook</h2>
            <p className="text-white/80 text-sm">Saved rationales — export a study sheet for exam day.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-7 overflow-y-auto">
          {error ? (
            <p className="text-center text-gray-500 py-12">Couldn't load your notebook. Please try again.</p>
          ) : items === null ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">Your notebook is empty</h3>
              <p className="text-gray-500 max-w-sm mx-auto">Tap "Save to notebook" on a rationale during review to keep it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(n => (
                <div key={n.id} className="p-4 rounded-2xl border border-gray-100 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">{domainLabel(n.domain)}</span>
                    <button onClick={() => remove(n.id)} aria-label="Remove" className="text-gray-300 hover:text-red-500 transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <p className="font-semibold text-gray-900 mt-2">{n.stem}</p>
                  <div className="mt-2 text-sm bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-emerald-800"><b>Correct ({n.correct_label}):</b> {n.correct_text}</div>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{n.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <span className="text-sm text-gray-500">{items?.length ?? 0} saved</span>
          <button
            onClick={exportSheet}
            disabled={!items || items.length === 0}
            className="px-6 py-3 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" /></svg>
            Export / Print
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotebookModal;
