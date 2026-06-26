/**
 * @file VoiceContext.tsx
 * @description App-wide voice state built on the free Web Speech API. Owns the
 * user's voice preferences (master enable, auto-read, chosen voice, rate) — which
 * persist server-side via the Django-backed preference store so they follow the
 * user across devices — and exposes a single `speak()`/`cancel()` the whole app
 * shares (so starting a new read always stops the previous one).
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { ttsSupported, sttSupported, loadVoices, bestVoice, DEFAULT_NEURAL_VOICE } from '../services/speech';
import { getCachedPreference, loadPreference, savePreference } from '../services/preferences';
import { api } from '../services/api';

export interface VoiceSettings {
  /** Master on/off for all read-aloud UI. */
  enabled: boolean;
  /** Auto-speak new questions / client replies as they appear. */
  autoRead: boolean;
  /** Preferred voiceURI (null = best auto-picked). */
  voiceURI: string | null;
  /** Speaking rate, 0.5–1.5. */
  rate: number;
}

const PREF_KEY = 'voice_settings';
const DEFAULTS: VoiceSettings = { enabled: true, autoRead: false, voiceURI: null, rate: 1 };

interface VoiceContextValue {
  supported: boolean;
  recognitionSupported: boolean;
  voices: SpeechSynthesisVoice[];
  speaking: boolean;
  /** Identifier of the currently-spoken target, so a SpeakButton can show its own state. */
  speakingId: string | null;
  settings: VoiceSettings;
  update: (patch: Partial<VoiceSettings>) => void;
  /** Speak text. `force` ignores the auto-read gate (used by explicit Speak buttons). */
  speak: (text: string, opts?: { id?: string; force?: boolean }) => void;
  cancel: () => void;
  /** Speak this target, or stop if it's already the one speaking. */
  toggle: (text: string, id?: string) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const browserTts = ttsSupported();
  // Voice UI is available in any browser: the natural server voice works
  // everywhere, with browser speechSynthesis as the offline fallback.
  const supported = typeof window !== 'undefined';
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>(() => ({
    ...DEFAULTS,
    ...getCachedPreference<Partial<VoiceSettings>>(PREF_KEY, {}),
  }));
  const keepAlive = useRef<number | null>(null);
  // Active natural-voice audio element + its object URL, and a monotonic token so
  // a newer speak() supersedes an in-flight fetch from an older one.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const reqToken = useRef(0);

  // Load available voices (async in most browsers) once.
  useEffect(() => {
    if (!supported) return;
    let active = true;
    loadVoices().then(v => { if (active) setVoices(v); });
    return () => { active = false; };
  }, [supported]);

