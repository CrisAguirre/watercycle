import { Component, OnInit, OnDestroy } from '@angular/core';

interface PrecipVariables {
  rainIntensity: number;        // 0–100 mm/h
  duration: number;             // 5–360 minutes
  catchmentArea: number;        // 1–10000 m²
  windSpeed: number;            // 0–100 km/h
}

interface PrecipOutputs {
  accumulatedVolume: number;    // litres
  instantIntensity: number;     // mm/h
  precipitationType: string;
  runoffEstimate: number;       // L/min
  dropSize: number;             // mm (Marshall-Palmer median)
  kineticEnergy: number;        // J/m²/h
  rainfallDepth: number;        // mm total
  windDriftAngle: number;       // degrees
}

@Component({
  selector: 'app-sim3-precipitacion',
  templateUrl: './sim3-precipitacion.component.html',
  styleUrls: ['./sim3-precipitacion.component.css']
})
export class Sim3PrecipitacionComponent implements OnInit, OnDestroy {

  vars: PrecipVariables = {
    rainIntensity: 25,
    duration: 60,
    catchmentArea: 100,
    windSpeed: 10
  };

  outputs: PrecipOutputs = {
    accumulatedVolume: 0,
    instantIntensity: 0,
    precipitationType: 'Sin precipitación',
    runoffEstimate: 0,
    dropSize: 0,
    kineticEnergy: 0,
    rainfallDepth: 0,
    windDriftAngle: 0
  };

  rainDrops: any[] = [];
  splashParticles: any[] = [];
  puddleLevel = 0;
  stormOverlayOpacity = 0;
  lightningActive = false;

