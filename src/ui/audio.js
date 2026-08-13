export class Sound {
  constructor() { this.ctx = null; }
  ensure() { if (!this.ctx) this.ctx = new AudioContext(); return this.ctx; }
  tone(freq, duration=.08, type="sine", gain=.035) {
    try { const ctx=this.ensure(), osc=ctx.createOscillator(), amp=ctx.createGain(); osc.type=type;osc.frequency.value=freq;amp.gain.value=gain;osc.connect(amp);amp.connect(ctx.destination);osc.start();amp.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);osc.stop(ctx.currentTime+duration); } catch {}
  }
  action(){this.tone(280,.05,"square",.018)}
  narrator(){this.tone(185,.12,"sine",.03)}
  prophecy(){this.tone(440,.18,"triangle",.035)}
  error(){this.tone(120,.16,"sawtooth",.025)}
}
