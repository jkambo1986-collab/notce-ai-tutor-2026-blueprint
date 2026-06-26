/**
 * @file Speech.tsx
 * @description Voice UI primitives on top of the shared VoiceContext + Web Speech
 * API: a SpeakButton (read text aloud, animated while speaking), a MicButton
 * (push-to-talk dictation), the useDictation hook, and a VoiceSettingsPanel for
 * the settings screen. All free / browser-native — no keys.
 */
import React, { useCallback, useId, useRef, useState } from 'react';
import { useVoice } from '../VoiceContext';
import { createRecognition, sttSupported, NEURAL_VOICES, DEFAULT_NEURAL_VOICE } from '../../services/speech';
import { cn } from './cn';

// --- Speak (TTS) ---------------------------------------------------------

const EqualizerBars: React.FC = () => (
  <span className="flex items-end gap-[2px]" aria-hidden>
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-[3px] rounded-full bg-current animate-pulse"
        style={{ height: ['10px', '14px', '7px'][i], animationDelay: `${i * 140}ms`, animationDuration: '700ms' }}
      />
    ))}
  </span>
);

const SpeakerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" /></svg>
);

/**
 * A small "read aloud" speaker control. Toggles speech for `text`; shows an
 * animated equalizer while it's the one speaking. Hides itself when TTS is off or
 * unsupported (so it never dangles as a dead button).
 */
export const SpeakButton: React.FC<{
  text: string;
  /** Stable id; auto-generated per instance if omitted. */
  id?: string;
  size?: 'sm' | 'md';
  className?: string;
  /** Accessible label prefix, e.g. "Read question". */
  label?: string;
}> = ({ text, id, size = 'md', className, label = 'Read aloud' }) => {
  const { supported, settings, speaking, speakingId, toggle } = useVoice();
  const autoId = useId();
  const myId = id ?? autoId;
  if (!supported || !settings.enabled || !text?.trim()) return null;

  const active = speaking && speakingId === myId;
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-[18px] w-[18px]';

  return (
    <button
      type="button"
      onClick={() => toggle(text, myId)}
      aria-pressed={active}
      aria-label={active ? 'Stop reading' : label}
      title={active ? 'Stop' : label}
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-90',
        dim,
        active
          ? 'bg-brand-600 text-white shadow-glow-teal'
          : 'bg-brand-50 text-brand-600 ring-1 ring-brand-100 hover:bg-brand-100',
        className,
      )}
    >
      {active ? <EqualizerBars /> : <SpeakerIcon className={icon} />}
    </button>
  );
};

// --- Dictation (STT) -----------------------------------------------------

/**
 * Push-to-talk dictation hook. Accumulates final results and streams interim
 * text. Returns null-safe no-ops when unsupported.
 */
export function useDictation(opts: {
  onResult: (finalText: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
} = { onResult: () => {} }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const supported = sttSupported();

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const start = useCallback(() => {
    if (!supported || listening) return;
    const rec = createRecognition();
    if (!rec) return;
    rec.lang = opts.lang || 'en-CA';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let finalText = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (interim && opts.onInterim) opts.onInterim(interim);
      if (finalText) opts.onResult(finalText.trim());
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    rec.onerror = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [supported, listening, opts]);

  return { listening, start, stop, supported };
}

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10a7 7 0 01-14 0M12 19v4M8 23h8" /></svg>
);

/** Push-to-talk mic button that streams transcript text to `onTranscript`. */
export const MicButton: React.FC<{
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  lang?: string;
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'lg';
}> = ({ onTranscript, onInterim, lang, disabled, className, size = 'md' }) => {
  const { listening, start, stop, supported } = useDictation({ onResult: onTranscript, onInterim, lang });
  if (!supported) return null;
  const dim = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? 'Stop dictation' : 'Dictate'}
      title={listening ? 'Stop dictation' : 'Speak your answer'}
      className={cn(
        'relative inline-flex flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50',
        dim,
        listening
          ? 'bg-red-500 text-white shadow-[0_8px_24px_-6px_rgba(239,68,68,.55)]'
          : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-brand-600 hover:ring-brand-300',
        className,
      )}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-2xl bg-red-400/40" />}
      <MicIcon className="relative h-5 w-5" />
    </button>
  );
};

// --- Settings panel ------------------------------------------------------

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({ on, onChange, label, hint }) => (
  <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 text-left">
    <span>
      <span className="block font-semibold text-ink">{label}</span>
      {hint && <span className="block text-sm text-slate-500">{hint}</span>}
    </span>
    <span className={cn('relative h-7 w-12 flex-shrink-0 rounded-full transition-colors', on ? 'bg-brand-500' : 'bg-slate-200')}>
      <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </span>
  </button>
);

/** Voice preferences panel for the Settings screen. */
export const VoiceSettingsPanel: React.FC = () => {
  const { supported, recognitionSupported, settings, update, speak } = useVoice();

  if (!supported) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
        Read-aloud isn't available here. Try the latest Chrome, Edge, or Safari.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toggle
        on={settings.enabled}
        onChange={v => update({ enabled: v })}
        label="Read-aloud (voice)"
        hint="Show speaker buttons and enable spoken feedback throughout the app."
      />

      {settings.enabled && (
        <>
          <Toggle
            on={settings.autoRead}
            onChange={v => update({ autoRead: v })}
            label="Auto-read"
            hint="Automatically read each new question and the client's replies aloud."
          />

          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-sm font-semibold text-ink">Voice</label>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">Natural AI</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={settings.voiceURI ?? DEFAULT_NEURAL_VOICE}
                onChange={e => update({ voiceURI: e.target.value })}
                className="min-w-[16rem] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-500/15"
              >
                {NEURAL_VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => speak('This is your NOTCE study voice. Walk into the exam ready.', { id: 'voice-test', force: true })}
                className="rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-bold text-brand-700 ring-1 ring-brand-100 transition hover:bg-brand-100"
              >
                Test voice
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Natural neural voices — free, no account, and they sound human in every browser. (If you're offline, your device's built-in voice is used instead.)
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-semibold text-ink">Speed</label>
              <span className="font-mono text-sm text-slate-500">{settings.rate.toFixed(2)}×</span>
            </div>
            <input
              type="range" min={0.5} max={1.5} step={0.05}
              value={settings.rate}
              onChange={e => update({ rate: Number(e.target.value) })}
              className="w-full accent-brand-600"
            />
          </div>
        </>
      )}

      <p className="text-xs text-slate-400">
        {recognitionSupported
          ? 'Voice dictation (speak your answers) is available in this browser.'
          : 'Voice dictation isn’t supported in this browser (try Chrome or Edge).'}
      </p>
    </div>
  );
};
