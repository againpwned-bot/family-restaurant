type Kind = "order" | "ready" | "alert";

let ctx: AudioContext | null = null;
const MUTE_KEY = "sound-muted";

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function installAudioUnlock() {
  if (typeof window === "undefined") return () => {};
  const unlock = () => {
    const c = context();
    if (c && c.state === "suspended") void c.resume();
    if (c?.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

export function isSoundBlocked(): boolean {
  return !ctx || ctx.state !== "running";
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
  }
}

const NOTES: Record<Kind, number[]> = {
  order: [660, 880, 1046.5],
  ready: [784, 988, 1318.5],
  alert: [523.25, 392],
};

export function playChime(kind: Kind = "order") {
  if (isMuted()) return;
  const c = context();
  if (!c || c.state !== "running") return;
  const start = c.currentTime + 0.01;
  NOTES[kind].forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = start + i * 0.13;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}
