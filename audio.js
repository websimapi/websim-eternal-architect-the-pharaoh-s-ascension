// Procedural Audio Engine to handle "Synchronicity"
export class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bpm = 60; // Resting heart rate of the pyramid
        this.nextNoteTime = 0;
        this.beatCount = 0;
        this.listeners = []; // Callbacks for beat events
        this.isPlaying = false;
        
        // Master gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4;
        this.masterGain.connect(this.ctx.destination);
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    scheduler() {
        if (!this.isPlaying) return;

        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playBeat(this.nextNoteTime);
            this.scheduleNextBeat();
        }
        requestAnimationFrame(() => this.scheduler());
    }

    scheduleNextBeat() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += secondsPerBeat;
        this.beatCount++;
    }

    playBeat(time) {
        // Dispatch event to visuals
        this.listeners.forEach(cb => cb(this.beatCount, time));

        // Create Sound
        // 1. The Kick (Heartbeat)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);

        // 2. High Hat / Tick (Digital) - every other beat
        if (this.beatCount % 2 === 0) {
            const noiseBuffer = this.createNoiseBuffer();
            const noise = this.ctx.createBufferSource();
            const noiseGain = this.ctx.createGain();
            
            noise.buffer = noiseBuffer;
            noise.connect(noiseGain);
            noiseGain.connect(this.masterGain);
            
            noiseGain.gain.setValueAtTime(0.1, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
            
            noise.start(time);
        }
    }

    createNoiseBuffer() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // Call this to sync visuals or gameplay logic
    onBeat(callback) {
        this.listeners.push(callback);
    }

    setMood(type) {
        // Change BPM or synth timbre based on mood (Bio, Digi, Music, Dim)
        switch(type) {
            case 'bio': this.bpm = 60; break;
            case 'digi': this.bpm = 120; break;
            case 'music': this.bpm = 90; break; // Waltz?
            case 'dim': this.bpm = 45; break; // Slow, heavy
        }
    }

    // Simple FX for interaction
    playSound(type) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);

        if (type === 'collect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.3);
        } else if (type === 'hit') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
            gain.gain.setValueAtTime(0.5, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.2);
        }

        osc.start(t);
        osc.stop(t + 0.3);
    }
}