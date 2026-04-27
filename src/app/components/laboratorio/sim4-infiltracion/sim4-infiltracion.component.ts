import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { AnalisisService } from '../../../services/analisis.service';
import { ProgressService } from '../../../services/progress.service';

interface InfilVariables {
  soilType: string;             // 'arena' | 'limo' | 'arcilla' | 'franco'
  rainIntensity: number;        // 0–80 mm/h
  slopeAngle: number;           // 0–45 degrees
  vegetationCover: number;      // 0–100 %
}

interface InfilOutputs {
  infiltrationRate: number;     // mm/h
  runoffRate: number;           // mm/h
  wettingFrontDepth: number;    // cm
  soilSaturation: number;       // %
  hydraulicConductivity: number;// mm/h
  soilPorosity: number;         // %
  cumulativeInfiltration: number; // mm
  runoffCoefficient: number;    // 0-1
  soilDescription: string;
  waterBalance: string;
}

@Component({
  selector: 'app-sim4-infiltracion',
  templateUrl: './sim4-infiltracion.component.html',
  styleUrls: ['./sim4-infiltracion.component.css']
})
export class Sim4InfiltracionComponent implements OnInit, OnDestroy {

  Math = Math; 

  vars: InfilVariables = {
    soilType: 'franco',
    rainIntensity: 30,
    slopeAngle: 10,
    vegetationCover: 50
  };

  outputs: InfilOutputs = {
    infiltrationRate: 0,
    runoffRate: 0,
    wettingFrontDepth: 0,
    soilSaturation: 0,
    hydraulicConductivity: 0,
    soilPorosity: 0,
    cumulativeInfiltration: 0,
    runoffCoefficient: 0,
    soilDescription: '',
    waterBalance: 'Equilibrado'
  };

  soilTypes = ['arena', 'limo', 'arcilla', 'franco'];
  seepageParticles: any[] = [];
  waterTableLevel = 75; 

  private audioCtx: AudioContext | null = null;
  private seepGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private audioInitialized = false;

  private engineLoop: any;
  private stockSaturation = 20;
  private stockCumulInfil = 0;
  private elapsedTime = 0;

  private soilProps: Record<string, { Ks: number; porosity: number; f0: number; fc: number; k: number; desc: string }> = {
    arena:   { Ks: 60, porosity: 43, f0: 120, fc: 60,  k: 0.05, desc: 'Alta permeabilidad — Partículas gruesas, grandes poros' },
    limo:    { Ks: 15, porosity: 46, f0: 40,  fc: 12,  k: 0.08, desc: 'Permeabilidad media — Partículas finas, retiene humedad' },
    arcilla: { Ks: 2,  porosity: 50, f0: 10,  fc: 1.5, k: 0.12, desc: 'Baja permeabilidad — Partículas ultrafinas, se compacta' },
    franco:  { Ks: 25, porosity: 45, f0: 60,  fc: 20,  k: 0.06, desc: 'Equilibrado — Mezcla ideal para agricultura' }
  };

  constructor(
    private analisisService: AnalisisService,
    private progressService: ProgressService
  ) {}

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
      
      const bufferSize = 2 * this.audioCtx.sampleRate;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      // Seeping noise (filtered low)
      const seepSource = this.audioCtx.createBufferSource();
      seepSource.buffer = noiseBuffer;
      seepSource.loop = true;
      const seepFilter = this.audioCtx.createBiquadFilter();
      seepFilter.type = 'lowpass';
      seepFilter.frequency.value = 200;
      this.seepGain = this.audioCtx.createGain();
      this.seepGain.gain.value = 0;
      seepSource.connect(seepFilter);
      seepFilter.connect(this.seepGain);
      this.seepGain.connect(this.audioCtx.destination);
      seepSource.start();

