import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

interface RainVariables {
  rainIntensity: number;      // 0–100 mm/h
  duration: number;           // 5–360 minutes
  catchmentArea: number;      // 1–10000 m²
  windSpeed: number;          // 0–100 km/h
}

interface RainOutputs {
  instantIntensity: number;
  accumulatedVolume: number;
  precipitationType: string;
  dropSize: number;
  kineticEnergy: number;
  rainfallDepth: number;
  windDriftAngle: number;
  runoffEstimate: number;
}

@Component({
  selector: 'app-sim3-precipitacion',
  templateUrl: './sim3-precipitacion.component.html',
  styleUrls: ['./sim3-precipitacion.component.css']
})
export class Sim3PrecipitacionComponent implements OnInit, OnDestroy {

  vars: RainVariables = {
    rainIntensity: 25,
    duration: 60,
    catchmentArea: 100,
    windSpeed: 10
  };

  outputs: RainOutputs = {
    instantIntensity: 0,
    accumulatedVolume: 0,
    precipitationType: 'Moderada',
    dropSize: 0,
    kineticEnergy: 0,
    rainfallDepth: 0,
    windDriftAngle: 0,
    runoffEstimate: 0
  };

  rainDrops: any[] = [];
  splashParticles: any[] = [];
  lightningActive = false;

  // Audio Context & Nodes
  private audioCtx: AudioContext | null = null;
  private rainGain: GainNode | null = null;
  private audioInitialized = false;
  private thunderTimeout: any;

  private engineLoop: any;

  @HostListener('window:mousedown')
  @HostListener('window:keydown')
  unlockAudio() {
    if (this.audioInitialized) return;
    this.initAudio();
  }

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 500);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
    if (this.thunderTimeout) clearTimeout(this.thunderTimeout);
    this.destroyAudio();
  }

  // ─────────────────────────────────────────────────
  //  PROCEDURAL AUDIO SYSTEM
  // ─────────────────────────────────────────────────
  private initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Rain Noise Setup
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const rainSource = this.audioCtx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;

      const rainFilter = this.audioCtx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 1000;

      this.rainGain = this.audioCtx.createGain();
      this.rainGain.gain.value = 0;

      rainSource.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.audioCtx.destination);
      rainSource.start();

      this.audioInitialized = true;
      this.scheduleThunder();
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  }

  private scheduleThunder() {
    if (!this.audioInitialized) return;
    
    const delay = 5000 + Math.random() * 15000;
    this.thunderTimeout = setTimeout(() => {
      if (this.vars.rainIntensity > 60) {
        this.playThunder();
      }
      this.scheduleThunder();
    }, delay);
  }

  private playThunder() {
    if (!this.audioCtx) return;
    
    // Lightning visual sync
    this.lightningActive = true;
    setTimeout(() => this.lightningActive = false, 200);

    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + 3);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 80;

    g.gain.setValueAtTime(0, this.audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.4, this.audioCtx.currentTime + 0.2);
    g.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 4);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 4);
  }

  private updateAudio(intensity: number) {
    if (!this.audioInitialized || !this.audioCtx || !this.rainGain) return;
    const now = this.audioCtx.currentTime;
    const targetGain = (intensity / 100) * 0.25;
    this.rainGain.gain.linearRampToValueAtTime(targetGain, now + 1);
  }

  private destroyAudio() {
    if (this.audioCtx) this.audioCtx.close();
  }

  onVarChange(event: Event, key: keyof RainVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  private physicsTick() {
    const { rainIntensity, duration, catchmentArea, windSpeed } = this.vars;

    let precipitationType: string;
    if (rainIntensity <= 0) precipitationType = 'Ninguna';
    else if (rainIntensity < 2.5) precipitationType = 'Llovizna';
    else if (rainIntensity < 10) precipitationType = 'Moderada';
    else if (rainIntensity < 50) precipitationType = 'Fuerte';
    else precipitationType = 'Torrencial';

    const dropSize = rainIntensity > 0 ? Math.round((0.5 + 2 * Math.pow(rainIntensity / 100, 0.25)) * 100) / 100 : 0;
    const kineticEnergy = Math.round((11.87 + 8.73 * Math.log10(Math.max(1, rainIntensity))) * rainIntensity);
    const rainfallDepth = Math.round((rainIntensity * (duration / 60)) * 100) / 100;
    const accumulatedVolume = Math.round(rainfallDepth * catchmentArea);
    const windDriftAngle = Math.round(Math.atan(windSpeed / 30) * (180 / Math.PI));
    const runoffEstimate = Math.round((0.5 * rainIntensity * catchmentArea) / 60);

    this.outputs = {
      instantIntensity: rainIntensity,
      accumulatedVolume,
      precipitationType,
      dropSize,
      kineticEnergy,
      rainfallDepth,
      windDriftAngle,
      runoffEstimate
    };

    this.updateVisuals();
    this.updateAudio(rainIntensity);
  }

  private updateVisuals() {
    const dropCount = Math.floor(this.vars.rainIntensity * 1.5);
    this.rainDrops = Array(Math.max(0, dropCount)).fill(0).map(() => ({
      left: Math.random() * 100 + '%',
      duration: 0.4 + Math.random() * 0.4 + 's',
      delay: Math.random() * 2 + 's',
      height: 30 + Math.random() * 50 + 'px',
      opacity: 0.1 + Math.random() * 0.4
    }));

    const splashCount = Math.floor(this.vars.rainIntensity / 2);
    this.splashParticles = Array(Math.max(0, splashCount)).fill(0).map(() => ({
      left: Math.random() * 100 + '%',
      delay: Math.random() * 1 + 's'
    }));
  }

  getIntensityColor(): string {
    const i = this.vars.rainIntensity;
    if (i < 5) return '#aaa';
    if (i < 25) return '#00c8ff';
    if (i < 50) return '#0077ff';
    return '#ff4444';
  }
}
