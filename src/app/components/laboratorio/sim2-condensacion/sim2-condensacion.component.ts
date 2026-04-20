import { Component, OnInit, OnDestroy } from '@angular/core';

interface CondVariables {
  airTemperature: number;         // -10 to 50 °C
  humidity: number;               // 0–100 %
  atmosphericPressure: number;    // 900–1100 hPa
  altitude: number;               // 0–5000 m
}

interface CondOutputs {
  dewPoint: number;
  condensationRate: number;
  cloudMass: number;
  deltaTdew: number;
  tempAtAltitude: number;
  relativeHumidityAtAlt: number;
  cloudBaseAltitude: number;
  cloudState: string;
  atmosphericStability: string;
}

@Component({
  selector: 'app-sim2-condensacion',
  templateUrl: './sim2-condensacion.component.html',
  styleUrls: ['./sim2-condensacion.component.css']
})
export class Sim2CondensacionComponent implements OnInit, OnDestroy {

  vars: CondVariables = {
    airTemperature: 22,
    humidity: 60,
    atmosphericPressure: 1013,
    altitude: 1500
  };

  outputs: CondOutputs = {
    dewPoint: 0,
    condensationRate: 0,
    cloudMass: 0,
    deltaTdew: 0,
    tempAtAltitude: 0,
    relativeHumidityAtAlt: 0,
    cloudBaseAltitude: 0,
    cloudState: 'Despejado',
    atmosphericStability: 'Estable'
  };

  cloudParticles: any[] = [];
  fogActive = false;
  mistParticles: any[] = [];
  private stockCloudMass = 0;

  private engineLoop: any;

  ngOnInit() {
    this.physicsTick();
    this.engineLoop = setInterval(() => this.physicsTick(), 500);
  }

  ngOnDestroy() {
    if (this.engineLoop) clearInterval(this.engineLoop);
  }

  onVarChange(event: Event, key: keyof CondVariables) {
    const el = event.target as HTMLInputElement;
    this.vars[key] = Number(el.value);
  }