      // Rain noise (filtered high)
      const rainSource = this.audioCtx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;
      const rainFilter = this.audioCtx.createBiquadFilter();
      rainFilter.type = 'lowpass';
      rainFilter.frequency.value = 1200;
      this.rainGain = this.audioCtx.createGain();
      this.rainGain.gain.value = 0;
      rainSource.connect(rainFilter);
      rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.audioCtx.destination);
      rainSource.start();

      this.audioInitialized = true;
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  }

  private updateAudio(seeping: number, rain: number) {
    if (!this.audioInitialized || !this.audioCtx || !this.seepGain || !this.rainGain) return;
    const now = this.audioCtx.currentTime;
    this.seepGain.gain.linearRampToValueAtTime((seeping / 60) * 0.15, now + 1);
    this.rainGain.gain.linearRampToValueAtTime((rain / 80) * 0.1, now + 1);
  }

  private destroyAudio() {
    if (this.audioCtx) this.audioCtx.close();
  }

  saveAnalisis() {
    const data = {
      tipoAnalisis: 'Infiltración y Escorrentía',
      descripcion: `Análisis de suelo tipo ${this.vars.soilType} con lluvia de ${this.vars.rainIntensity}mm/h.`,
      metricas: { ...this.vars, ...this.outputs }
    };

    this.analisisService.submitAnalisis(data).subscribe({
      next: () => {
        alert('Análisis guardado con éxito');
        this.progressService.updateProgress({ completedSimulation: 4 }).subscribe();
      },
      error: (err: any) => alert('Error al guardar el análisis: ' + err.error?.message)
    });
  }

  onSoilChange(type: string) {
    this.vars.soilType = type;
    this.stockSaturation = 20;
    this.stockCumulInfil = 0;
    this.elapsedTime = 0;
  }

  onVarChange(event: Event, key: keyof InfilVariables) {
    const el = event.target as HTMLInputElement;
    (this.vars as any)[key] = Number(el.value);
  }

  private physicsTick() {
    const { soilType, rainIntensity, slopeAngle, vegetationCover } = this.vars;
    const props = this.soilProps[soilType];

    this.elapsedTime += 0.5;

    const hortonRate = props.fc + (props.f0 - props.fc) * Math.exp(-props.k * this.elapsedTime);
    const effectiveRain = rainIntensity * (1 - (vegetationCover / 100 * 0.15));
    const vegInfilBoost = 1 + (vegetationCover / 100) * 0.3;
    const slopeFactor = 1 - (slopeAngle / 90) * 0.6;

    const infiltrationRate = Math.round(Math.min(effectiveRain, hortonRate * vegInfilBoost * slopeFactor) * 10) / 10;
    const runoffRate = Math.round(Math.max(0, effectiveRain - infiltrationRate) * 10) / 10;
    
    this.stockSaturation += infiltrationRate * 0.02;
    this.stockSaturation -= props.Ks * 0.005;
    this.stockSaturation = Math.max(5, Math.min(100, this.stockSaturation));

    this.stockCumulInfil += infiltrationRate * (0.5 / 60);

    this.outputs = {
      infiltrationRate,
      runoffRate: Math.round(runoffRate * (1 + slopeAngle / 45) * 10) / 10,
      wettingFrontDepth: Math.min(200, Math.round((this.stockCumulInfil / (props.porosity / 100)) * 10)),
      soilSaturation: Math.round(this.stockSaturation),
      hydraulicConductivity: props.Ks,
      soilPorosity: props.porosity,
      cumulativeInfiltration: Math.round(this.stockCumulInfil * 10) / 10,
      runoffCoefficient: effectiveRain > 0 ? Math.round((runoffRate / effectiveRain) * 100) / 100 : 0,
      soilDescription: props.desc,
      waterBalance: rainIntensity === 0 ? 'Sin aporte' : (runoffRate < 1 ? 'Infiltración total' : 'Flujo mixto')
    };

    this.updateVisuals(infiltrationRate, rainIntensity);
    this.updateAudio(infiltrationRate, rainIntensity);
  }

  private updateVisuals(infiltration: number, rain: number) {
    this.waterTableLevel = 85 - (this.stockSaturation / 100) * 40;

    const particleCount = Math.floor(infiltration / 4);
    this.seepageParticles = Array(Math.max(0, particleCount)).fill(0).map(() => ({
      left: Math.random() * 100 + '%',
      duration: 2 + Math.random() * 3 + 's',
      delay: Math.random() * 2 + 's'
    }));
  }

  getSoilLabel(): string {
    const map: Record<string, string> = { arena: '🏖️ Arena', limo: '🌾 Limo', arcilla: '🧱 Arcilla', franco: '🌱 Franco' };
    return map[this.vars.soilType] || this.vars.soilType;
  }
}
