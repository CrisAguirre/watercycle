import { Component, OnInit, OnDestroy } from '@angular/core';

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

  Math = Math; // Expose to template

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

  // Visual state
  wettingDepthPercent = 0;
  runoffFlowWidth = 0;
  rainDrops: any[] = [];
  infiltrationArrows: any[] = [];
  waterTableLevel = 75; // % from top

  private engineLoop: any;
  private stockSaturation = 20;
  private stockCumulInfil = 0;
  private elapsedTime = 0;

  // Soil properties lookup
  private soilProps: Record<string, { Ks: number; porosity: number; f0: number; fc: number; k: number; desc: string }> = {
    arena:   { Ks: 60, porosity: 43, f0: 120, fc: 60,  k: 0.05, desc: 'Alta permeabilidad — Partículas gruesas (0.05–2mm), grandes poros interconectados' },
    limo:    { Ks: 15, porosity: 46, f0: 40,  fc: 12,  k: 0.08, desc: 'Permeabilidad media — Partículas finas (0.002–0.05mm), retiene humedad' },
    arcilla: { Ks: 2,  porosity: 50, f0: 10,  fc: 1.5, k: 0.12, desc: 'Baja permeabilidad — Partículas ultrafinas (<0.002mm), se compacta con agua' },
    franco:  { Ks: 25, porosity: 45, f0: 60,  fc: 20,  k: 0.06, desc: 'Equilibrado — Mezcla de arena, limo y arcilla, ideal para agricultura' }
  };

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 500);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
  }

  onVarChange(event: Event, key: keyof InfilVariables) {
    const el = event.target as HTMLInputElement;
    if (key === 'soilType') {
      this.vars[key] = el.value;
      this.stockSaturation = 20;
      this.stockCumulInfil = 0;
      this.elapsedTime = 0;
    } else {
      (this.vars as any)[key] = Number(el.value);
    }
  }

  onSoilChange(type: string) {
    this.vars.soilType = type;
    this.stockSaturation = 20;
    this.stockCumulInfil = 0;
    this.elapsedTime = 0;
  }

  // ═══════════════════════════════════════════════════════
  //  MOTOR FÍSICO: INFILTRACIÓN Y ESCORRENTÍA
  //  Basado en:
  //  - Modelo de Horton (tasa de infiltración decreciente)
  //  - Green-Ampt simplificado (frente de humedecimiento)
  //  - Partición hidráulica (I + R = P)
  //  - Conductividad hidráulica por tipo de suelo
  // ═══════════════════════════════════════════════════════
  private physicsTick() {
    const { soilType, rainIntensity, slopeAngle, vegetationCover } = this.vars;
    const props = this.soilProps[soilType];

    this.elapsedTime += 0.5; // minutes

    // ─────────────────────────────────────────────────
    // 1. MODELO DE HORTON
    //    f(t) = fc + (f0 - fc) × e^(-kt)
    //    f0 = capacidad de infiltración inicial
    //    fc = capacidad final (≈ conductividad hidráulica)
    //    k  = constante de decaimiento
    // ─────────────────────────────────────────────────
    const hortonRate = props.fc + (props.f0 - props.fc) * Math.exp(-props.k * this.elapsedTime);

    // ─────────────────────────────────────────────────
    // 2. EFECTO DE COBERTURA VEGETAL
    //    Raíces mejoran la estructura del suelo (macroporos)
    //    Hojarasca intercepta lluvia
    //    Intercepción: ~10-30% de la precipitación
    // ─────────────────────────────────────────────────
    const vegInterception = vegetationCover / 100 * 0.15; // Max 15% intercepted
    const effectiveRain = rainIntensity * (1 - vegInterception);
    const vegInfilBoost = 1 + (vegetationCover / 100) * 0.3;

    // ─────────────────────────────────────────────────
    // 3. EFECTO DE PENDIENTE
    //    A mayor pendiente, menor tiempo de contacto
    //    del agua con el suelo → menor infiltración
    // ─────────────────────────────────────────────────
    const slopeFactor = 1 - (slopeAngle / 90) * 0.6;

    // ─────────────────────────────────────────────────
    // 4. TASA DE INFILTRACIÓN EFECTIVA
    //    Limitada por: mínimo entre (oferta de agua, capacidad del suelo)
    // ─────────────────────────────────────────────────
    const soilCapacity = hortonRate * vegInfilBoost * slopeFactor;
    const infiltrationRate = Math.round(Math.min(effectiveRain, soilCapacity) * 10) / 10;

    // ─────────────────────────────────────────────────
    // 5. ESCORRENTÍA = Precipitación - Infiltración - Intercepción
    // ─────────────────────────────────────────────────
    const runoffRate = Math.round(Math.max(0, effectiveRain - infiltrationRate) * 10) / 10;
    const runoffCoefficient = effectiveRain > 0 ? Math.round((runoffRate / effectiveRain) * 100) / 100 : 0;

    // Slope increases runoff velocity
    const slopeRunoffBoost = 1 + (slopeAngle / 45) * 0.5;
    const adjustedRunoff = Math.round(runoffRate * slopeRunoffBoost * 10) / 10;

    // ─────────────────────────────────────────────────
    // 6. SATURACIÓN DEL SUELO (Stock acumulativo)
    // ─────────────────────────────────────────────────
    this.stockSaturation += infiltrationRate * 0.02;
    // Natural drainage
    this.stockSaturation -= props.Ks * 0.005;
    this.stockSaturation = Math.max(5, Math.min(100, this.stockSaturation));

    // ─────────────────────────────────────────────────
    // 7. FRENTE DE HUMEDECIMIENTO (Green-Ampt simplificado)
    //    Profundidad ∝ infiltración acumulada / porosidad
    // ─────────────────────────────────────────────────
    this.stockCumulInfil += infiltrationRate * (0.5 / 60); // mm per tick
    const wettingFrontDepth = Math.round(
      (this.stockCumulInfil / (props.porosity / 100)) * 0.1 * 10
    ) / 10;

    // ─────────────────────────────────────────────────
    // 8. BALANCE HÍDRICO DESCRIPTIVO
    // ─────────────────────────────────────────────────
    let waterBalance: string;
    if (rainIntensity === 0) waterBalance = 'Sin aporte hídrico';
    else if (runoffRate < 1) waterBalance = 'Infiltración total — sin escorrentía';
    else if (runoffCoefficient < 0.3) waterBalance = 'Dominancia de infiltración';
    else if (runoffCoefficient < 0.6) waterBalance = 'Equilibrado (I ≈ R)';
    else if (runoffCoefficient < 0.85) waterBalance = 'Dominancia de escorrentía';
    else waterBalance = 'Escorrentía total — suelo saturado';

    // Emit outputs
    this.outputs = {
      infiltrationRate,
      runoffRate: adjustedRunoff,
      wettingFrontDepth: Math.min(200, wettingFrontDepth),
      soilSaturation: Math.round(this.stockSaturation),
      hydraulicConductivity: props.Ks,
      soilPorosity: props.porosity,
      cumulativeInfiltration: Math.round(this.stockCumulInfil * 10) / 10,
      runoffCoefficient,
      soilDescription: props.desc,
      waterBalance
    };

    // Update visuals
    this.updateVisuals(infiltrationRate, adjustedRunoff, rainIntensity);
  }

  private updateVisuals(infiltration: number, runoff: number, rain: number) {
    // Wetting front depth (visual %)
    this.wettingDepthPercent = Math.min(90, this.outputs.wettingFrontDepth / 200 * 90);

    // Runoff flow width
    this.runoffFlowWidth = Math.min(100, runoff * 2);

    // Water table rises with saturation
    this.waterTableLevel = 85 - (this.stockSaturation / 100) * 25;

    // Rain drops
    const dropCount = Math.floor(rain / 3);
    this.rainDrops = Array(Math.max(0, Math.min(30, dropCount))).fill(0).map(() => ({
      left: 10 + Math.random() * 80 + '%',
      duration: 0.4 + Math.random() * 0.3 + 's',
      delay: Math.random() * 1 + 's'
    }));

    // Infiltration arrows
    const arrowCount = Math.floor(infiltration / 5);
    this.infiltrationArrows = Array(Math.max(0, Math.min(10, arrowCount))).fill(0).map(() => ({
      left: 15 + Math.random() * 70 + '%',
      delay: Math.random() * 2 + 's'
    }));
  }

  getSoilColor(layer: string): string {
    const sat = this.stockSaturation;
    switch (layer) {
      case 'A': return sat > 60 ? '#3a2810' : sat > 30 ? '#5a3820' : '#7a5030';
      case 'B': return sat > 70 ? '#4a3520' : sat > 40 ? '#6a4530' : '#8a6540';
      case 'C': return '#9a8060';
      default: return '#bba070';
    }
  }

  getSoilLabel(): string {
    const map: Record<string, string> = {
      arena: '🏖️ Arena', limo: '🌾 Limo', arcilla: '🧱 Arcilla', franco: '🌱 Franco'
    };
    return map[this.vars.soilType] || this.vars.soilType;
  }
}
