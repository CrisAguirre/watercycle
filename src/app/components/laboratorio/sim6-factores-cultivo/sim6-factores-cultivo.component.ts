import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

interface CropVariables {
  temperature: number;          // 5–40 °C
  waterAvailability: number;    // 0–100 %
  nutrients: number;            // 0–100 % (N-P-K composite)
  pestPressure: number;         // 0–100 %
}

interface CropOutputs {
  cropHealth: number;           // 0–100 %
  biomass: number;              // kg/m²
  evapotranspiration: number;   // mm/day
  limitingFactor: string;
  growthStage: string;
  yieldEstimate: number;        // ton/ha
  waterStress: number;          // 0–1
  thermalStress: number;        // 0–1
  nutrientEfficiency: number;   // %
  cropStatus: string;
}

@Component({
  selector: 'app-sim6-factores-cultivo',
  templateUrl: './sim6-factores-cultivo.component.html',
  styleUrls: ['./sim6-factores-cultivo.component.css']
})
export class Sim6FactoresCultivoComponent implements OnInit, OnDestroy {

  vars: CropVariables = {
    temperature: 20,
    waterAvailability: 60,
    nutrients: 50,
    pestPressure: 10
  };

  outputs: CropOutputs = {
    cropHealth: 70,
    biomass: 0,
    evapotranspiration: 0,
    limitingFactor: 'Ninguno',
    growthStage: 'Vegetativo',
    yieldEstimate: 0,
    waterStress: 0,
    thermalStress: 0,
    nutrientEfficiency: 0,
    cropStatus: 'Saludable'
  };

  plantHeight = 100;
  leafParticles: any[] = [];
  pestIcons: any[] = [];

  private audioCtx: AudioContext | null = null;
  private farmGain: GainNode | null = null;
  private cicadaGain: GainNode | null = null;
  private audioInitialized = false;

  private engineLoop: any;
  private stockBiomass = 0.5;
  private growthDay = 30;

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

      // Farm background (wind/birds noise)
      const farmSource = this.audioCtx.createBufferSource();
      farmSource.buffer = noiseBuffer;
      farmSource.loop = true;
      const farmFilter = this.audioCtx.createBiquadFilter();
      farmFilter.type = 'lowpass';
      farmFilter.frequency.value = 500;
      this.farmGain = this.audioCtx.createGain();
      this.farmGain.gain.value = 0.05;
      farmSource.connect(farmFilter);
      farmFilter.connect(this.farmGain);
      this.farmGain.connect(this.audioCtx.destination);
      farmSource.start();

      // Cicadas (High freq noise pulsing)
      const cicadaSource = this.audioCtx.createOscillator();
      cicadaSource.type = 'sine';
      cicadaSource.frequency.value = 4000;
      const cicadaMod = this.audioCtx.createOscillator();
      cicadaMod.frequency.value = 8;
      const cicadaModGain = this.audioCtx.createGain();
      cicadaModGain.gain.value = 2000;
      cicadaMod.connect(cicadaModGain);
      cicadaModGain.connect(cicadaSource.frequency);
      this.cicadaGain = this.audioCtx.createGain();
      this.cicadaGain.gain.value = 0;
      cicadaSource.connect(this.cicadaGain);
      this.cicadaGain.connect(this.audioCtx.destination);
      cicadaSource.start();
      cicadaMod.start();

      this.audioInitialized = true;
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  }

  private updateAudio(temp: number) {
    if (!this.audioInitialized || !this.audioCtx || !this.cicadaGain) return;
    const now = this.audioCtx.currentTime;
    // Cicadas get louder with heat
    const targetGain = temp > 28 ? (temp - 28) / 12 * 0.1 : 0;
    this.cicadaGain.gain.linearRampToValueAtTime(targetGain, now + 1);
  }

  private destroyAudio() {
    if (this.audioCtx) this.audioCtx.close();
  }

  onVarChange(event: Event, key: keyof CropVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  private physicsTick() {
    const { temperature, waterAvailability, nutrients, pestPressure } = this.vars;

    const thermalStress = temperature < 15 ? Math.min(1, (15 - temperature) / 10) : 
                        temperature > 30 ? Math.min(1, (temperature - 30) / 10) : 0;
    const waterStress = waterAvailability < 60 ? (60 - waterAvailability) / 60 : 0;
    const nutrientFactor = Math.pow(nutrients / 100, 0.7);
    const pestDamage = Math.pow(pestPressure / 100, 1.5);

    const et0 = Math.max(0, 0.0023 * (temperature + 17.8) * Math.sqrt(Math.max(0, temperature)) * 12);
    const kc = this.growthDay < 30 ? 0.4 : this.growthDay < 90 ? 0.8 : 1.1;
    const evapotranspiration = Math.round(et0 * kc * (1 - waterStress * 0.5) * 10) / 10;

    const K = 10; 
    const r = 0.05;
    const combinedFactor = (1 - thermalStress) * (1 - waterStress) * nutrientFactor * (1 - pestDamage);
    const growth = r * this.stockBiomass * (1 - this.stockBiomass / K) * combinedFactor;
    this.stockBiomass = Math.max(0.1, Math.min(K, this.stockBiomass + growth));
    this.growthDay = Math.min(180, this.growthDay + 0.5);

    const cropHealth = Math.round(combinedFactor * 100);

    const factors: Record<string, number> = { 'Temperatura': 1 - thermalStress, 'Agua': 1 - waterStress, 'Nutrientes': nutrientFactor, 'Plagas': 1 - pestDamage };
    const limitingFactor = Object.entries(factors).reduce((min, curr) => curr[1] < min[1] ? curr : min)[0];

    this.outputs = {
      cropHealth,
      biomass: Math.round(this.stockBiomass * 100) / 100,
      evapotranspiration,
      limitingFactor,
      growthStage: this.growthDay < 50 ? 'Vegetativo' : this.growthDay < 120 ? 'Floración' : 'Maduración',
      yieldEstimate: Math.round(this.stockBiomass * 1.5 * 10) / 10,
      waterStress: Math.round(waterStress * 100) / 100,
      thermalStress: Math.round(thermalStress * 100) / 100,
      nutrientEfficiency: Math.round(nutrientFactor * 100),
      cropStatus: cropHealth > 80 ? '🟢 Saludable' : cropHealth > 50 ? '🟡 Estable' : '🔴 Estrés'
    };

    this.updateVisuals();
    this.updateAudio(temperature);
  }

  private updateVisuals() {
    this.plantHeight = 50 + (this.stockBiomass / 10) * 200;
    
    // Regenerate procedural leaves if biomass changes significantly
    if (this.leafParticles.length < this.stockBiomass * 10) {
      this.leafParticles.push({
        x: (Math.random() - 0.5) * 120,
        y: Math.random() * this.plantHeight,
        size: 20 + Math.random() * 30,
        rot: Math.random() * 360,
        opacity: 0.8 + Math.random() * 0.2
      });
    }

    const pestCount = Math.floor(this.vars.pestPressure / 20);
    this.pestIcons = Array(Math.max(0, pestCount)).fill(0).map(() => ({
      left: 20 + Math.random() * 60 + '%',
      top: 30 + Math.random() * 50 + '%',
      delay: Math.random() * 3 + 's'
    }));
  }

  getHealthBarColor(): string {
    const h = this.outputs.cropHealth;
    return h > 75 ? '#44cc66' : h > 40 ? '#ccaa22' : '#cc4444';
  }
}
