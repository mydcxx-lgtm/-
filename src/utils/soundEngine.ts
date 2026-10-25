/**
 * Museum-grade Web Audio API acoustic synthesizer
 * Produces subtle horological ticks, velvet card flips, and harmonic singing-bowl chimes
 * without requiring external MP3 assets.
 */
class MuseumSoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Subtle mechanical escapement tick during wheel/sphere/card shuffling
   */
  public playTick(pitchFactor = 1, enabled = true): void {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 * pitchFactor, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Rich harmonic chord when a winner or curated team is unveiled
   */
  public playRevealChime(enabled = true): void {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Warm Lydian/Major9 museum resonance frequencies (Hz)
    const freqs = [440, 554.37, 659.25, 830.61, 987.77];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.045);
      gain.gain.linearRampToValueAtTime(0.055 / (idx * 0.4 + 1), now + idx * 0.045 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 1.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 1.45);
    });
  }
}

export const soundEngine = new MuseumSoundEngine();
