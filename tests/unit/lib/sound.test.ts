/**
 * Sound engine tests — verify the functions don't crash in non-browser environments.
 * AudioContext is not available in jsdom, so we test graceful degradation.
 */

// Ensure window.AudioContext is absent (jsdom doesn't provide it)
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).AudioContext;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).webkitAudioContext;
});

describe("Sound engine (graceful degradation)", () => {
  it("playTick does not throw when AudioContext is unavailable", async () => {
    // Dynamic import triggers the "use client" module; jest doesn't restrict this
    const { playTick } = await import("@/lib/sound");
    expect(() => playTick()).not.toThrow();
  });

  it("playThud does not throw when AudioContext is unavailable", async () => {
    const { playThud } = await import("@/lib/sound");
    expect(() => playThud()).not.toThrow();
  });

  it("resumeAudio does not throw when AudioContext is unavailable", async () => {
    const { resumeAudio } = await import("@/lib/sound");
    expect(() => resumeAudio()).not.toThrow();
  });
});
