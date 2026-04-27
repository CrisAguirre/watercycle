import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

interface CondVariables {
  airTemperature: number;         // -10 to 50 °C
  humidity: number;               // 0–100 %
  atmosphericPressure: number;    // 900–1100 hPa
  altitude: number;               // 0–5000 m
}

interface CondOutputs {
  dewPoint: number;
  condensationRate: number;
  cloudMass: number;
  deltaTdew: number;
  tempAtAltitude: number;
  relativeHumidityAtAlt: number;
  cloudBaseAltitude: number;
  cloudState: string;
  atmosphericStability: string;
}

@Component({
  selector: 'app-sim2-condensacion',
  templateUrl: './sim2-condensacion.component.html',
  styleUrls: ['./sim2-condensacion.component.css']
})
export class Sim2CondensacionComponent implements OnInit, OnDestroy {

  vars: CondVariables = {
    airTemperature: 22,
    humidity: 60,
    atmosphericPressure: 1013,
    altitude: 1500
  };

  outputs: CondOutputs = {
    dewPoint: 0,
    condensationRate: 0,
    cloudMass: 0,
    deltaTdew: 0,
    tempAtAltitude: 0,
    relativeHumidityAtAlt: 0,
    cloudBaseAltitude: 0,
    cloudState: 'Despejado',
    atmosphericStability: 'Estable'
  };

  cloudParticles: any[] = [];
  fogActive = false;

  // Audio Context & Nodes
  private audioCtx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private audioInitialized = false;
  private thunderTimeout: any;

  private stockCloudMass = 0;
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
      
      // Atmospheric Wind Setup
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
      windFilter.frequency.value = 300;

      this.windGain = this.audioCtx.createGain();
      this.windGain.gain.value = 0;

      windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.audioCtx.destination);
      windSource.start();

      this.audioInitialized = true;
      this.scheduleThunder();
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  }

  private scheduleThunder() {
    if (!this.audioInitialized) return;
    
    const delay = 10000 + Math.random() * 20000;
    this.thunderTimeout = setTimeout(() => {
      if (this.stockCloudMass > 85) {
        this.playThunder();
      }
      this.scheduleThunder();
    }, delay);
  }

  private playThunder() {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const g = this.audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.audioCtx.currentTime + 2);

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 100;

    g.gain.setValueAtTime(0, this.audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.3, this.audioCtx.currentTime + 0.1);
    g.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 2.5);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 2.5);
  }

  private updateAudio(altitude: number) {
    if (!this.audioInitialized || !this.audioCtx || !this.windGain) return;
    const now = this.audioCtx.currentTime;
    // Wind is louder and "thinner" at high altitude
    const targetGain = 0.05 + (altitude / 5000) * 0.15;
    this.windGain.gain.linearRampToValueAtTime(targetGain, now + 1);
  }

  private destroyAudio() {
    if (this.audioCtx) this.audioCtx.close();
  }

  onVarChange(event: Event, key: keyof CondVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  private physicsTick() {
    const { airTemperature, humidity, atmosphericPressure, altitude } = this.vars;

    const a = 17.27, b = 237.3;
    const humClamp = Math.max(1, humidity);
    const alpha = (a * airTemperature) / (b + airTemperature) + Math.log(humClamp / 100);
    const dewPoint = Math.round(((b * alpha) / (a - alpha)) * 10) / 10;

    const lapseRate = 6.5; 
    const tempAtAltitude = Math.round((airTemperature - (altitude / 1000) * lapseRate) * 10) / 10;

    const satVPsurface = 0.6108 * Math.exp((a * airTemperature) / (b + airTemperature));
    const satVPaltitude = 0.6108 * Math.exp((a * tempAtAltitude) / (b + tempAtAltitude));
    const actualVP = (humidity / 100) * satVPsurface;
    let relHumAtAlt = Math.min(100, Math.round((actualVP / satVPaltitude) * 100));
    if (satVPaltitude <= 0) relHumAtAlt = 100;

    const deltaTdew = Math.round((airTemperature - dewPoint) * 10) / 10;
    const cloudBaseAltitude = Math.max(0, Math.round(125 * Math.max(0, deltaTdew)));

    let condensationEfficiency = 0;
    if (deltaTdew <= 1) condensationEfficiency = 1.0;
    else if (deltaTdew <= 5) condensationEfficiency = 0.7;
    else if (deltaTdew <= 15) condensationEfficiency = 0.2;
    else condensationEfficiency = 0.02;

    const altitudeAboveLCL = altitude - cloudBaseAltitude;
    let altitudeFactor = altitudeAboveLCL > 0 ? Math.min(1.5, altitudeAboveLCL / 1500) : 0;
    const pressureFactor = 1 + (1013 - atmosphericPressure) * 0.003;
    const humidityFactor = Math.pow(humidity / 100, 0.8);

    const condensationFlow = condensationEfficiency * altitudeFactor * pressureFactor * humidityFactor * 5;
    this.stockCloudMass += condensationFlow;

    let dissipation = 0.2 + (atmosphericPressure > 1020 ? (atmosphericPressure - 1020) * 0.01 : 0);
    if (humidity < 40) dissipation += (40 - humidity) * 0.01;
    
    this.stockCloudMass -= dissipation;
    this.stockCloudMass = Math.max(0, Math.min(100, this.stockCloudMass));

    let cloudState: string;
    if (this.stockCloudMass < 10) cloudState = 'Despejado';
    else if (this.stockCloudMass < 40) cloudState = 'Cúmulos';
    else if (this.stockCloudMass < 80) cloudState = 'Nublado';
    else cloudState = 'Tormentoso';

    this.fogActive = deltaTdew < 2 && altitude < 400;

    this.outputs = {
      dewPoint,
      condensationRate: Math.round(Math.min(100, condensationFlow * 20)),
      cloudMass: Math.round(this.stockCloudMass),
      deltaTdew,
      tempAtAltitude,
      relativeHumidityAtAlt: relHumAtAlt,
      cloudBaseAltitude,
      cloudState,
      atmosphericStability: atmosphericPressure > 1010 ? 'Estable' : 'Inestable'
    };

    this.updateVisuals();
    this.updateAudio(altitude);
  }

  private updateVisuals() {
    const cloudCount = Math.floor(this.stockCloudMass / 6);
    this.cloudParticles = Array(Math.max(0, cloudCount)).fill(0).map(() => ({
      left: 5 + Math.random() * 85 + '%',
      top: 5 + Math.random() * 45 + '%',
      width: 150 + Math.random() * 300 + 'px',
      height: 100 + Math.random() * 150 + 'px',
      opacity: 0.2 + (this.stockCloudMass / 100) * 0.7,
      delay: Math.random() * 4 + 's'
    }));
  }

  getCondColor(): string {
    const cm = this.stockCloudMass;
    if (cm < 30) return 'rgba(255,255,255,0.4)';
    if (cm < 70) return 'rgba(200,210,230,0.6)';
    return 'rgba(100,110,130,0.8)';
  }

  getDeltaColor(): string {
    const d = this.outputs.deltaTdew;
    if (d <= 2) return '#00ff88';
    if (d <= 10) return '#ffcc00';
    return '#ff4444';
  }
}
