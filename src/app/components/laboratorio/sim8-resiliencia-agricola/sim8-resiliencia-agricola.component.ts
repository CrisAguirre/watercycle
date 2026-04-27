import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';

interface ResilienceVariables {
  crisisType: string;           // 'sequia' | 'plaga' | 'inundacion' | 'helada'
  crisisSeverity: number;       // 1–10
  intervention: string;         // 'ninguna' | 'riego' | 'biocontrol' | 'drenaje' | 'proteccion'
  interventionIntensity: number;// 0–100 %
}

interface ResilienceOutputs {
  systemHealth: number;         // 0–100
  accumulatedDamage: number;    // 0–100
  interventionEfficacy: number; // 0–100 %
  systemStatus: string;
  recoveryRate: number;         // %/tick
  daysInCrisis: number;
  crisisDescription: string;
  interventionDescription: string;
  tippingPointReached: boolean;
  resilience: string;
}

@Component({
  selector: 'app-sim8-resiliencia-agricola',
  templateUrl: './sim8-resiliencia-agricola.component.html',
  styleUrls: ['./sim8-resiliencia-agricola.component.css']
})
export class Sim8ResilienciaAgricolaComponent implements OnInit, OnDestroy {

  Math = Math; 

  vars: ResilienceVariables = {
    crisisType: 'sequia',
    crisisSeverity: 5,
    intervention: 'ninguna',
    interventionIntensity: 50
  };

  outputs: ResilienceOutputs = {
    systemHealth: 80,
    accumulatedDamage: 0,
    interventionEfficacy: 0,
    systemStatus: '🟢 Estable',
    recoveryRate: 0,
    daysInCrisis: 0,
    crisisDescription: '',
    interventionDescription: '',
    tippingPointReached: false,
    resilience: 'Alta'
  };

  crisisTypes = ['sequia', 'plaga', 'inundacion', 'helada'];
  interventionTypes = ['ninguna', 'riego', 'biocontrol', 'drenaje', 'proteccion'];

  private audioCtx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private crisisGain: GainNode | null = null;
  private audioInitialized = false;

  private engineLoop: any;
  private stockHealth = 80;
  private stockDamage = 0;
  private dayCount = 0;

  @HostListener('window:mousedown')
  @HostListener('window:keydown')
  unlockAudio() {
    if (this.audioInitialized) return;
    this.initAudio();
  }

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 600);
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

      // Ambient birds/wind
      const ambientSource = this.audioCtx.createBufferSource();
      ambientSource.buffer = noiseBuffer;
      ambientSource.loop = true;
      const ambientFilter = this.audioCtx.createBiquadFilter();
      ambientFilter.type = 'lowpass';
      ambientFilter.frequency.value = 800;
      this.ambientGain = this.audioCtx.createGain();
      this.ambientGain.gain.value = 0.1;
      ambientSource.connect(ambientFilter);
      ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.audioCtx.destination);
      ambientSource.start();

      // Crisis noise (distorted/harsh)
      const crisisSource = this.audioCtx.createBufferSource();
      crisisSource.buffer = noiseBuffer;
      crisisSource.loop = true;
      const crisisFilter = this.audioCtx.createBiquadFilter();
      crisisFilter.type = 'bandpass';
      crisisFilter.frequency.value = 2000;
      this.crisisGain = this.audioCtx.createGain();
      this.crisisGain.gain.value = 0;
      crisisSource.connect(crisisFilter);
      crisisFilter.connect(this.crisisGain);
      this.crisisGain.connect(this.audioCtx.destination);
      crisisSource.start();

      this.audioInitialized = true;
    } catch (e) {
      console.error('Audio initialization failed', e);
    }
  }

  private updateAudio(health: number, severity: number) {
    if (!this.audioInitialized || !this.audioCtx || !this.ambientGain || !this.crisisGain) return;
    const now = this.audioCtx.currentTime;
    // Ambient birds fade as health drops
    this.ambientGain.gain.linearRampToValueAtTime((health / 100) * 0.15, now + 1);
    // Crisis noise rises with severity and damage
    this.crisisGain.gain.linearRampToValueAtTime((severity / 10) * (1 - health / 100) * 0.2, now + 1);
  }

  private destroyAudio() {
    if (this.audioCtx) this.audioCtx.close();
  }

  onVarChange(event: Event, key: keyof ResilienceVariables) {
    const el = event.target as HTMLInputElement;
    (this.vars as any)[key] = Number(el.value);
  }

  onCrisisChange(type: string) {
    this.vars.crisisType = type;
    this.resetSimulation();
  }

  onInterventionChange(type: string) { this.vars.intervention = type; }

  resetSimulation() {
    this.stockHealth = 80;
    this.stockDamage = 0;
    this.dayCount = 0;
  }

  private physicsTick() {
    const { crisisType, crisisSeverity, intervention, interventionIntensity } = this.vars;
    this.dayCount++;

    const baseDamageMap: Record<string, number> = { sequia: 1.2, plaga: 1.5, inundacion: 2.0, helada: 2.5 };
    const matchMap: Record<string, string> = { sequia: 'riego', plaga: 'biocontrol', inundacion: 'drenaje', helada: 'proteccion' };

    const rawDamage = baseDamageMap[crisisType] * (crisisSeverity / 10) * (1 + this.dayCount * 0.05);
    const efficacy = matchMap[crisisType] === intervention ? (interventionIntensity / 100) : 0;
    
    const netDamage = Math.max(0, rawDamage * (1 - efficacy));
    const recovery = this.stockHealth > 20 ? 0.5 : 0;

    this.stockHealth = Math.max(0, Math.min(100, this.stockHealth - netDamage + recovery));
    this.stockDamage = Math.min(100, this.stockDamage + netDamage * 0.5);

    const tippingPoint = this.stockHealth < 15;

    this.outputs = {
      systemHealth: Math.round(this.stockHealth),
      accumulatedDamage: Math.round(this.stockDamage),
      interventionEfficacy: Math.round(efficacy * 100),
      systemStatus: this.stockHealth > 70 ? '🟢 Estable' : this.stockHealth > 30 ? '🟡 Riesgo' : '🔴 Crítico',
      recoveryRate: recovery,
      daysInCrisis: this.dayCount,
      crisisDescription: `Impacto de ${crisisType} nivel ${crisisSeverity}`,
      interventionDescription: `Intervención via ${intervention}`,
      tippingPointReached: tippingPoint,
      resilience: this.stockHealth > 50 ? 'Alta' : 'Baja'
    };

    this.updateAudio(this.stockHealth, crisisSeverity);
  }

  getHealthColor(): string {
    const h = this.outputs.systemHealth;
    return h > 70 ? '#44cc66' : h > 30 ? '#ccaa22' : '#cc4444';
  }

  getCrisisLabel(type: string): string {
    const map: Record<string, string> = { sequia: '☀️ Sequía', plaga: '🐛 Plaga', inundacion: '🌊 Inundación', helada: '❄️ Helada' };
    return map[type] || type;
  }

  getInterventionLabel(type: string): string {
    const map: Record<string, string> = { ninguna: '❌ Ninguna', riego: '💧 Riego', biocontrol: '🐞 Biocontrol', drenaje: '🏗️ Drenaje', proteccion: '🛡️ Protección' };
    return map[type] || type;
  }
}
