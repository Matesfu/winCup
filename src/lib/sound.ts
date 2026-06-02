"use client";

/**
 * Web Audio API sound engine — programmatic sounds, no audio files.
 * AudioContext is created lazily; browsers require a user gesture before audio
 * can start, so we expose resumeAudio() to call on first interaction.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Short sharp click played on each carousel step while spinning.
 * 800 Hz square wave, ~50 ms.
 */
export function playTick(): void {
  const ac = getContext();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = "square";
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.07, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.05);
  } catch {
    // AudioContext not ready; silently ignore
  }
}

/**
 * Deep thump played when the carousel lands on the assigned country.
 * Sine wave 180→60 Hz, ~300 ms.
 */
export function playThud(): void {
  const ac = getContext();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.2);
    gain.gain.setValueAtTime(0.5, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.3);
  } catch {
    // AudioContext not ready; silently ignore
  }
}

/**
 * Resume a suspended AudioContext (browsers suspend on load until user gesture).
 * Call once on the first user interaction (e.g. clicking the mute toggle).
 */
export function resumeAudio(): void {
  const ac = getContext();
  if (ac?.state === "suspended") {
    ac.resume().catch(() => {});
  }
}
