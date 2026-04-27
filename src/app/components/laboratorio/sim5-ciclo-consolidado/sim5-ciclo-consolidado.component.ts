import { Component, OnInit, OnDestroy } from '@angular/core';
import { SimulationService, SystemVariables, CycleRates } from '../../../services/simulation.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-sim5-ciclo-consolidado',
  templateUrl: './sim5-ciclo-consolidado.component.html',
  styleUrls: ['./sim5-ciclo-consolidado.component.css']
})
export class Sim5CicloConsolidadoComponent implements OnInit, OnDestroy {
  variables$!: Observable<SystemVariables>;
  rates$!: Observable<CycleRates>;

  evaporationParticles: any[] = [];
  rainDropParticles: any[] = [];
  runoffParticles: any[] = [];
  private lastPrecip = -1;
  private lastEvap = -1;
  private lastWindDir = '';

  lightningFlash = false;
  private lightningInterval: any = null;
  private ratesSub!: Subscription;

  private audioCtx: AudioContext | null = null;
  private rainGainLight: GainNode | null = null;
  private rainGainHeavy: GainNode | null = null;
  private rainNoiseLight: AudioBufferSourceNode | null = null;
  private rainNoiseHeavy: AudioBufferSourceNode | null = null;
  private audioInitialized = false;
  private currentRainLevel: 'none' | 'light' | 'heavy' = 'none';

  private birdAudio = new Audio('assets/birds.mp3');
  private birdsActive = false;

  private userHasInteracted = false;
  private interactionListener: (() => void) | null = null;

  constructor(public simService: SimulationService) { }

  ngOnInit(): void {
    this.variables$ = this.simService.variables$;
    this.rates$ = this.simService.rates$;
    this.setupUserInteractionListener();

    this.ratesSub = this.rates$.subscribe(rates => {
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
      this.updateLightning(rates.condensationRate);
      this.updateRainSound(rates.precipitationRate);
      this.updateBirdSound(rates.precipitationRate, rates.condensationRate);
    });
  }

  updateParticles(rates: CycleRates) {
    const evapCount = Math.floor(rates.evaporationRate / 1.5);
    this.evaporationParticles = Array(evapCount).fill(0).map((_, i) => ({
      left: 2 + Math.random() * 25 + '%',
      duration: 3 + Math.random() * 4 + 's',
      delay: Math.random() * 2 + 's'
    }));

    const rainCount = Math.floor(rates.precipitationRate * 1.5);
    let baseLeft = 55, rangeLeft = 35;
    if (['W', 'NW', 'SW'].includes(rates.currentWindDir)) {
      baseLeft = 10; rangeLeft = 30;
    } else if (['N', 'S'].includes(rates.currentWindDir)) {
      baseLeft = 40; rangeLeft = 20;
    }

    this.rainDropParticles = Array(rainCount).fill(0).map((_, i) => ({
      left: baseLeft + Math.random() * rangeLeft + '%',
      duration: 0.5 + Math.random() * 0.4 + 's',
      delay: Math.random() * 0.5 + 's'
    }));

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

  getRunoffState(rRate: number): string {
    if (rRate <= 0) return 'Cauces Secos';
    if (rRate < 15) return 'Infiltración Subterránea';
    if (rRate < 40) return 'Flujo de Ríos Moderado';
    if (rRate < 70) return 'Corriente Terrestre Alta';
    return 'Desbordamiento e Inundación';
  }

  getCompassRotation(dir: string | undefined | null): string {
    const angleMap: Record<string, string> = {
      'N': '0deg', 'NE': '45deg', 'E': '90deg', 'SE': '135deg',
      'S': '180deg', 'SW': '225deg', 'W': '270deg', 'NW': '315deg'
    };
    return angleMap[dir || 'N'] || '0deg';
  }

  private updateLightning(condensation: number) {
    if (condensation >= 80) {
      const interval = condensation >= 90 ? 7000 : 15000;
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
    setTimeout(() => this.lightningFlash = false, 200);
  }

  private clearLightning() {
    if (this.lightningInterval) {
      clearInterval(this.lightningInterval.id);
      this.lightningInterval = null;
    }
    this.lightningFlash = false;
  }

  private initAudio() {
    if (this.audioInitialized) return;
    const ctx = this.ensureAudioCtx();
    const bufferSize = ctx.sampleRate * 2;

    const lightBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const lightData = lightBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      lightData[i] = (Math.random() * 2 - 1) * 0.3;
    }

    const heavyBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const heavyData = heavyBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      heavyData[i] = (Math.random() * 2 - 1) * 0.6;
    }

    this.rainNoiseLight = ctx.createBufferSource();
    this.rainNoiseLight.buffer = lightBuffer;
    this.rainNoiseLight.loop = true;
    const filterLight = ctx.createBiquadFilter();
    filterLight.type = 'bandpass';
    filterLight.frequency.value = 3000;
    filterLight.Q.value = 0.5;
    this.rainGainLight = ctx.createGain();
    this.rainGainLight.gain.value = 0;
    this.rainNoiseLight.connect(filterLight);
    filterLight.connect(this.rainGainLight);
    this.rainGainLight.connect(ctx.destination);
    this.rainNoiseLight.start();

    this.rainNoiseHeavy = ctx.createBufferSource();
    this.rainNoiseHeavy.buffer = heavyBuffer;
    this.rainNoiseHeavy.loop = true;
    const filterHeavy = ctx.createBiquadFilter();
    filterHeavy.type = 'lowpass';
    filterHeavy.frequency.value = 1500;
    filterHeavy.Q.value = 0.3;
    this.rainGainHeavy = ctx.createGain();
    this.rainGainHeavy.gain.value = 0;
    this.rainNoiseHeavy.connect(filterHeavy);
    filterHeavy.connect(this.rainGainHeavy);
    this.rainGainHeavy.connect(ctx.destination);
    this.rainNoiseHeavy.start();

    this.audioInitialized = true;
  }

