/**
 * @file VoiceContext.tsx
 * @description App-wide voice state built on the free Web Speech API. Owns the
 * user's voice preferences (master enable, auto-read, chosen voice, rate) — which
 * persist server-side via the Django-backed preference store so they follow the
 * user across devices — and exposes a single `speak()`/`cancel()` the whole app
 * shares (so starting a new read always stops the previous one).
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { ttsSupported, sttSupported, loadVoices, bestVoice } from '../services/speech';
import { getCachedPreference, loadPreference, savePreference } from '../services/preferences';

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
  const supported = ttsSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<VoiceSettings>(() => ({
    ...DEFAULTS,
    ...getCachedPreference<Partial<VoiceSettings>>(PREF_KEY, {}),
  }));
  const keepAlive = useRef<number | null>(null);

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

  // Stop any speech if the tab is hidden or the provider unmounts.
  useEffect(() => {
    const onHide = () => { if (document.hidden && supported) window.speechSynthesis.cancel(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stopKeepAlive = () => {
    if (keepAlive.current !== null) { clearInterval(keepAlive.current); keepAlive.current = null; }
  };

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    stopKeepAlive();
    setSpeaking(false);
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback((text: string, opts?: { id?: string; force?: boolean }) => {
    if (!supported || !text?.trim()) return;
    if (!settings.enabled && !opts?.force) return;
    const synth = window.speechSynthesis;
    synth.cancel(); // never overlap reads
    stopKeepAlive();

    const u = new SpeechSynthesisUtterance(text);
    const v = bestVoice(voices, settings.voiceURI);
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = settings.rate;
    u.pitch = 1;
    u.onstart = () => { setSpeaking(true); setSpeakingId(opts?.id ?? null); };
    const done = () => { stopKeepAlive(); setSpeaking(false); setSpeakingId(null); };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);

    // Chrome silently stops utterances after ~15s — nudge it to keep going.
    keepAlive.current = window.setInterval(() => {
      if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
    }, 10000);
  }, [supported, settings.enabled, settings.voiceURI, settings.rate, voices]);

  const toggle = useCallback((text: string, id?: string) => {
    if (speaking && speakingId === (id ?? null)) cancel();
    else speak(text, { id, force: true });
  }, [speaking, speakingId, cancel, speak]);

  const update = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      savePreference(PREF_KEY, next, 'voice');
      // Turning voice off mid-read should stop it immediately.
      if (patch.enabled === false && supported) window.speechSynthesis.cancel();
      return next;
    });
  }, [supported]);

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
