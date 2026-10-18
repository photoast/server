/** Small synthesized camera cues, unlocked only from an explicit user gesture. */
export class BoothCaptureSound {
  private context: AudioContext | null = null
  async unlock(): Promise<boolean> {
    try {
      const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Constructor) return false
      this.context ||= new Constructor()
      if (this.context.state === 'suspended') await this.context.resume()
      return this.context.state === 'running'
    } catch { return false }
  }
  tick() {
    const ctx = this.context
    if (!ctx || ctx.state !== 'running') return
    const oscillator = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(820, now)
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.055, now + .006); gain.gain.exponentialRampToValueAtTime(.0001, now + .065)
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(now); oscillator.stop(now + .075)
  }
  shutter() {
    const ctx = this.context
    if (!ctx || ctx.state !== 'running') return
    for (const offset of [0, .075]) {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .055), ctx.sampleRate)
      const values = buffer.getChannelData(0)
      for (let i = 0; i < values.length; i++) values[i] = (Math.random() * 2 - 1) * Math.exp(-i / (values.length * .19))
      const source = ctx.createBufferSource(), gain = ctx.createGain(), filter = ctx.createBiquadFilter()
      source.buffer = buffer; filter.type = 'highpass'; filter.frequency.value = 1100; gain.gain.value = offset ? .22 : .32
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start(ctx.currentTime + offset)
    }
  }
  close() { void this.context?.close().catch(() => {}); this.context = null }
}
