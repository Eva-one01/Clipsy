import { useCallback, useEffect, useRef, useState } from 'react';
import { desktop, type VoiceState } from './bridge';

/**
 * Dictado por voz de la barra rápida (solo escritorio).
 * Graba del micrófono a WAV mono de 16 kHz, se detiene sola cuando la persona deja de hablar
 * y el proceso principal lo pasa a texto con whisper.cpp, en el equipo (desktop/voice.js).
 */

const RATE = 16000;
const SILENCE_MS = 1200; // tras hablar, este silencio termina la grabación
const NO_SPEECH_MS = 7000; // si en este tiempo no se oye nada, se deja de escuchar
const MAX_MS = 15000;

export type VoicePhase = 'idle' | 'listening' | 'transcribing';
export type VoiceError = 'no_mic' | 'silence' | 'failed' | 'install' | null;

function wav(chunks: Float32Array[], minSamples: number): ArrayBuffer {
  const n = Math.max(minSamples, chunks.reduce((a, c) => a + c.length, 0));
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 0x7fff, true);
  }
  return buf; // el resto (relleno hasta minSamples) queda en silencio
}

interface Recording {
  /** Termina ya y devuelve lo grabado. */
  stop(): void;
  /** Descarta la grabación. */
  cancel(): void;
  /** WAV, o null si no se oyó a nadie o se canceló. */
  done: Promise<ArrayBuffer | null>;
}

async function record(onLevel: (v: number) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ctx = new AudioContext({ sampleRate: RATE });
  const src = ctx.createMediaStreamSource(stream);
  // ScriptProcessor: sencillo y sin archivos aparte (un AudioWorklet necesitaría cargar otro script).
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let heard = false;
  let quietMs = 0;
  let totalMs = 0;
  let floor = 0.01; // ruido de fondo, se ajusta con lo primero que se graba
  let settle: (v: ArrayBuffer | null) => void = () => undefined;
  const done = new Promise<ArrayBuffer | null>((r) => (settle = r));
  let ended = false;
  const end = (keep: boolean) => {
    if (ended) return;
    ended = true;
    node.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => undefined);
    onLevel(0);
    settle(keep && heard ? wav(chunks, RATE * 1.1) : null);
  };
  node.onaudioprocess = (e) => {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    chunks.push(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const ms = (data.length / RATE) * 1000;
    totalMs += ms;
    if (totalMs <= 300) floor = Math.max(floor, rms * 1.5);
    const speaking = rms > Math.max(0.02, floor * 2);
    onLevel(Math.min(1, rms * 8));
    if (speaking) {
      heard = true;
      quietMs = 0;
    } else quietMs += ms;
    if ((heard && quietMs >= SILENCE_MS) || (!heard && totalMs >= NO_SPEECH_MS) || totalMs >= MAX_MS) end(true);
  };
  src.connect(node);
  node.connect(ctx.destination);
  return { stop: () => end(true), cancel: () => end(false), done };
}

/** Estado del dictado para la barra rápida: escuchar, transcribir e instalar el motor la primera vez. */
export function useVoice(lang: string, onText: (text: string) => void) {
  const api = desktop?.voice;
  const [state, setState] = useState<VoiceState | null>(null);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<VoiceError>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const rec = useRef<Recording | null>(null);
  const textCb = useRef(onText);
  textCb.current = onText;

  useEffect(() => {
    if (!api) return;
    api.status().then(setState).catch(() => undefined);
    return api.onChange((st) => {
      setState(st);
      if (st.error) setError('install');
      if (st.installed) setNeedsSetup(false);
    });
  }, [api]);

  const cancel = useCallback(() => {
    rec.current?.cancel();
    rec.current = null;
    setPhase('idle');
    setError(null);
  }, []);

  const start = useCallback(async () => {
    if (!api || rec.current) return;
    setError(null);
    const st = await api.status().catch(() => null);
    if (st) setState(st);
    if (!st?.supported) return;
    if (!st.installed) {
      setNeedsSetup(true);
      return;
    }
    let r: Recording;
    try {
      r = await record(setLevel);
    } catch {
      setError('no_mic');
      return;
    }
    rec.current = r;
    setPhase('listening');
    const audio = await r.done;
    if (rec.current !== r) return; // se canceló
    rec.current = null;
    if (!audio) {
      setPhase('idle');
      setError('silence');
      return;
    }
    setPhase('transcribing');
    const res = await api.transcribe(audio, lang).catch(() => null);
    setPhase('idle');
    if (res?.ok && res.text) textCb.current(res.text);
    else setError(res?.ok ? 'silence' : 'failed');
  }, [api, lang]);

  /** Botón o atajo: empieza a escuchar o termina la frase. */
  const toggle = useCallback(() => {
    if (rec.current) rec.current.stop();
    else if (phase === 'idle') start();
  }, [phase, start]);

  const install = useCallback(async () => {
    if (!api) return;
    setError(null);
    const st = await api.install().catch(() => null);
    if (st) setState(st);
    if (st?.installed) {
      setNeedsSetup(false);
      start();
    } else setError('install');
  }, [api, start]);

  // Si la barra se oculta mientras escucha, se descarta lo grabado.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBlur = () => rec.current && cancel();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [cancel]);

  return {
    available: !!api && !!state?.supported,
    state,
    phase,
    level,
    error,
    needsSetup: needsSetup && !state?.installed,
    toggle,
    cancel,
    install,
    clearError: () => setError(null),
  };
}