  // Reconcile settings with the server copy (cross-device) after mount.
  useEffect(() => {
    loadPreference<VoiceSettings>(PREF_KEY, settings).then(s => setSettings(prev => ({ ...prev, ...s })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop any speech (natural audio + browser) if the tab is hidden or the
  // provider unmounts.
  useEffect(() => {
    const stopAll = () => {
      reqToken.current++;
      if (audioRef.current) { try { audioRef.current.pause(); } catch { /* ignore */ } }
      if (browserTts) window.speechSynthesis.cancel();
      setSpeaking(false);
      setSpeakingId(null);
    };
    const onHide = () => { if (document.hidden) stopAll(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); stopAll(); };
  }, [browserTts]);

  const stopKeepAlive = () => {
    if (keepAlive.current !== null) { clearInterval(keepAlive.current); keepAlive.current = null; }
  };

  const stopAudio = () => {
    if (audioRef.current) { try { audioRef.current.pause(); } catch { /* ignore */ } audioRef.current.src = ''; audioRef.current = null; }
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
  };

  const cancel = useCallback(() => {
    reqToken.current++; // invalidate any in-flight natural-voice fetch
    stopAudio();
    if (browserTts) window.speechSynthesis.cancel();
    stopKeepAlive();
    setSpeaking(false);
    setSpeakingId(null);
  }, [browserTts]);

  // Offline / fallback path: the browser's built-in (robotic) speechSynthesis.
  const browserSpeak = useCallback((text: string, id: string | null) => {
    if (!browserTts) { setSpeaking(false); setSpeakingId(null); return; }
    const synth = window.speechSynthesis;
    const start = () => {
      if (synth.paused) synth.resume();
      const live = synth.getVoices();
      const u = new SpeechSynthesisUtterance(text);
      const v = bestVoice(live.length ? live : voices, null);
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
      u.rate = settings.rate; u.pitch = 1;
      u.onstart = () => { setSpeaking(true); setSpeakingId(id); };
      const done = () => { stopKeepAlive(); setSpeaking(false); setSpeakingId(null); };
      u.onend = done; u.onerror = done;
      synth.speak(u);
      keepAlive.current = window.setInterval(() => {
        if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
      }, 10000);
    };
    stopKeepAlive();
    if (synth.speaking || synth.pending || synth.paused) { synth.cancel(); window.setTimeout(start, 90); }
    else { start(); }
  }, [browserTts, voices, settings.rate]);

  const speak = useCallback((text: string, opts?: { id?: string; force?: boolean }) => {
    if (!text?.trim()) return;
    if (!settings.enabled && !opts?.force) return;
    const id = opts?.id ?? null;

    // Stop anything playing and claim this request.
    stopAudio();
    if (browserTts) window.speechSynthesis.cancel();
    stopKeepAlive();
    const token = ++reqToken.current;
    // Optimistically light up the control (the natural fetch adds ~1s latency).
    setSpeaking(true);
    setSpeakingId(id);

    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!online) { browserSpeak(text, id); return; }

    // Natural neural voice from the backend; fall back to browser TTS on any miss.
    api.tts(text, settings.voiceURI || DEFAULT_NEURAL_VOICE, settings.rate).then(blob => {
      if (token !== reqToken.current) return; // superseded by a newer speak()/cancel()
      if (!blob) { browserSpeak(text, id); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audioUrlRef.current = url;
      audio.onplay = () => { if (token === reqToken.current) { setSpeaking(true); setSpeakingId(id); } };
      audio.onended = () => { if (token === reqToken.current) { stopAudio(); setSpeaking(false); setSpeakingId(null); } };
      audio.onerror = () => { if (token === reqToken.current) { stopAudio(); browserSpeak(text, id); } };
      // play() can reject under autoplay policy (e.g. auto-read with no gesture) → fall back.
      audio.play().catch(() => { if (token === reqToken.current) { stopAudio(); browserSpeak(text, id); } });
    }).catch(() => { if (token === reqToken.current) browserSpeak(text, id); });
  }, [settings.enabled, settings.voiceURI, settings.rate, browserSpeak, browserTts]);

  const toggle = useCallback((text: string, id?: string) => {
    if (speaking && speakingId === (id ?? null)) cancel();
    else speak(text, { id, force: true });
  }, [speaking, speakingId, cancel, speak]);

  const update = useCallback((patch: Partial<VoiceSettings>) => {
    // Turning voice off mid-read should stop it (audio + browser) immediately.
    if (patch.enabled === false) cancel();
    setSettings(prev => {
      const next = { ...prev, ...patch };
      savePreference(PREF_KEY, next, 'voice');
      return next;
    });
  }, [cancel]);

  return (
    <VoiceContext.Provider value={{
      supported,
      recognitionSupported: sttSupported(),
      voices,
      speaking,
      speakingId,
      settings,
      update,
      speak,
      cancel,
      toggle,
    }}>
      {children}
    </VoiceContext.Provider>
  );
};

/** Access the shared voice state. Must be used within <VoiceProvider>. */
export const useVoice = (): VoiceContextValue => {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within <VoiceProvider>');
  return ctx;
};
