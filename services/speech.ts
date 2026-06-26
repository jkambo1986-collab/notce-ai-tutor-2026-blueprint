/**
 * @file speech.ts
 * @description Browser-native voice utilities built on the free Web Speech API —
 * text-to-speech (`speechSynthesis`) and speech-to-text (`SpeechRecognition`).
 * No API keys, no cost. The voice ranking favours the most natural-sounding free
 * voices the OS/browser exposes (Microsoft "Natural"/Edge online, Google network
 * voices), falling back gracefully to whatever local voice is available.
 */

/** True when the browser can synthesize speech. */
export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** True when the browser can transcribe speech (Chrome/Edge/Safari; not Firefox). */
export function sttSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

// Voice-name patterns ranked from most to least "natural", highest weight first.
const NATURAL_PATTERNS: RegExp[] = [
  /natural/i, /neural/i, /online/i, /\(enhanced\)/i, /premium/i, /google/i, /siri/i,
];

/**
 * Score a voice so we can pick the nicest free one. Natural/neural/online voices
 * win big; English (Canadian first, for the NOTCE) is preferred; network voices
 * tend to sound better than local ones.
 */
export function rankVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  const name = v.name || '';
  NATURAL_PATTERNS.forEach((re, i) => {
    if (re.test(name)) score += (NATURAL_PATTERNS.length - i) * 12;
  });
  const lang = v.lang || '';
  if (/^en[-_]CA/i.test(lang)) score += 9;
  else if (/^en[-_](US|GB|AU|IE|NZ)/i.test(lang)) score += 6;
  else if (/^en/i.test(lang)) score += 3;
  if (v.localService === false) score += 2; // network voices usually richer
  return score;
}

/**
 * Pick the best available voice. Honours an explicit `preferredURI` when it still
 * exists; otherwise returns the highest-ranked English voice (or the best of any
 * language as a last resort).
 */
export function bestVoice(
  voices: SpeechSynthesisVoice[],
  preferredURI?: string | null,
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  if (preferredURI) {
    const match = voices.find(v => v.voiceURI === preferredURI);
    if (match) return match;
  }
  const english = voices.filter(v => /^en/i.test(v.lang || ''));
  const pool = english.length ? english : voices;
  return [...pool].sort((a, b) => rankVoice(b) - rankVoice(a))[0];
}

/**
 * Load the voice list, resolving once it's populated. Voices load asynchronously
 * in most browsers (the first `getVoices()` is often empty until
 * `onvoiceschanged` fires), so this waits — with a timeout fallback.
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', finish, { once: true });
    setTimeout(finish, 1200);
  });
}

/** Construct a SpeechRecognition instance, or null if unsupported. */
export function createRecognition(): any | null {
  if (!sttSupported()) return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}
