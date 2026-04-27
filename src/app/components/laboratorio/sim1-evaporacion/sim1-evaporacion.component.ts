import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

interface EvapVariables {
  waterTemperature: number;     // 0–100 °C
  solarRadiation: number;       // 0–100 %
  windSpeed: number;            // 1–100 km/h
  humidity: number;             // 0–100 %
}

interface EvapOutputs {
  evaporationRate: number;
  waterSurfaceTemp: number;
  vaporPressure: number;
  saturationVaporPressure: number;
  vaporPressureDeficit: number;
  phaseState: string;
  molecularActivity: string;
}

@Component({
  selector: 'app-sim1-evaporacion',
  templateUrl: './sim1-evaporacion.component.html',
  styleUrls: ['./sim1-evaporacion.component.css']
})
export class Sim1EvaporacionComponent implements OnInit, OnDestroy {

  vars: EvapVariables = {
    waterTemperature: 25,
    solarRadiation: 50,
    windSpeed: 15,
    humidity: 40
  };

  outputs: EvapOutputs = {
    evaporationRate: 0,
    waterSurfaceTemp: 25,
    vaporPressure: 0,
    saturationVaporPressure: 0,
    vaporPressureDeficit: 0,
    phaseState: 'Líquido',
    molecularActivity: 'Normal'
  };

  vaporParticles: any[] = [];
  heatShimmerActive = false;
  boilingActive = false;

  // Audio Context & Nodes
  private audioCtx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private boilGain: GainNode | null = null;
  private audioInitialized = false;

  private engineLoop: any;

  constructor() {}

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
    this.destroyAudio();
  }

  // ─────────────────────────────────────────────────
  //  PROCEDURAL AUDIO SYSTEM
  // ─────────────────────────────────────────────────
  private initAudio() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Wind Noise Setup
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const windSource = this.audioCtx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      const windFilter = this.audioCtx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 400;

      this.windGain = this.audioCtx.createGain();
      this.windGain.gain.value = 0;

      windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.audioCtx.destination);
      windSource.start();

      // Boil Sound Setup (Simple recurring "pop" style noise)
      this.boilGain = this.audioCtx.createGain();
      this.boilGain.gain.value = 0;
      this.boilGain.connect(this.audioCtx.destination);

      this.audioInitialized = true;
      console.log('Sim1 Audio Initialized');
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  }

  private updateAudio(windSpeed: number, boiling: boolean) {
    if (!this.audioInitialized || !this.audioCtx || !this.windGain || !this.boilGain) return;

    const now = this.audioCtx.currentTime;

    // Wind volume
    const targetWindGain = (windSpeed / 100) * 0.15;
    this.windGain.gain.linearRampToValueAtTime(targetWindGain, now + 0.5);

    // Boil sound (procedural bubbles)
    if (boiling && this.boilGain.gain.value < 0.1) {
      this.boilGain.gain.linearRampToValueAtTime(0.1, now + 1);
      this.playBoilLoop();
    } else if (!boiling && this.boilGain.gain.value > 0) {
      this.boilGain.gain.linearRampToValueAtTime(0, now + 1);
    }
  }

  private playBoilLoop() {
    if (!this.boilingActive || !this.audioCtx || !this.boilGain) return;

    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100 + Math.random() * 200, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.audioCtx.currentTime + 0.1);

    g.gain.setValueAtTime(0, this.audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.05, this.audioCtx.currentTime + 0.02);
    g.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.1);

    osc.connect(g);
    g.connect(this.boilGain);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.1);

    setTimeout(() => this.playBoilLoop(), 100 + Math.random() * 200);
  }

  private destroyAudio() {
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }

  onVarChange(event: Event, key: keyof EvapVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  private physicsTick() {
    const { waterTemperature, solarRadiation, windSpeed, humidity } = this.vars;

    const solarHeating = solarRadiation * 0.12;
    const windMixing = 1 - (windSpeed / 200);
    const waterSurfaceTemp = Math.round(
      (waterTemperature + solarHeating * Math.max(0.3, windMixing)) * 10
    ) / 10;

    const satVP = 0.6108 * Math.exp((17.27 * waterSurfaceTemp) / (waterSurfaceTemp + 237.3));
    const actualVP = (humidity / 100) * satVP;
    const vpd = Math.max(0, satVP - actualVP);

    const windFunction = 0.5 + 0.54 * Math.sqrt(windSpeed / 100);
    const radiationFactor = 0.3 + 0.7 * (solarRadiation / 100);
    const tempBoost = Math.max(0, Math.exp(0.05 * (waterTemperature - 20)) - 0.3);
    const humidityBlock = Math.pow(Math.max(0, 1 - humidity / 100), 1.3);

    let evapRate = (vpd * windFunction * radiationFactor * tempBoost * 120) * humidityBlock;

    if (waterTemperature <= 0) {
      evapRate *= 0.05;
    } else if (waterTemperature < 5) {
      evapRate *= (waterTemperature / 5) * 0.3;
    }

    if (waterTemperature >= 100) {
      evapRate = 92 + (solarRadiation / 100) * 8;
    }

    evapRate = Math.max(0, Math.min(100, evapRate));

    let phaseState: string;
    let molecularActivity: string;

    if (waterTemperature <= 0) {
      phaseState = 'Sólido (Hielo)';
      molecularActivity = 'Mínima';
    } else if (waterTemperature < 40) {
      phaseState = 'Líquido';
      molecularActivity = 'Moderada';
    } else if (waterTemperature < 100) {
      phaseState = 'Líquido Caliente';
      molecularActivity = 'Alta';
    } else {
      phaseState = 'Vapor de Agua';
      molecularActivity = 'Máxima';
    }

    this.outputs = {
      evaporationRate: Math.round(evapRate),
      waterSurfaceTemp,
      vaporPressure: Math.round(actualVP * 1000) / 1000,
      saturationVaporPressure: Math.round(satVP * 1000) / 1000,
      vaporPressureDeficit: Math.round(vpd * 1000) / 1000,
      phaseState,
      molecularActivity
    };

    this.heatShimmerActive = waterTemperature > 45 && solarRadiation > 30;
    this.boilingActive = waterTemperature >= 95;

    this.updateParticles(evapRate);
    this.updateAudio(windSpeed, this.boilingActive);
  }

  private updateParticles(rate: number) {
    const count = Math.floor(rate / 1.5);
    this.vaporParticles = Array(Math.max(0, count)).fill(0).map(() => ({
      left: 5 + Math.random() * 90 + '%',
      duration: 3 + Math.random() * 5 + 's',
      delay: Math.random() * 5 + 's',
      size: 15 + Math.random() * 30 + 'px'
    }));
  }

  getEvapState(rate: number): string {
    if (rate <= 2) return 'Nula';
    if (rate < 35) return 'Leve';
    if (rate < 75) return 'Moderada';
    return 'Intensa';
  }

  getPhaseColor(): string {
    const t = this.vars.waterTemperature;
    if (t <= 0) return '#a0e8ff';
    if (t < 40) return '#00c8ff';
    if (t < 70) return '#ff9500';
    return '#ff4444';
  }
}
