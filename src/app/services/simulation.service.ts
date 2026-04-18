import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SystemVariables {
  temperature: number;      // 0 to 100 (°C)
  solarRadiation: number;   // 0 to 100
  windSpeed: number;        // 1 to 100
  windDirection: string;    // N, NE, E, SE, S, SW, W, NW
  atmosphericPressure: number; // 900 to 1100 hPa
  humidity: number;         // 0 to 100 % (saturación base)
}

export interface CycleRates {
  evaporationRate: number;    // Represents the ACTIVE flow of evaporation
  condensationRate: number;   // Represents the ACCUMULATED STOCK of clouds
  precipitationRate: number;  // Represents the ACTIVE flow of rain
  runoffRate: number;         // Represents the ACCUMULATED runoff flow (inercia)
  currentWindDir: string;
  dewPoint: number;
  barometerState: string;
}

@Injectable({
  providedIn: 'root'
})
export class SimulationService implements OnDestroy {
  private variables = new BehaviorSubject<SystemVariables>({
    temperature: 25,
    solarRadiation: 50,
    windSpeed: 20,
    windDirection: 'E',
    atmosphericPressure: 1013,
    humidity: 50
  });

  public variables$ = this.variables.asObservable();

  private rates = new BehaviorSubject<CycleRates>({
    evaporationRate: 0,
    condensationRate: 0,
    precipitationRate: 0,
    runoffRate: 0,
    currentWindDir: 'E',
    dewPoint: 0,
    barometerState: 'Estable'
  });
  public rates$ = this.rates.asObservable();

  // ═══════════════════════════════════════════════════════
  // MEMORIA INTERNA DEL ECOSISTEMA (Stocks Acumulativos)
  // ═══════════════════════════════════════════════════════
  private stockCloudMass = 0;   // % acumulado de masa de nubes (0-100)
  private stockRunoff = 0;      // % acumulado de escorrentía fluvial (0-100)
  private stockAtmosphericVapor = 0; // Vapor disponible en atmósfera para condensar

  private ecosystemLoop: any;

  constructor() {
    this.startLivingEcosystem();
  }

  private startLivingEcosystem() {
    // Motor "Life Engine" que reevalúa el paisaje cada 500 milisegundos (Latidos)
    this.ecosystemLoop = setInterval(() => {
      this.processSystemDynamicsTick();
    }, 500);
  }

