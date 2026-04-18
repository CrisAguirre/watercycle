import { Component, OnInit, OnDestroy } from '@angular/core';
import { SimulationService, SystemVariables, CycleRates } from '../../services/simulation.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-simulation',
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.css']
})
export class SimulationComponent implements OnInit, OnDestroy {
  variables$!: Observable<SystemVariables>;
  rates$!: Observable<CycleRates>;

  evaporationParticles: any[] = [];
  rainDropParticles: any[] = [];
  runoffParticles: any[] = [];
  // Caching visual para evitar el parpadeo del Ecosistema Autónomo
  private lastPrecip = -1;
  private lastEvap = -1;
  private lastWindDir = '';

  // Lightning Flash System
  lightningFlash = false;
  private lightningInterval: any = null;
  private ratesSub!: Subscription;

  // Rain Audio System (Web Audio API Procedural)
  private audioCtx: AudioContext | null = null;
  private rainGainLight: GainNode | null = null;
  private rainGainHeavy: GainNode | null = null;
  private rainNoiseLight: AudioBufferSourceNode | null = null;
  private rainNoiseHeavy: AudioBufferSourceNode | null = null;
  private audioInitialized = false;
  private currentRainLevel: 'none' | 'light' | 'heavy' = 'none';

  // Bird Chirping System
  private birdGain: GainNode | null = null;
  private birdsActive = false;
  private birdTimers: any[] = [];

  constructor(public simService: SimulationService) { }

  ngOnInit(): void {
    this.variables$ = this.simService.variables$;
    this.rates$ = this.simService.rates$;

    this.ratesSub = this.rates$.subscribe(rates => {
      // Optimizador: Solo regenera las gotas de partículas si cambió drásticamente el nivel de agua o el viento
      if (
        Math.abs(this.lastPrecip - rates.precipitationRate) > 8 ||
        Math.abs(this.lastEvap - rates.evaporationRate) > 8 ||
        this.lastWindDir !== rates.currentWindDir
      ) {
        this.lastPrecip = rates.precipitationRate;
        this.lastEvap = rates.evaporationRate;
        this.lastWindDir = rates.currentWindDir;
        this.updateParticles(rates);
      }
      // Lightning Flash Logic
      this.updateLightning(rates.condensationRate);
      // Rain Sound Logic
      this.updateRainSound(rates.precipitationRate);
      // Bird Chirping Logic (cielo despejado)
      this.updateBirdSound(rates.precipitationRate, rates.condensationRate);
    });
  }

  updateParticles(rates: CycleRates) {
    // Evaporation: Ocurre sobre el mar (0 a 30%)
    const evapCount = Math.floor(rates.evaporationRate / 1.5);
    this.evaporationParticles = Array(evapCount).fill(0).map((_, i) => ({
      left: 2 + Math.random() * 25 + '%',
      duration: 3 + Math.random() * 4 + 's',
      delay: Math.random() * 2 + 's'
    }));

    // Rain: Distribuida en área sobre el mapa según coordenadas isométricas aéreas
    const rainCount = Math.floor(rates.precipitationRate * 1.5); 
    let baseLeft = 55, rangeLeft = 35; // Este
    if (['W', 'NW', 'SW'].includes(rates.currentWindDir)) {
      baseLeft = 10; rangeLeft = 30; // Oeste Oceánico
    } else if (['N', 'S'].includes(rates.currentWindDir)) {
      baseLeft = 40; rangeLeft = 20; // Paralelo Centro
    }

    this.rainDropParticles = Array(rainCount).fill(0).map((_, i) => ({
      left: baseLeft + Math.random() * rangeLeft + '%',
      duration: 0.5 + Math.random() * 0.4 + 's',
      delay: Math.random() * 0.5 + 's'
    }));

    // Escorrentía: Desde las montañas hacia el centro
    const runoffCount = ['E', 'NE', 'SE'].includes(rates.currentWindDir) ? Math.floor(rates.precipitationRate / 1.5) : 0;
    this.runoffParticles = Array(runoffCount).fill(0).map((_, i) => ({
      duration: 3 + Math.random() * 3 + 's',
      delay: Math.random() * 3 + 's'
    }));
  }

  onVarChange(event: Event, key: string) {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    const value = key === 'windDirection' ? el.value : Number(el.value);
    this.simService.updateVariable(key as keyof SystemVariables, value);
  }

  // HUD Text Parsers
  getEvapState(rate: number): string {
    if (rate <= 5) return 'Mínima / Estancada';
    if (rate < 40) return 'Leve (Mar estable)';
    if (rate < 75) return 'Moderada (En ascenso)';
    return 'Altamente Acelerada';
  }

  getCondState(rate: number): string {
    if (rate <= 5) return 'Despejado / Nula';
    if (rate < 40) return 'Parcial / Ligera';
    if (rate < 75) return 'Densa (Nubarrones)';
    return 'Saturación Crítica';
  }

