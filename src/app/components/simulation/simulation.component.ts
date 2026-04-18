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

  // Audio System (HTML5 Audio HQ con MP3s reales)
  private rainAudioLight = new Audio('assets/rain-light.mp3');
  private rainAudioHeavy = new Audio('assets/rain-heavy.mp3');
  private birdAudioMorning = new Audio('assets/birds-morning.mp3');
  private birdAudioForest = new Audio('assets/birds-forest.mp3');
  
  private audioInitialized = false;
  private currentRainLevel: 'none' | 'light' | 'heavy' = 'none';
  private birdsActive = false;

  // Audio User Interaction Gate (browsers block autoplay)
  private userHasInteracted = false;
  private interactionListener: (() => void) | null = null;

  constructor(public simService: SimulationService) { }

  ngOnInit(): void {
    this.variables$ = this.simService.variables$;
    this.rates$ = this.simService.rates$;

    // Setup listener para desbloquear audio del navegador
    this.setupUserInteractionListener();

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
  // AUDIO SYSTEM (HTML5 Audio HQ con MP3s Reales)
  // ==========================================
  private initAudio() {
    if (this.audioInitialized) return;
    
    // Configure looping for all tracks
    this.rainAudioLight.loop = true;
    this.rainAudioHeavy.loop = true;
    this.birdAudioMorning.loop = true;
    this.birdAudioForest.loop = true;

    // Start with volume 0
    this.rainAudioLight.volume = 0;
    this.rainAudioHeavy.volume = 0;
    this.birdAudioMorning.volume = 0;
    this.birdAudioForest.volume = 0;

    this.audioInitialized = true;
  }

  // Crossfade personalizado para transiciones orgánicas 
  private fadeAudio(audio: HTMLAudioElement, targetVolume: number, durationMs = 1500) {
    if (!this.userHasInteracted || !audio) return;
    
    // Si queremos subir volumen y no está sonando, darle play
    if (audio.paused && targetVolume > 0) {
      audio.play().catch(e => console.log('Autoplay blocked:', e));
    }
    
    // Limpiar posibles fades anteriores guardados en propiedad custom
    if ((audio as any)._fadeInterval) {
      clearInterval((audio as any)._fadeInterval);
    }
    
    const steps = 30; // 30 frames para el fade
    const intervalMs = durationMs / steps;
    const startVolume = audio.volume;
    const diff = targetVolume - startVolume;
    const stepGain = diff / steps;
    
    let currentStep = 0;
    
    const fadeInterval = setInterval(() => {
      currentStep++;
      let newVol = startVolume + (stepGain * currentStep);
      newVol = Math.max(0, Math.min(1, newVol));
      audio.volume = newVol;
      
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        audio.volume = targetVolume;
        if (targetVolume === 0) {
          audio.pause();
        }
      }
    }, intervalMs);
    
    (audio as any)._fadeInterval = fadeInterval;
  }

  private updateRainSound(precipitationRate: number) {
    if (!this.userHasInteracted) return;
    if (precipitationRate > 0 && !this.audioInitialized) this.initAudio();

    if (precipitationRate <= 0) {
      // Sin lluvia: silencio total
      if (this.currentRainLevel !== 'none') {
        this.fadeAudio(this.rainAudioLight, 0, 1500);
        this.fadeAudio(this.rainAudioHeavy, 0, 1500);
        this.currentRainLevel = 'none';
      }
    } else if (precipitationRate <= 50) {
      // Lluvia ligera (0–50%)
      if (this.currentRainLevel !== 'light') {
        this.fadeAudio(this.rainAudioLight, 0.5, 1500);
        this.fadeAudio(this.rainAudioHeavy, 0, 1500);
        this.currentRainLevel = 'light';
      }
    } else {
      // Lluvia intensa (50–100%)
      if (this.currentRainLevel !== 'heavy') {
        this.fadeAudio(this.rainAudioLight, 0.3, 1000); // Lluvia ligera de fondo
        this.fadeAudio(this.rainAudioHeavy, 0.8, 1000); // Lluvia pesada principal
        this.currentRainLevel = 'heavy';
      }
    }
  }

  private updateBirdSound(precipitationRate: number, condensationRate: number) {
    if (!this.userHasInteracted) return;
    if (!this.audioInitialized) this.initAudio();
    
    const shouldSing = precipitationRate <= 0 && condensationRate < 30;

    if (shouldSing && !this.birdsActive) {
      this.birdsActive = true;
      // Ambos audios de pajaritos cantan juntos, a diferente volumen para dar cuerpo
      this.fadeAudio(this.birdAudioMorning, 0.6, 2500); // Ambientación inmersiva 
      this.fadeAudio(this.birdAudioForest, 0.3, 3500);  // Un ave ocasional en primer plano
    } else if (!shouldSing && this.birdsActive) {
      this.birdsActive = false;
      this.fadeAudio(this.birdAudioMorning, 0, 2000);
      this.fadeAudio(this.birdAudioForest, 0, 2000);
    }
  }

  private destroyAudio() {
    this.fadeAudio(this.rainAudioLight, 0, 200);
    this.fadeAudio(this.rainAudioHeavy, 0, 200);
    this.fadeAudio(this.birdAudioMorning, 0, 200);
    this.fadeAudio(this.birdAudioForest, 0, 200);
    this.audioInitialized = false;
  }

  ngOnDestroy() {
    this.clearLightning();
    this.destroyAudio();
    if (this.ratesSub) this.ratesSub.unsubscribe();
    // Limpiar listener de interacción
    if (this.interactionListener) {
      document.removeEventListener('click', this.interactionListener);
      document.removeEventListener('touchstart', this.interactionListener);
      document.removeEventListener('keydown', this.interactionListener);
    }
  }

  // ==========================================
  // USER INTERACTION GATE
  // Navegadores modernos bloquean AudioContext
  // hasta que el usuario interactúe con la página
  // ==========================================
  private setupUserInteractionListener() {
    this.interactionListener = () => {
      this.userHasInteracted = true;
      // Resumir AudioContext si ya existe (removido, ya no usamos AudioContext)
      // Remover listeners tras primera interacción
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
