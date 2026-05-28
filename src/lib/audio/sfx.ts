"use client";

/**
 * Web Audio synth for ambient UI sounds. Everything is generated at
 * runtime — no audio files, so the bundle stays small and the sounds
 * can respond to input parameters (e.g. randomized pitch on each
 * keystroke makes a run feel like real key rows).
 *
 * All entry points no-op when muted. The mute flag is sourced from the
 * same localStorage key as `useSoundToggle` so reload persistence works
 * without an extra subscription.
 *
 * Browser autoplay policy: the AudioContext stays suspended until the
 * first user gesture. The pointerdown handler in SoundAmbience kicks
 * resume() before requesting any sound — so the very first click is
 * silent, and every subsequent one rings.
 */

const MUTED_KEY = "debatethis.muted";

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _muted: boolean | null = null;
let _lastClickAt = 0;
let _lastKeystrokeAt = 0;
let _lastHoverAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  // Safari prefix.
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    _ctx = new Ctor();
    _master = _ctx.createGain();
    // Master ceiling — keep everything below conversation loudness.
    _master.gain.value = 0.5;
    _master.connect(_ctx.destination);
    return _ctx;
  } catch {
    return null;
  }
}

function isMuted(): boolean {
  if (_muted !== null) return _muted;
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(next: boolean): void {
  _muted = next;
}

/** Resume a suspended context — call from a user-gesture handler. */
export function ensureRunning(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {
      /* ignore — next gesture will retry */
    });
  }
}

/**
 * Faint lofi beep — short sine tone with a falling tail. Sub-100 ms so it
 * never lingers on top of itself. Slight pitch jitter per call so repeated
 * clicks don't sound like a metronome.
 */
export function playClick(): void {
  if (isMuted()) return;
  const now = performance.now();
  if (now - _lastClickAt < 40) return; // anti-spam
  _lastClickAt = now;
  const ctx = getCtx();
  if (!ctx || !_master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const base = 660 + Math.random() * 60;
  osc.frequency.setValueAtTime(base, t);
  // Drop a perfect-fifth over the tail — gives it that satisfying
  // "blip" character without straying into chiptune.
  osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.08);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.06, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(lp).connect(g).connect(_master);
  osc.start(t);
  osc.stop(t + 0.11);
}

/**
 * Hover chime — short high-pitched bell ping. Roughly half the gain of
 * a click and twice the pitch, so it reads as "noticed you" rather than
 * "you clicked". Slight pitch jitter per call so a sweep across a row
 * of cards doesn't sound robotic.
 */
export function playHoverChime(): void {
  if (isMuted()) return;
  const now = performance.now();
  if (now - _lastHoverAt < 60) return; // anti-spam on fast cursor moves
  _lastHoverAt = now;
  const ctx = getCtx();
  if (!ctx || !_master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  const base = 1200 + Math.random() * 200;
  osc.frequency.setValueAtTime(base, t);
  // Tiny upward pitch slide — gives it the "ping" character of a small
  // bell rather than a flat tone.
  osc.frequency.exponentialRampToValueAtTime(base * 1.05, t + 0.04);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  // Half the click's peak gain so a hover never feels louder than a
  // commit.
  g.gain.linearRampToValueAtTime(0.025, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(g).connect(_master);
  osc.start(t);
  osc.stop(t + 0.1);
}

/**
 * Mechanical keystroke clack — narrowband noise burst with a snappy
 * envelope. The bandpass center is randomized per call so a fast scroll
 * sounds like a typist tapping different rows, not a stuck key.
 */
export function playKeystroke(): void {
  if (isMuted()) return;
  const now = performance.now();
  if (now - _lastKeystrokeAt < 25) return;
  _lastKeystrokeAt = now;
  const ctx = getCtx();
  if (!ctx || !_master) return;
  const t = ctx.currentTime;
  const noiseDur = 0.025;
  const buf = ctx.createBuffer(
    1,
    Math.max(1, Math.floor(ctx.sampleRate * noiseDur)),
    ctx.sampleRate,
  );
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.6;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800 + Math.random() * 600;
  bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.04, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + noiseDur);
  src.connect(bp).connect(g).connect(_master);
  src.start(t);
  src.stop(t + noiseDur + 0.01);
}