  getPrecipState(rate: number): string {
    if (rate === 0) return 'Seco (Ausente)';
    if (rate < 30) return 'Llovizna / Rocío';
    if (rate < 60) return 'Lluvia Moderada';
    return 'Precipitación Torrencial';
  }

  // Cuarta Fase: Escorrentía (ahora calculada en el servicio con inercia)
  getRunoffState(rRate: number): string {
    if (rRate <= 0) return 'Cauces Secos';
    if (rRate < 15) return 'Infiltración Subterránea';
    if (rRate < 40) return 'Flujo de Ríos Moderado';
    if (rRate < 70) return 'Corriente Terrestre Alta';
    return 'Desbordamiento e Inundación';
  }

  // Animación del Widget Brújula
  getCompassRotation(dir: string | undefined | null): string {
    const angleMap: Record<string, string> = {
      'N': '0deg', 'NE': '45deg', 'E': '90deg', 'SE': '135deg',
      'S': '180deg', 'SW': '225deg', 'W': '270deg', 'NW': '315deg'
    };
    return angleMap[dir || 'N'] || '0deg';
  }

  // Lightning Flash Management
  private updateLightning(condensation: number) {
    if (condensation >= 80) {
      const interval = condensation >= 90 ? 7000 : 15000;
      // Only reset if interval changed or not running
      if (!this.lightningInterval || this.lightningInterval._interval !== interval) {
        this.clearLightning();
        this.triggerFlash();
        const id = setInterval(() => this.triggerFlash(), interval);
        this.lightningInterval = { id, _interval: interval };
      }
    } else {
      this.clearLightning();
    }
  }

  private triggerFlash() {
    this.lightningFlash = true;
    // 200 milisegundos de duración del rayo
    setTimeout(() => this.lightningFlash = false, 200);
  }

  private clearLightning() {
    if (this.lightningInterval) {
      clearInterval(this.lightningInterval.id);
      this.lightningInterval = null;
    }
    this.lightningFlash = false;
  }

  // ==========================================
  // RAIN AUDIO SYSTEM (Web Audio API Procedural)
  // ==========================================
  private initAudio() {
    if (this.audioInitialized) return;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create white noise buffer (2 seconds, loopable)
    const bufferSize = this.audioCtx.sampleRate * 2;
    
    // Light rain: higher frequency, softer
    const lightBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const lightData = lightBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      lightData[i] = (Math.random() * 2 - 1) * 0.3;
    }
    
