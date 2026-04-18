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
    currentWindDir: 'E',
    dewPoint: 0,
    barometerState: 'Estable'
  });
  public rates$ = this.rates.asObservable();

  // Memoria Interna del Motor Acumulativo (Ecosistema Autónomo)
  private stockCloudMass = 0; // % acumulado de las nubes (Inercia)
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

  private processSystemDynamicsTick() {
    const vars = this.variables.value;

    // 1. FLUJO DE ENTRADA (Gas): Evaporación Dinámica
    let evapFlowRaw = (vars.temperature * 0.4) + (vars.solarRadiation * 0.3) + (vars.windSpeed * 0.2);
    let pressureFactor = (1013 - vars.atmosphericPressure) * 0.1; 
    let evaporatorBlock = vars.humidity * 0.3; 
    
    let evapFlowPerSecond = Math.max(0, evapFlowRaw + pressureFactor - evaporatorBlock);
    evapFlowPerSecond = Math.min(100, evapFlowPerSecond);
    
    let tickEvapAporte = evapFlowPerSecond * 0.05; // Lo inyectado en cada tick (lento y sutil)

    // 2. VÁLVULA GEOGRÁFICA (Viento empuja nubes vs Montaña)
    const windTowardsOcean = ['W', 'NW', 'SW'];
    const windParallel = ['N', 'S'];

    let absorptionMult = 1.0;
    if (windTowardsOcean.includes(vars.windDirection)) absorptionMult = 0.3; // Difícil armar nubes sobre alta mar
    else if (windParallel.includes(vars.windDirection)) absorptionMult = 0.7; // Paralelo, formaciones tibias
    else absorptionMult = 1.6; // Choca de frente a la ladera (Orográfico masivo)

    let cloudFillingFlow = tickEvapAporte * absorptionMult;

    // 3. FLUJO DE SALIDA (Líquido): Precipitación (Lluvia drena el cielo)
    let rainFlowTick = 0;
    // Efecto Presa: La nube es un balde. Si se satura mucho (>50%), gotea.
    if (this.stockCloudMass > 50) {
       let stormPressure = (this.stockCloudMass - 45) * 0.3; // Presión intrínseca del peso del agua
       if (vars.atmosphericPressure <= 1005) stormPressure *= 1.5; // Borrasca la exprime 
       
       rainFlowTick = stormPressure * 0.15; // Agua soltada a la tierra 
    }

    // 4. ACTUALIZACIÓN MATEMÁTICA DEL STOCK (Nivel de agua satélite)
    this.stockCloudMass += cloudFillingFlow;
    this.stockCloudMass -= rainFlowTick;
    this.stockCloudMass = Math.max(0, Math.min(100, this.stockCloudMass));

    // 5. INYECCIÓN HACIA INTERFAZ (Instrumentación Humana y HUDs)
    let dewPointCalc = vars.temperature - ((100 - vars.humidity) / 5);
    
    let baroState = 'Estable / Tránsito';
    if (vars.atmosphericPressure < 1000) baroState = 'Borrasca / Tormenta (Baja Presión)';
    else if (vars.atmosphericPressure > 1020) baroState = 'Anticiclón / Cielos Despejados';
    
    let uiEvapDisplay = Math.round(evapFlowPerSecond);
    let uiRainDisplay = Math.round(rainFlowTick > 0.1 ? (rainFlowTick * 20) : 0);

    // Emitir el Pulso Acumulativo de este medio segundo a todo Angular
    this.rates.next({
      evaporationRate: uiEvapDisplay,
      condensationRate: Math.round(this.stockCloudMass),
      precipitationRate: Math.min(100, uiRainDisplay),
      currentWindDir: vars.windDirection,
      dewPoint: Math.round(dewPointCalc * 10) / 10,
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

