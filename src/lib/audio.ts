/**
 * Procedural web audio mechanical keyboard click synthesizer.
 * Does not require any external sound assets or network calls.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playKeyboardClick(soundType: "mech" | "typewriter" | "space" | "return" = "mech") {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    if (soundType === "space") {
      // Deep wooden spacebar thud
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(100, now);
      osc1.frequency.exponentialRampToValueAtTime(70, now + 0.08);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(150, now);
      osc2.frequency.exponentialRampToValueAtTime(50, now + 0.08);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(250, now);

      gainNode.gain.setValueAtTime(0.18, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.13);
      osc2.stop(now + 0.13);

    } else if (soundType === "return") {
      // Loud spring/carriage return sound
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(180, now);
      osc1.frequency.exponentialRampToValueAtTime(90, now + 0.12);

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(220, now);
      osc2.frequency.exponentialRampToValueAtTime(110, now + 0.15);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(450, now);

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);

    } else if (soundType === "typewriter") {
      // Direct, crisp vintage strike with small transient
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1200, now);
      osc1.frequency.exponentialRampToValueAtTime(150, now + 0.05);

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(180, now);
      osc2.frequency.exponentialRampToValueAtTime(120, now + 0.08);

      filter.type = "highpass";
      filter.frequency.setValueAtTime(180, now);

      gainNode.gain.setValueAtTime(0.14, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.1);
      osc2.stop(now + 0.1);

    } else {
      // Modern "blue switch" mechanical click: dual peak
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(950, now);
      osc1.frequency.exponentialRampToValueAtTime(1300, now + 0.015);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(400, now);
      osc2.frequency.exponentialRampToValueAtTime(120, now + 0.03);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(3.0, now);

      gainNode.gain.setValueAtTime(0.07, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.04);
      osc2.stop(now + 0.04);
    }
  } catch (error) {
    // Fail-safe if AudioContext blocks or is disabled
  }
}
