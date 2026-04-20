import { Component, OnInit, OnDestroy } from '@angular/core';

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

  private engineLoop: any;

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 500);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
  }

  onVarChange(event: Event, key: keyof EvapVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  // ═══════════════════════════════════════════════════════
  //  MOTOR FÍSICO: EVAPORACIÓN
  //  Basado en:
  //  - Ecuación de Antoine (presión de vapor de saturación)
  //  - Clausius-Clapeyron (dependencia exponencial T)
  //  - Modelo Penman simplificado (función del viento)
  //  - Déficit de presión de vapor (VPD)
  // ═══════════════════════════════════════════════════════
  private physicsTick() {
    const { waterTemperature, solarRadiation, windSpeed, humidity } = this.vars;

    // ─────────────────────────────────────────────────
    // 1. TEMPERATURA SUPERFICIAL DEL AGUA
    //    La capa superficial se calienta más que el volumen
    //    por radiación solar directa. El viento mezcla y reduce.
    // ─────────────────────────────────────────────────
    const solarHeating = solarRadiation * 0.12;
    const windMixing = 1 - (windSpeed / 200);
    const waterSurfaceTemp = Math.round(
      (waterTemperature + solarHeating * Math.max(0.3, windMixing)) * 10
    ) / 10;

    // ─────────────────────────────────────────────────
    // 2. PRESIÓN DE VAPOR DE SATURACIÓN (Antoine / Magnus)
    //    Ps = 0.6108 × exp((17.27 × T) / (T + 237.3))  [kPa]
    // ─────────────────────────────────────────────────
    const satVP = 0.6108 * Math.exp((17.27 * waterSurfaceTemp) / (waterSurfaceTemp + 237.3));

    // ─────────────────────────────────────────────────
    // 3. PRESIÓN DE VAPOR ACTUAL Y DÉFICIT (VPD)
    //    Pa = (HR / 100) × Ps
    //    VPD = Ps - Pa  →  Fuerza motriz de la evaporación
    // ─────────────────────────────────────────────────
    const actualVP = (humidity / 100) * satVP;
    const vpd = Math.max(0, satVP - actualVP);

    // ─────────────────────────────────────────────────
    // 4. TASA DE EVAPORACIÓN (Penman Simplificado)
    //    E = f(v) × VPD × Rad × Clausius
    // ─────────────────────────────────────────────────

    // Función del viento (Dalton): transporte advectivo
    const windFunction = 0.5 + 0.54 * Math.sqrt(windSpeed / 100);

    // Factor de radiación: energía disponible
    const radiationFactor = 0.3 + 0.7 * (solarRadiation / 100);

    // Factor Clausius-Clapeyron: exponencial con T
    const tempBoost = Math.max(0, Math.exp(0.05 * (waterTemperature - 20)) - 0.3);

    // Bloqueo por humedad: parabólico cerca de saturación
    const humidityBlock = Math.pow(Math.max(0, 1 - humidity / 100), 1.3);

    let evapRate = (vpd * windFunction * radiationFactor * tempBoost * 120) * humidityBlock;

    // Congelación: sublimación residual
    if (waterTemperature <= 0) {
      evapRate *= 0.05;
    } else if (waterTemperature < 5) {
      evapRate *= (waterTemperature / 5) * 0.3;
    }

    // Ebullición: saturación > 100°C
    if (waterTemperature >= 100) {
      evapRate = 92 + (solarRadiation / 100) * 8;
    }

    evapRate = Math.max(0, Math.min(100, evapRate));

    // ─────────────────────────────────────────────────
    // 5. ESTADO DE FASE Y ACTIVIDAD MOLECULAR
    // ─────────────────────────────────────────────────
    let phaseState: string;
    let molecularActivity: string;

    if (waterTemperature <= 0) {
      phaseState = 'Sólido (Hielo)';
      molecularActivity = 'Mínima — Moléculas en red cristalina';
    } else if (waterTemperature < 15) {
      phaseState = 'Líquido Frío';
      molecularActivity = 'Baja — Vibración térmica lenta';
    } else if (waterTemperature < 40) {
      phaseState = 'Líquido';
      molecularActivity = 'Moderada — Movimiento cinético activo';
    } else if (waterTemperature < 70) {
      phaseState = 'Líquido Caliente';
      molecularActivity = 'Alta — Escape molecular acelerado';
    } else if (waterTemperature < 100) {
      phaseState = 'Transición Líquido → Gas';
      molecularActivity = 'Muy Alta — Pre-ebullición';
    } else {
      phaseState = 'Gas (Vapor de Agua)';
      molecularActivity = 'Máxima — Ebullición completa';
    }

    // Emit outputs
    this.outputs = {
      evaporationRate: Math.round(evapRate),
      waterSurfaceTemp,
      vaporPressure: Math.round(actualVP * 1000) / 1000,
      saturationVaporPressure: Math.round(satVP * 1000) / 1000,
      vaporPressureDeficit: Math.round(vpd * 1000) / 1000,
      phaseState,
      molecularActivity
    };

    // Visual effects
    this.heatShimmerActive = waterTemperature > 45 && solarRadiation > 30;
    this.boilingActive = waterTemperature >= 95;

    // Particles
    this.updateParticles(evapRate);
  }

  private updateParticles(rate: number) {
    const count = Math.floor(rate / 2);
    this.vaporParticles = Array(Math.max(0, count)).fill(0).map(() => ({
      left: 5 + Math.random() * 90 + '%',
      duration: 2 + Math.random() * 4 + 's',
      delay: Math.random() * 2 + 's',
      size: 8 + Math.random() * 18 + 'px'
    }));
  }

  getEvapState(rate: number): string {
    if (rate <= 2) return 'Nula / Congelada';
    if (rate < 15) return 'Muy Leve';
    if (rate < 35) return 'Leve (Brisa seca)';
    if (rate < 55) return 'Moderada';
    if (rate < 75) return 'Intensa';
    if (rate < 92) return 'Muy Intensa';
    return 'Ebullición Total';
  }

  getPhaseColor(): string {
    const t = this.vars.waterTemperature;
    if (t <= 0) return '#a0e8ff';
    if (t < 40) return '#00c8ff';
    if (t < 70) return '#ff9500';
    if (t < 100) return '#ff4444';
    return '#ff0066';
  }
}