  // ═══════════════════════════════════════════════════════
  //  MOTOR FÍSICO: CONDENSACIÓN
  //  Basado en:
  //  - Fórmula de Magnus (punto de rocío)
  //  - Gradiente adiabático (tasa de descenso térmico)
  //  - Modelo de formación de nubes por ascenso orográfico
  //  - Ecuación de Clausius-Clapeyron para HR a altitud
  // ═══════════════════════════════════════════════════════
  private physicsTick() {
    const { airTemperature, humidity, atmosphericPressure, altitude } = this.vars;

    // ─────────────────────────────────────────────────
    // 1. PUNTO DE ROCÍO (Fórmula de Magnus)
    //    Td = (b × α) / (a - α)
    //    donde α = (a × T)/(b + T) + ln(HR/100)
    //    a = 17.27, b = 237.3
    // ─────────────────────────────────────────────────
    const a = 17.27, b = 237.3;
    const humClamp = Math.max(1, humidity);
    const alpha = (a * airTemperature) / (b + airTemperature) + Math.log(humClamp / 100);
    const dewPoint = Math.round(((b * alpha) / (a - alpha)) * 10) / 10;

    // ─────────────────────────────────────────────────
    // 2. GRADIENTE ADIABÁTICO (Descenso térmico con altitud)
    //    Tasa de descenso: ~6.5°C por cada 1000m (troposfera)
    //    T_alt = T_superficie - (altitud/1000) × 6.5
    // ─────────────────────────────────────────────────
    const lapseRate = 6.5; // °C por 1000m
    const tempAtAltitude = Math.round((airTemperature - (altitude / 1000) * lapseRate) * 10) / 10;

    // ─────────────────────────────────────────────────
    // 3. HUMEDAD RELATIVA A ALTITUD
    //    A medida que el aire asciende y se enfría,
    //    la HR aumenta (el aire frío sostiene menos vapor).
    //    Ps_alt / Ps_surface ratio
    // ─────────────────────────────────────────────────
    const satVPsurface = 0.6108 * Math.exp((a * airTemperature) / (b + airTemperature));
    const satVPaltitude = 0.6108 * Math.exp((a * tempAtAltitude) / (b + tempAtAltitude));
    const actualVP = (humidity / 100) * satVPsurface;
    let relHumAtAlt = Math.min(100, Math.round((actualVP / satVPaltitude) * 100));
    if (satVPaltitude <= 0) relHumAtAlt = 100;

    // ─────────────────────────────────────────────────
    // 4. ALTITUD BASE DE NUBES (Lifted Condensation Level)
    //    LCL ≈ 125 × (T - Td)  [metros]
    //    Es la altitud a la que el aire alcanza saturación
    // ─────────────────────────────────────────────────
    const deltaTdew = Math.round((airTemperature - dewPoint) * 10) / 10;
    const cloudBaseAltitude = Math.max(0, Math.round(125 * Math.max(0, deltaTdew)));

    // ─────────────────────────────────────────────────
    // 5. TASA DE CONDENSACIÓN
    //    Depende de:
    //    - Cercanía de T a Td (delta pequeño → más condensación)
    //    - Altitud respecto al LCL
    //    - Presión atmosférica (baja → facilita ascenso)
    // ─────────────────────────────────────────────────
    let condensationEfficiency = 0;

    // A) Cercanía al punto de rocío
    if (deltaTdew <= 1) {
      condensationEfficiency = 1.0;
    } else if (deltaTdew <= 3) {
      condensationEfficiency = 1.0 - (deltaTdew - 1) / 2 * 0.3;
    } else if (deltaTdew <= 8) {
      condensationEfficiency = 0.7 - (deltaTdew - 3) / 5 * 0.4;
    } else if (deltaTdew <= 15) {
      condensationEfficiency = 0.3 - (deltaTdew - 8) / 7 * 0.25;
    } else {
      condensationEfficiency = Math.max(0, 0.05 - (deltaTdew - 15) * 0.003);
    }

    // B) Altitud alcanza o supera el LCL
    const altitudeAboveLCL = altitude - cloudBaseAltitude;
    let altitudeFactor = 0;
    if (altitudeAboveLCL > 0) {
      altitudeFactor = Math.min(1, altitudeAboveLCL / 2000) * 1.5;
    } else {
      altitudeFactor = Math.max(0, 1 - Math.abs(altitudeAboveLCL) / 1000) * 0.3;
    }

    // C) Presión baja favorece ascenso convectivo
    const pressureFactor = 1 + (1013 - atmosphericPressure) * 0.003;

    // D) Humedad base necesaria
    const humidityFactor = Math.pow(humidity / 100, 0.8);

    // Tasa de condensación instantánea
    const condensationFlow = condensationEfficiency * altitudeFactor * pressureFactor * humidityFactor * 4;

    // ─────────────────────────────────────────────────
    // 6. STOCK DE MASA DE NUBES (Acumulativo)
    //    Se acumula con condensación, se disipa con:
    //    - Alta presión (subsidencia)
    //    - Baja humedad
    //    - Calentamiento adiabático
    // ─────────────────────────────────────────────────
    this.stockCloudMass += condensationFlow;

    // Disipación
    let dissipation = 0.3; // Disipación base natural
    if (atmosphericPressure > 1020) {
      dissipation += (atmosphericPressure - 1020) * 0.008;
    }
    if (humidity < 30) {
      dissipation += (30 - humidity) * 0.015;
    }
    if (airTemperature > 35 && humidity < 40) {
      dissipation += (airTemperature - 35) * 0.01;
    }
    this.stockCloudMass -= dissipation;
    this.stockCloudMass = Math.max(0, Math.min(100, this.stockCloudMass));

    // ─────────────────────────────────────────────────
    // 7. ESTADOS DESCRIPTIVOS
    // ─────────────────────────────────────────────────
    let cloudState: string;
    if (this.stockCloudMass < 5) cloudState = 'Despejado';
    else if (this.stockCloudMass < 20) cloudState = 'Cirros (Nubes altas tenues)';
    else if (this.stockCloudMass < 45) cloudState = 'Cúmulos (Parcialmente nublado)';
    else if (this.stockCloudMass < 70) cloudState = 'Estratocúmulos (Nublado)';
    else if (this.stockCloudMass < 90) cloudState = 'Nimboestratos (Muy nublado)';
    else cloudState = 'Cumulonimbos (Tormenta inminente)';

    let atmosphericStability: string;
    if (atmosphericPressure > 1025) atmosphericStability = 'Muy Estable (Anticiclón)';
    else if (atmosphericPressure > 1010) atmosphericStability = 'Estable';
    else if (atmosphericPressure > 995) atmosphericStability = 'Ligeramente Inestable';
    else atmosphericStability = 'Inestable (Borrasca)';

    // Fog condition: near surface, T ≈ Td
    this.fogActive = deltaTdew < 2.5 && altitude < 500;

    // Emit
    this.outputs = {
      dewPoint,
      condensationRate: Math.round(Math.min(100, condensationFlow * 15)),
      cloudMass: Math.round(this.stockCloudMass),
      deltaTdew,
      tempAtAltitude,
      relativeHumidityAtAlt: relHumAtAlt,
      cloudBaseAltitude,
      cloudState,
      atmosphericStability
    };

    this.updateVisuals();
  }

  private updateVisuals() {
    // Cloud particles (proportional to cloud mass)
    const cloudCount = Math.floor(this.stockCloudMass / 8);
    this.cloudParticles = Array(Math.max(0, cloudCount)).fill(0).map(() => ({
      left: 15 + Math.random() * 70 + '%',
      top: 5 + Math.random() * 30 + '%',
      width: 80 + Math.random() * 200 + 'px',
      height: 40 + Math.random() * 80 + 'px',
      opacity: 0.3 + (this.stockCloudMass / 100) * 0.6,
      delay: Math.random() * 3 + 's'
    }));

    // Mist particles
    if (this.fogActive) {
      this.mistParticles = Array(8).fill(0).map(() => ({
        left: Math.random() * 100 + '%',
        duration: 5 + Math.random() * 5 + 's',
        delay: Math.random() * 3 + 's'
      }));
    } else {
      this.mistParticles = [];
    }
  }

  getCondColor(): string {
    const cm = this.stockCloudMass;
    if (cm < 20) return 'rgba(255,255,255,0.5)';
    if (cm < 50) return 'rgba(200,210,220,0.6)';
    if (cm < 75) return 'rgba(140,150,170,0.7)';
    return 'rgba(80,85,100,0.85)';
  }

  getDeltaColor(): string {
    const d = this.outputs.deltaTdew;
    if (d <= 2) return '#00ff88';
    if (d <= 5) return '#88ff00';
    if (d <= 10) return '#ffcc00';
    return '#ff4444';
  }
}
