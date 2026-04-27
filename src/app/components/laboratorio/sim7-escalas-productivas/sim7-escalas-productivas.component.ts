import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

interface ScaleVariables {
  cropType: string;             // 'papa' | 'cafe' | 'maiz'
  productionScale: number;      // 1–10000 m²
  irrigationMethod: string;     // 'goteo' | 'aspersion' | 'gravedad'
  fertilization: number;        // 0–200 kg/ha
}

interface ScaleOutputs {
  yieldEstimate: number;        // ton/ha
  waterRequired: number;        // m³
  productionCost: number;       // $COP
  waterEfficiency: number;      // kg/m³
  irrigationEfficiency: number; // %
  fertilizerCost: number;       // $COP
  waterCost: number;            // $COP
  revenueEstimate: number;      // $COP
  profitMargin: number;         // %
  scaleLabel: string;
  cropEmoji: string;
  waterPerPlant: number;        // L/plant
}

@Component({
  selector: 'app-sim7-escalas-productivas',
  templateUrl: './sim7-escalas-productivas.component.html',
  styleUrls: ['./sim7-escalas-productivas.component.css']
})
export class Sim7EscalasProductivasComponent implements OnInit, OnDestroy {

  vars: ScaleVariables = {
    cropType: 'papa',
    productionScale: 500,
    irrigationMethod: 'aspersion',
    fertilization: 80
  };

  outputs: ScaleOutputs = {
    yieldEstimate: 0,
    waterRequired: 0,
    productionCost: 0,
    waterEfficiency: 0,
    irrigationEfficiency: 75,
    fertilizerCost: 0,
    waterCost: 0,
    revenueEstimate: 0,
    profitMargin: 0,
    scaleLabel: 'Parcela',
    cropEmoji: '🥔',
    waterPerPlant: 0
  };

  cropTypes = ['papa', 'cafe', 'maiz'];
  irrigationMethods = ['goteo', 'aspersion', 'gravedad'];

  private audioCtx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private tractorGain: GainNode | null = null;
  private audioInitialized = false;

  private engineLoop: any;

  private cropProps: Record<string, {
    yieldMax: number; waterNeed: number; pricePerTon: number; emoji: string;
  }> = {
    papa:  { yieldMax: 30, waterNeed: 500, pricePerTon: 800000, emoji: '🥔' },
    cafe:  { yieldMax: 2.5, waterNeed: 1200, pricePerTon: 8000000, emoji: '☕' },
    maiz:  { yieldMax: 8, waterNeed: 600, pricePerTon: 950000, emoji: '🌽' }
  };

  private irrigEfficiency: Record<string, number> = { goteo: 90, aspersion: 75, gravedad: 50 };

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

      // High altitude wind
      const windSource = this.audioCtx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;
      const windFilter = this.audioCtx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 400;
      this.windGain = this.audioCtx.createGain();
      this.windGain.gain.value = 0.1;
      windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.audioCtx.destination);
      windSource.start();

      // Tractor hum (low freq sawtooth)
      const tractorSource = this.audioCtx.createOscillator();
      tractorSource.type = 'sawtooth';
      tractorSource.frequency.value = 50;
      const tractorFilter = this.audioCtx.createBiquadFilter();
      tractorFilter.type = 'lowpass';
      tractorFilter.frequency.value = 150;
      this.tractorGain = this.audioCtx.createGain();
      this.tractorGain.gain.value = 0;
      tractorSource.connect(tractorFilter);
      tractorFilter.connect(this.tractorGain);
      this.tractorGain.connect(this.audioCtx.destination);
      tractorSource.start();

      this.audioInitialized = true;
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  }

  private updateAudio(scale: number) {
    if (!this.audioInitialized || !this.audioCtx || !this.tractorGain) return;
    const now = this.audioCtx.currentTime;
    // Tractor hum increases with scale
    const targetGain = scale > 2000 ? (scale / 10000) * 0.05 : 0;
    this.tractorGain.gain.linearRampToValueAtTime(targetGain, now + 1);
  }

  private destroyAudio() {
    if (this.audioCtx) this.audioCtx.close();
  }

  onVarChange(event: Event, key: keyof ScaleVariables) {
    const el = event.target as HTMLInputElement;
    (this.vars as any)[key] = Number(el.value);
  }

  onCropChange(type: string) { this.vars.cropType = type; }
  onIrrigChange(method: string) { this.vars.irrigationMethod = method; }

  private physicsTick() {
    const { cropType, productionScale, irrigationMethod, fertilization } = this.vars;
    const crop = this.cropProps[cropType];
    const irrigEff = this.irrigEfficiency[irrigationMethod] / 100;
    const areaHa = productionScale / 10000;

    const fertFactor = 1 - Math.exp(-0.8 * fertilization / 120);
    const yieldPerHa = Math.round(crop.yieldMax * fertFactor * irrigEff * 100) / 100;
    const yieldTotal = yieldPerHa * areaHa;

    const waterRequired = Math.round((crop.waterNeed * areaHa) / irrigEff);
    const waterCost = waterRequired * 2500;
    const fertCost = Math.round(fertilization * areaHa * 3000);
    const totalCost = waterCost + fertCost + (productionScale * 5) + (areaHa * 2000000);
    const revenue = Math.round(yieldTotal * crop.pricePerTon);
    const profitMargin = revenue > 0 ? Math.round(((revenue - totalCost) / revenue) * 100) : 0;

    this.outputs = {
      yieldEstimate: yieldPerHa,
      waterRequired,
      productionCost: totalCost,
      waterEfficiency: waterRequired > 0 ? Math.round((yieldTotal * 1000 / waterRequired) * 100) / 100 : 0,
      irrigationEfficiency: this.irrigEfficiency[irrigationMethod],
      fertilizerCost: fertCost,
      waterCost,
      revenueEstimate: revenue,
      profitMargin,
      scaleLabel: productionScale <= 100 ? 'Huerta' : productionScale <= 2000 ? 'Parcela' : 'Hacienda',
      cropEmoji: crop.emoji,
      waterPerPlant: 0
    };

    this.updateAudio(productionScale);
  }

  formatCOP(value: number): string {
    return '$' + value.toLocaleString('es-CO');
  }

  getProfitColor(): string {
    const p = this.outputs.profitMargin;
    return p >= 30 ? '#44cc66' : p >= 0 ? '#ccaa22' : '#cc4444';
  }

  getCropLabel(type: string): string {
    const map: Record<string, string> = { papa: '🥔 Papa', cafe: '☕ Café', maiz: '🌽 Maíz' };
    return map[type] || type;
  }

  getIrrigLabel(method: string): string {
    const map: Record<string, string> = { goteo: '💧 Goteo', aspersion: '🌊 Aspersión', gravedad: '🏞️ Gravedad' };
    return map[method] || method;
  }
}