  // ═══════════════════════════════════════════════════════
  //  MOTOR PRINCIPAL DE DINÁMICA DE SISTEMAS
  //  Basado en ecuaciones simplificadas de:
  //  - Clausius-Clapeyron (evaporación)
  //  - Fórmula de Magnus (punto de rocío)
  //  - Modelo Penman simplificado (evapotranspiración)
  //  - Precipitación por umbral de saturación
  // ═══════════════════════════════════════════════════════
  private processSystemDynamicsTick() {
    const vars = this.variables.value;

    // ───────────────────────────────────────────────
    // 0. PUNTO DE ROCÍO (Fórmula de Magnus)
    //    Td = (b * α(T,RH)) / (a - α(T,RH))
    //    donde α(T,RH) = (a*T)/(b+T) + ln(RH/100)
    //    a = 17.27, b = 237.7
    // ───────────────────────────────────────────────
    const a = 17.27, b = 237.7;
    const humidityClamp = Math.max(1, vars.humidity); // Evitar ln(0)
    const alpha = (a * vars.temperature) / (b + vars.temperature) + Math.log(humidityClamp / 100);
    const dewPoint = (b * alpha) / (a - alpha);

    // ───────────────────────────────────────────────
    // 1. EVAPORACIÓN (Clausius-Clapeyron Simplificado)
    //    La tasa de evaporación depende de:
    //    - Temperatura: relación exponencial (se duplica aprox. cada 10°C)
    //    - Radiación solar: energía disponible para el cambio de fase
    //    - Viento: renovación de la capa límite (efecto raíz cuadrada)
    //    - Humedad: bloqueo total cuando HR → 100% (aire saturado)
    //    - Presión: menor presión → más espacio para moléculas de vapor
    // ───────────────────────────────────────────────
    
    // Factor térmico: exponencial simplificado (Clausius-Clapeyron)
    // A 0°C ≈ 0.07, A 15°C ≈ 0.30, A 25°C ≈ 0.60, A 35°C ≈ 1.0, A 50°C ≈ 2.5
    const tempFactor = Math.max(0, Math.exp(0.0627 * (vars.temperature - 20)) - 0.3);
    
    // Factor solar: energía neta disponible (0 a 1)
    const solarFactor = vars.solarRadiation / 100;
    
    // Factor eólico: capa límite (raíz cuadrada, se satura a ~60 km/h)
    const windFactor = Math.sqrt(vars.windSpeed) / Math.sqrt(100); // 0 a 1
    
    // Factor de humedad: BLOQUEO TOTAL cuando HR→100%
    // (1 - HR/100)² → caída parabólica más pronunciada cerca de saturación
    const humidityBlock = Math.pow(1 - vars.humidity / 100, 1.5);
    
    // Factor de presión atmosférica: sutil contribución
    // Baja presión favorece evaporación, alta presión la inhibe ligeramente
    const pressureFactor = 1 + (1013 - vars.atmosphericPressure) * 0.001;
    
    // Fórmula combinada de evaporación (Penman simplificado)
    let evapRate = (tempFactor * 35 + solarFactor * 30 + windFactor * 20) 
                   * humidityBlock 
                   * pressureFactor;
    
    // Umbral de congelación: a T < 2°C, la evaporación es mínima (sublimación residual)
    if (vars.temperature < 2) {
      evapRate *= vars.temperature < 0 ? 0.05 : (vars.temperature / 2) * 0.3;
    }
    
    evapRate = Math.max(0, Math.min(100, evapRate));
    
    // Aporte de vapor a la atmósfera por tick (lento, acumulativo)
    const vaporInjectionPerTick = evapRate * 0.06;

    // ───────────────────────────────────────────────
    // 2. CONDENSACIÓN (Punto de Rocío + Orografía)
    //    Las nubes se forman cuando:
    //    - La temperatura se acerca al punto de rocío (ΔT < umbral)
    //    - Hay humedad disponible en la atmósfera
    //    - El viento empuja vapor contra la montaña (orográfico)
    //    Las nubes se DISIPAN cuando:
    //    - Alta presión (subsidencia anticiclónica)
    //    - Calor intenso (calentamiento adiabático)
    // ───────────────────────────────────────────────
    
    // Acumular vapor atmosférico (se llena con evaporación, se consume con condensación)
    this.stockAtmosphericVapor += vaporInjectionPerTick;
    this.stockAtmosphericVapor = Math.min(100, this.stockAtmosphericVapor);
    
    // Delta T - Td: distancia al punto de rocío
    // Cuanto más cerca (delta pequeño), más condensación
    const deltaDewPoint = vars.temperature - dewPoint;
    
    // Probabilidad de condensación basada en cercanía al punto de rocío
    // Si T ≈ Td (delta < 2): condensación fuerte
    // Si delta 2-8: condensación moderada
    // Si delta > 8: condensación nula (aire seco)
    let condensationEfficiency = 0;
    if (deltaDewPoint <= 2) {
      condensationEfficiency = 1.0; // Saturación total → condensación máxima
    } else if (deltaDewPoint <= 5) {
      condensationEfficiency = 1 - (deltaDewPoint - 2) / 3 * 0.5; // 1.0 → 0.5
    } else if (deltaDewPoint <= 10) {
      condensationEfficiency = 0.5 - (deltaDewPoint - 5) / 5 * 0.4; // 0.5 → 0.1
    } else if (deltaDewPoint <= 20) {
      condensationEfficiency = 0.1 - (deltaDewPoint - 10) / 10 * 0.1; // 0.1 → 0.0
    } else {
      condensationEfficiency = 0; // Demasiado lejos del punto de rocío
    }

    // Efecto Orográfico del viento (barrera montañosa)
    const windTowardsOcean = ['W', 'NW', 'SW'];
    const windParallel = ['N', 'S'];
    let orographicMult = 1.0;
    if (windTowardsOcean.includes(vars.windDirection)) {
      orographicMult = 0.3; // Viento hacia el mar: dificulta acumulación
    } else if (windParallel.includes(vars.windDirection)) {
      orographicMult = 0.6; // Viento paralelo: formaciones parciales
    } else {
      orographicMult = 1.5; // Viento contra la montaña: ascenso orográfico masivo
    }
    
    // Efecto de velocidad del viento sobre condensación orográfica
    // Más viento = más transporte de humedad = más condensación (hasta un punto)
    const windCondBoost = 1 + Math.min(vars.windSpeed / 100, 1) * 0.5;
    
    // Flujo neto de condensación por tick
    const condensationFlow = this.stockAtmosphericVapor * condensationEfficiency 
                             * orographicMult * windCondBoost * 0.08;
    
    // Consumir vapor atmosférico al condensar
    this.stockAtmosphericVapor -= condensationFlow * 0.6;
    this.stockAtmosphericVapor = Math.max(0, this.stockAtmosphericVapor);
    
    // DISIPACIÓN NATURAL de nubes (subsidencia anticiclónica + calor)
    let dissipation = 0;
    // Alta presión disipa nubes (anticiclón > 1020 hPa)
    if (vars.atmosphericPressure > 1015) {
      dissipation += (vars.atmosphericPressure - 1015) * 0.003;
    }
    // Calor extremo (> 35°C) + baja humedad evapora nubes (calentamiento adiabático)
    if (vars.temperature > 35 && vars.humidity < 40) {
      dissipation += (vars.temperature - 35) * 0.005;
    }
    
    // Actualizar stock de nubes
    this.stockCloudMass += condensationFlow;
    this.stockCloudMass -= dissipation;

    // ───────────────────────────────────────────────
    // 3. PRECIPITACIÓN (Lluvia por Saturación)
    //    La lluvia ocurre cuando:
    //    - Masa de nube > 65% (umbral de precipitación real)
    //    - Relación NO lineal (cuadrática): más masa → lluvias exponencialmente más fuertes
    //    - Baja presión (borrasca) amplifica la descarga
    //    - Alta presión (anticiclón) inhibe la lluvia incluso con nubes densas
    // ───────────────────────────────────────────────
    let rainFlowTick = 0;
    const precipitationThreshold = 65; // Umbral científico realista
    
    if (this.stockCloudMass > precipitationThreshold) {
      // Exceso sobre el umbral
      const excess = this.stockCloudMass - precipitationThreshold;
      const maxExcess = 100 - precipitationThreshold; // 35
      
      // Curva cuadrática: precipitación = (exceso/max)² → más masa = mucha más lluvia
      const normalizedExcess = excess / maxExcess;
      rainFlowTick = Math.pow(normalizedExcess, 1.8) * 5; // Exponente 1.8 para curva suave
      
      // Amplificación por borrasca (baja presión exprime las nubes)
      if (vars.atmosphericPressure < 1005) {
        const stormBoost = 1 + (1005 - vars.atmosphericPressure) * 0.008;
        rainFlowTick *= stormBoost;
      }
      
      // Inhibición por anticiclón (alta presión estabiliza, reduce precipitación)
      if (vars.atmosphericPressure > 1025) {
        const antiBoost = 1 - Math.min((vars.atmosphericPressure - 1025) * 0.006, 0.7);
        rainFlowTick *= antiBoost;
      }
      
      // Viento fuerte intensifica la descarga (arrastre mecánico)
      rainFlowTick *= 1 + vars.windSpeed * 0.003;
    }
    
    // ───────────────────────────────────────────────
    // 4. ACTUALIZACIÓN DE STOCKS
    // ───────────────────────────────────────────────
    this.stockCloudMass -= rainFlowTick;
    this.stockCloudMass = Math.max(0, Math.min(100, this.stockCloudMass));
    
    // ───────────────────────────────────────────────
    // 5. ESCORRENTÍA CON INERCIA HIDROLÓGICA
    //    El agua de lluvia no se convierte en río instantáneamente:
    //    - Primero el suelo absorbe (infiltración)
    //    - Luego, al saturarse, el agua corre (escorrentía superficial)
    //    - El caudal fluvial tiene inercia: sube lento y baja lento
    //    - Depende de la dirección del viento (lluvia sobre montaña → más ríos)
    // ───────────────────────────────────────────────
    
    // Calcular aporte de lluvia sobre montaña/tierra
    let terrainRainContribution = 0;
    if (['E', 'NE', 'SE'].includes(vars.windDirection)) {
      terrainRainContribution = rainFlowTick * 1.0; // Lluvia directa sobre la ladera
    } else if (['N', 'S'].includes(vars.windDirection)) {
      terrainRainContribution = rainFlowTick * 0.4; // Parte cae sobre tierra
    } else {
      terrainRainContribution = rainFlowTick * 0.1; // Casi todo cae al mar
    }
    
    // Infiltración: el suelo absorbe las primeras lluvias (factor de retención)
    const soilAbsorption = 0.3; // 30% del agua se infiltra al subsuelo
    const surfaceContribution = terrainRainContribution * (1 - soilAbsorption);
    
    // Acumular escorrentía con inercia
    this.stockRunoff += surfaceContribution * 1.5;
    
    // Drenaje natural: los ríos van drenando al mar gradualmente
    const drainRate = 0.15; // 15% del stock drena por tick (inercia lenta)
    this.stockRunoff -= this.stockRunoff * drainRate;
    this.stockRunoff = Math.max(0, Math.min(100, this.stockRunoff));

    // ───────────────────────────────────────────────
    // 6. CÁLCULOS DE DISPLAY (Instrumentación)
    // ───────────────────────────────────────────────
    
    // Barómetro descriptivo con más estados
    let baroState = 'Estable / Tránsito';
    if (vars.atmosphericPressure < 985) baroState = 'Borrasca Severa (Ciclón)';
    else if (vars.atmosphericPressure < 1000) baroState = 'Borrasca / Tormenta (Baja Presión)';
    else if (vars.atmosphericPressure < 1010) baroState = 'Ligeramente Inestable';
    else if (vars.atmosphericPressure > 1035) baroState = 'Anticiclón Fuerte (Muy Despejado)';
    else if (vars.atmosphericPressure > 1020) baroState = 'Anticiclón / Cielos Despejados';

    // Display de precipitación: proporcional a la intensidad del flujo
    // Escalar rainFlowTick (0~5+) a porcentaje visual (0~100)
    let uiRainDisplay = Math.min(100, Math.round(rainFlowTick * 18));
    
    // Emitir el Pulso Acumulativo de este medio segundo a todo Angular
    this.rates.next({
      evaporationRate: Math.round(evapRate),
      condensationRate: Math.round(this.stockCloudMass),
      precipitationRate: uiRainDisplay,
      runoffRate: Math.round(this.stockRunoff),
      currentWindDir: vars.windDirection,
      dewPoint: Math.round(dewPoint * 10) / 10,
      barometerState: baroState
    });
  }

  updateVariable(key: keyof SystemVariables, value: any) {
    this.variables.next({ ...this.variables.value, [key]: value });
  }

  getCurrentWindDir(): string {
    return this.variables.value.windDirection;
  }

  ngOnDestroy() {
    if (this.ecosystemLoop) clearInterval(this.ecosystemLoop);
  }
}