  private updateRainSound(precipitationRate: number) {
    if (precipitationRate > 0 && !this.audioInitialized) {
      this.initAudio();
    }
    if (!this.audioCtx || !this.rainGainLight || !this.rainGainHeavy) return;

    const now = this.audioCtx.currentTime;
    const fadeTime = 0.5;

    if (precipitationRate <= 0) {
      this.rainGainLight.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.rainGainHeavy.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.currentRainLevel = 'none';
    } else if (precipitationRate <= 50) {
      const vol = (precipitationRate / 50) * 0.35;
      this.rainGainLight.gain.linearRampToValueAtTime(vol, now + fadeTime);
      this.rainGainHeavy.gain.linearRampToValueAtTime(0, now + fadeTime);
      this.currentRainLevel = 'light';
    } else {
      const heavyVol = ((precipitationRate - 50) / 50) * 0.6;
      this.rainGainLight.gain.linearRampToValueAtTime(0.2, now + fadeTime);
      this.rainGainHeavy.gain.linearRampToValueAtTime(heavyVol, now + fadeTime);
      this.currentRainLevel = 'heavy';
    }
  }

  private destroyAudio() {
    this.stopBirds();
    if (this.rainNoiseLight) { try { this.rainNoiseLight.stop(); } catch (e) { } }
    if (this.rainNoiseHeavy) { try { this.rainNoiseHeavy.stop(); } catch (e) { } }
    if (this.audioCtx) { this.audioCtx.close(); }
    this.audioInitialized = false;
  }

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
    if (!this.userHasInteracted) return;
    this.birdAudio.loop = true;
    this.birdAudio.volume = 0.15;
    this.birdAudio.play().catch(e => console.log('Audio play failed:', e));
    this.birdsActive = true;
  }

  private stopBirds() {
    this.birdAudio.pause();
    this.birdsActive = false;
  }

  ngOnDestroy() {
    this.clearLightning();
    this.destroyAudio();
    if (this.ratesSub) this.ratesSub.unsubscribe();
    if (this.interactionListener) {
      document.removeEventListener('click', this.interactionListener);
      document.removeEventListener('touchstart', this.interactionListener);
      document.removeEventListener('keydown', this.interactionListener);
    }
  }

  private setupUserInteractionListener() {
    this.interactionListener = () => {
      this.userHasInteracted = true;
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      if (this.interactionListener) {
        document.removeEventListener('click', this.interactionListener);
        document.removeEventListener('touchstart', this.interactionListener);
        document.removeEventListener('keydown', this.interactionListener);
      }
    };
    document.addEventListener('click', this.interactionListener);
    document.addEventListener('touchstart', this.interactionListener);
    document.addEventListener('keydown', this.interactionListener);
  }
}