  private engineLoop: any;
  private elapsedMinutes = 0;
  private lightningTimeout: any;

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 500);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
    if (this.lightningTimeout) clearTimeout(this.lightningTimeout);
  }

  onVarChange(event: Event, key: keyof PrecipVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  // ═══════════════════════════════════════════════════════
  //  MOTOR FÍSICO: PRECIPITACIÓN
  //  Basado en:
  //  - Distribución de Marshall-Palmer (tamaño de gotas)
  //  - Curva IDF simplificada (Intensidad-Duración-Frecuencia)
  //  - Modelo volumétrico de acumulación
  //  - Ecuación de energía cinética de Wischmeier
  // ═══════════════════════════════════════════════════════
  private physicsTick() {
    const { rainIntensity, duration, catchmentArea, windSpeed } = this.vars;

    // ─────────────────────────────────────────────────
    // 1. INTENSIDAD INSTANTÁNEA (con modulación temporal)
    //    Simula variabilidad: picos y valles según IDF
    //    I_inst = I_base × (1 + 0.2×sin(t))
    // ─────────────────────────────────────────────────
    this.elapsedMinutes += 0.5;
    if (this.elapsedMinutes > duration) this.elapsedMinutes = 0;

    const temporalFactor = 1 + 0.15 * Math.sin(this.elapsedMinutes * 0.1);
    const instantIntensity = Math.round(rainIntensity * temporalFactor * 10) / 10;

    // ─────────────────────────────────────────────────
    // 2. CLASIFICACIÓN DEL TIPO DE PRECIPITACIÓN
    //    Según escala meteorológica estándar (WMO)
    // ─────────────────────────────────────────────────
    let precipitationType: string;
    if (instantIntensity <= 0) {
      precipitationType = 'Sin precipitación';
    } else if (instantIntensity < 2.5) {
      precipitationType = 'Llovizna (Drizzle)';
    } else if (instantIntensity < 7.6) {
      precipitationType = 'Lluvia Ligera';
    } else if (instantIntensity < 25) {
      precipitationType = 'Lluvia Moderada';
    } else if (instantIntensity < 50) {
      precipitationType = 'Lluvia Fuerte';
    } else if (instantIntensity < 75) {
      precipitationType = 'Lluvia Torrencial';
    } else {
      precipitationType = 'Tormenta Extrema';
    }

    // ─────────────────────────────────────────────────
    // 3. TAMAÑO DE GOTA (Marshall-Palmer, 1948)
    //    N(D) = N₀ × e^(-ΛD)
    //    Λ = 4.1 × R^(-0.21)  →  Diámetro mediano
    //    D₀ ≈ 1.6 / Λ  (mm)
    // ─────────────────────────────────────────────────
    let dropSize = 0;
    if (rainIntensity > 0) {
      const lambda = 4.1 * Math.pow(Math.max(0.1, rainIntensity), -0.21);
      dropSize = Math.round((1.6 / lambda) * 100) / 100;
    }

    // ─────────────────────────────────────────────────
    // 4. ENERGÍA CINÉTICA (Wischmeier & Smith)
    //    KE = 11.87 + 8.73 × log₁₀(I)  [J/m²/mm]
    //    KE_total = KE × I  [J/m²/h]
    // ─────────────────────────────────────────────────
    let kineticEnergy = 0;
    if (rainIntensity > 0) {
      const kePerMm = 11.87 + 8.73 * Math.log10(Math.max(0.1, rainIntensity));
      kineticEnergy = Math.round(kePerMm * rainIntensity * 10) / 10;
    }

    // ─────────────────────────────────────────────────
    // 5. VOLUMEN ACUMULADO
    //    V = I × A × t / 1000  [litros]
    //    (I en mm/h, A en m², t en horas)
    // ─────────────────────────────────────────────────
    const durationHours = duration / 60;
    const rainfallDepth = Math.round(rainIntensity * durationHours * 10) / 10;
    const accumulatedVolume = Math.round(
      (rainIntensity * catchmentArea * durationHours) / 1000 * 1000
    );

    // ─────────────────────────────────────────────────
    // 6. ESCORRENTÍA ESTIMADA (Coeficiente racional simplificado)
    //    Q = C × I × A / 360  [L/s]
    //    C ≈ 0.5 (suelo promedio)
    // ─────────────────────────────────────────────────
    const runoffCoeff = 0.5;
    const runoffEstimate = Math.round(
      (runoffCoeff * rainIntensity * catchmentArea / 360) * 60 * 10
    ) / 10;

    // ─────────────────────────────────────────────────
    // 7. ÁNGULO DE DERIVA POR VIENTO
    //    θ = arctan(Vw / Vt)
    //    Vt (velocidad terminal) ≈ 9 m/s para gotas medianas
    // ─────────────────────────────────────────────────
    const terminalVelocity = 9;
    const windMs = windSpeed / 3.6;
    const windDriftAngle = Math.round(
      Math.atan(windMs / terminalVelocity) * (180 / Math.PI)
    );

    // Emit outputs
    this.outputs = {
      accumulatedVolume,
      instantIntensity,
      precipitationType,
      runoffEstimate,
      dropSize,
      kineticEnergy,
      rainfallDepth,
      windDriftAngle
    };

    // Visual effects
    this.updateVisuals(rainIntensity, windDriftAngle);
  }

  private updateVisuals(intensity: number, driftAngle: number) {
    // Rain drops
    const dropCount = Math.floor(intensity / 1.5);
    this.rainDrops = Array(Math.max(0, Math.min(80, dropCount))).fill(0).map(() => ({
      left: Math.random() * 120 - 10 + '%',
      duration: 0.3 + Math.random() * 0.5 + 's',
      delay: Math.random() * 1 + 's',
      height: 15 + Math.random() * 25 + 'px',
      opacity: 0.3 + (intensity / 100) * 0.7
    }));

    // Splash particles
    const splashCount = Math.floor(intensity / 5);
    this.splashParticles = Array(Math.max(0, Math.min(20, splashCount))).fill(0).map(() => ({
      left: 5 + Math.random() * 90 + '%',
      delay: Math.random() * 1.5 + 's'
    }));

    // Puddle level (0-100%)
    this.puddleLevel = Math.min(100, intensity * 0.8);

    // Storm overlay opacity
    this.stormOverlayOpacity = Math.min(0.6, intensity / 100 * 0.6);

    // Lightning for extreme storms
    if (intensity > 60 && Math.random() > 0.7) {
      this.triggerLightning();
    }
  }

  private triggerLightning() {
    this.lightningActive = true;
    this.lightningTimeout = setTimeout(() => {
      this.lightningActive = false;
    }, 150);
  }

  getIntensityColor(): string {
    const i = this.vars.rainIntensity;
    if (i <= 0) return '#666';
    if (i < 10) return '#88ccff';
    if (i < 25) return '#00aaff';
    if (i < 50) return '#0066cc';
    if (i < 75) return '#ff8800';
    return '#ff3333';
  }

  getSkyGradient(): string {
    const i = this.vars.rainIntensity;
    if (i <= 5) return 'linear-gradient(180deg, #1a3a5c 0%, #2a5a7a 40%, #3a7a60 100%)';
    if (i < 25) return 'linear-gradient(180deg, #1a2a3c 0%, #2a3a5a 40%, #2a5a50 100%)';
    if (i < 50) return 'linear-gradient(180deg, #0f1a2a 0%, #1a2a3a 40%, #1a3a30 100%)';
    if (i < 75) return 'linear-gradient(180deg, #0a1018 0%, #101820 40%, #0f2018 100%)';
    return 'linear-gradient(180deg, #050810 0%, #0a1015 40%, #081510 100%)';
  }
}