    // Heavy rain: full spectrum, louder
    const heavyBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const heavyData = heavyBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      heavyData[i] = (Math.random() * 2 - 1) * 0.6;
    }

    // Light rain chain: noise → bandpass (higher) → gain
    this.rainNoiseLight = this.audioCtx.createBufferSource();
    this.rainNoiseLight.buffer = lightBuffer;
    this.rainNoiseLight.loop = true;
    const filterLight = this.audioCtx.createBiquadFilter();
    filterLight.type = 'bandpass';
    filterLight.frequency.value = 3000;  // Higher pitch = light rain drops
    filterLight.Q.value = 0.5;
    this.rainGainLight = this.audioCtx.createGain();
    this.rainGainLight.gain.value = 0;
    this.rainNoiseLight.connect(filterLight);
    filterLight.connect(this.rainGainLight);
    this.rainGainLight.connect(this.audioCtx.destination);
    this.rainNoiseLight.start();

    // Heavy rain chain: noise → lowpass (rumble) → gain
    this.rainNoiseHeavy = this.audioCtx.createBufferSource();
    this.rainNoiseHeavy.buffer = heavyBuffer;
    this.rainNoiseHeavy.loop = true;
    const filterHeavy = this.audioCtx.createBiquadFilter();
    filterHeavy.type = 'lowpass';
    filterHeavy.frequency.value = 1500;  // Lower = heavy downpour rumble
    filterHeavy.Q.value = 0.3;
    this.rainGainHeavy = this.audioCtx.createGain();
    this.rainGainHeavy.gain.value = 0;
    this.rainNoiseHeavy.connect(filterHeavy);
    filterHeavy.connect(this.rainGainHeavy);
    this.rainGainHeavy.connect(this.audioCtx.destination);
    this.rainNoiseHeavy.start();

    this.audioInitialized = true;
  }

  private updateRainSound(precipitationRate: number) {
    if (precipitationRate > 0 && !this.audioInitialized) {
      this.initAudio();
    }
    if (!this.audioCtx || !this.rainGainLight || !this.rainGainHeavy) return;

    const now = this.audioCtx.currentTime;
    const fadeTime = 0.5; // 500ms crossfade

    if (precipitationRate <= 0) {
      // Sin lluvia: silencio total
      this.rainGainLight.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.rainGainHeavy.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.currentRainLevel = 'none';
    } else if (precipitationRate <= 50) {
      // Lluvia ligera (0–50%): solo canal light, volumen proporcional
      const vol = (precipitationRate / 50) * 0.35; // Max 0.35 para lluvia suave
      this.rainGainLight.gain.linearRampToValueAtTime(vol, now + fadeTime);
      this.rainGainHeavy.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.currentRainLevel = 'light';
    } else {
      // Lluvia intensa (50–100%): ambos canales, heavy dominante
      const heavyVol = ((precipitationRate - 50) / 50) * 0.6; // Max 0.6
      this.rainGainLight.gain.linearRampToValueAtTime(0.2, now + fadeTime);
      this.rainGainHeavy.gain.linearRampToValueAtTime(heavyVol, now + fadeTime);
      this.currentRainLevel = 'heavy';
    }
  }

  private destroyAudio() {
    this.stopBirds();
    if (this.rainNoiseLight) { try { this.rainNoiseLight.stop(); } catch(e) {} }
    if (this.rainNoiseHeavy) { try { this.rainNoiseHeavy.stop(); } catch(e) {} }
    if (this.audioCtx) { this.audioCtx.close(); }
    this.audioInitialized = false;
  }

  // ==========================================
  // BIRD CHIRPING SYSTEM (Web Audio API Synth)
  // Pajaritos cantan cuando el cielo está despejado
  // (precipitación = 0on, condensación < 30%)
  // ==========================================
  private ensureAudioCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioCtx;
  }

  private updateBirdSound(precipitationRate: number, condensationRate: number) {
    const shouldSing = precipitationRate <= 0 && condensationRate < 30;

    if (shouldSing && !this.birdsActive) {
      this.startBirds();
    } else if (!shouldSing && this.birdsActive) {
      this.stopBirds();
    }
  }

  private startBirds() {
    const ctx = this.ensureAudioCtx();
    if (!this.audioInitialized) this.initAudio();
    this.birdGain = ctx.createGain();
    this.birdGain.gain.value = 0;
    this.birdGain.connect(ctx.destination);
    // Fade in suave
    this.birdGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2);
    this.birdsActive = true;

    // Programar 3 "aves" con patrones diferentes
    for (let bird = 0; bird < 3; bird++) {
      this.scheduleBirdLoop(bird);
    }
  }

  private scheduleBirdLoop(birdId: number) {
    if (!this.birdsActive) return;
    // Cada ave tiene un intervalo base diferente con variación aleatoria
    const baseIntervals = [2500, 4000, 6000];
    const interval = baseIntervals[birdId] + Math.random() * 3000;

    const timer = setTimeout(() => {
      if (!this.birdsActive || !this.audioCtx || !this.birdGain) return;
      this.playChirpSequence(birdId);
      this.scheduleBirdLoop(birdId); // Reprogramar
    }, interval);
    this.birdTimers.push(timer);
  }

  private playChirpSequence(birdId: number) {
    if (!this.audioCtx || !this.birdGain) return;
    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Cada ave tiene un rango de frecuencia diferente (especies distintas)
    const birdProfiles = [
      { freqBase: 3200, freqRange: 1200, noteCount: 3, noteLen: 0.08, gap: 0.1 },  // Gorrión: trinos rápidos agudos
      { freqBase: 2400, freqRange: 800, noteCount: 2, noteLen: 0.15, gap: 0.2 },   // Mirlo: notas largas graves
      { freqBase: 4000, freqRange: 1500, noteCount: 5, noteLen: 0.05, gap: 0.06 }, // Canario: cascada rápida
    ];
    const profile = birdProfiles[birdId % birdProfiles.length];

    for (let i = 0; i < profile.noteCount; i++) {
      const startTime = now + i * (profile.noteLen + profile.gap);
      const freq1 = profile.freqBase + Math.random() * profile.freqRange;
      const freq2 = freq1 + (Math.random() - 0.4) * 600; // Sweep ascendente o descendente

      // Oscilador principal (tono puro del trino)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq1, startTime);
      osc.frequency.linearRampToValueAtTime(freq2, startTime + profile.noteLen);

      // Envolvente de amplitud (ataque rápido, decay natural)
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.6 + Math.random() * 0.4, startTime + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, startTime + profile.noteLen);

      osc.connect(env);
      env.connect(this.birdGain);
      osc.start(startTime);
      osc.stop(startTime + profile.noteLen + 0.01);
    }
  }

  private stopBirds() {
    // Fade out suave
    if (this.birdGain && this.audioCtx) {
      this.birdGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1.5);
    }
    // Limpiar timers
    this.birdTimers.forEach(t => clearTimeout(t));
    this.birdTimers = [];
    this.birdsActive = false;
    // Desconectar gain después del fade
    setTimeout(() => {
      if (this.birdGain) {
        try { this.birdGain.disconnect(); } catch(e) {}
        this.birdGain = null;
      }
    }, 2000);
  }

  ngOnDestroy() {
    this.clearLightning();
    this.destroyAudio();
    if (this.ratesSub) this.ratesSub.unsubscribe();
  }
}

