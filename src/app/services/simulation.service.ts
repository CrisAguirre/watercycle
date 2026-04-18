import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';

export interface SystemVariables {
  temperature: number;      // 0 to 100 (°C)
  solarRadiation: number;   // 0 to 100
  windSpeed: number;        // 1 to 100
  windDirection: number;    // 1 (Hacia Montaña) or -1 (Hacia Mar)
  atmosphericPressure: number; // 900 to 1100 hPa
  humidity: number;         // 0 to 100 % (saturación base)
}

export interface CycleRates {
  evaporationRate: number;
  condensationRate: number;
  precipitationRate: number;
  currentWindDir: number;
}

@Injectable({
  providedIn: 'root'
})
export class SimulationService {
  private variables = new BehaviorSubject<SystemVariables>({
    temperature: 25,
    solarRadiation: 50,
    windSpeed: 20,
    windDirection: 1,
    atmosphericPressure: 1013,
    humidity: 50
  });

  public variables$ = this.variables.asObservable();

  public rates$: Observable<CycleRates> = this.variables$.pipe(
    map(vars => {
      // 1. Evaporación: Aumenta con calor, viento y rad solar. Se DIFICULTA si la presión es alta o si el ambiente ya está muy húmedo.
      let evapBase = (vars.temperature * 0.4) + (vars.solarRadiation * 0.3) + (vars.windSpeed * 0.2);
      let pressureFactor = (1013 - vars.atmosphericPressure) * 0.1; // Baja presión suma, Alta resta
      let humidityBlock = vars.humidity * 0.3; // Humedad frena la evaporación
      let evaporationRate = evapBase + pressureFactor - humidityBlock;

      evaporationRate = Math.max(0, evaporationRate);

      // 2. Condensación: Ocurre si hay evaporación. La presión alta dificulta la subida de vapor. 
      // Si el viento va hacia el mar (-1), las nubes no se estancan en la montaña.
      let condensationFactor = evaporationRate > 20 ? (evaporationRate * 0.8) - (vars.temperature * 0.2) : 0;
      let condensationRate = condensationFactor;
      if (vars.windDirection === -1) {
        condensationRate *= 0.5; // Menos condensación en la cima porque el viento se la lleva al mar
      }

      condensationRate = Math.max(0, condensationRate);

      // 3. Precipitación: Efecto alcancía. Si la condensación supera el punto de rocío y peso.
      let precipFactor = condensationRate > 30 ? condensationRate * 1.5 : 0;
      let precipitationRate = precipFactor + (1013 - vars.atmosphericPressure) * 0.2;

      // Dinámica de Despeje: Si llueve mucho, la nube "se descarga" y pierde condensación
      if (precipitationRate > 20) {
        condensationRate -= (precipitationRate * 0.4); 
      }

      return {
        evaporationRate: Math.max(0, Math.min(100, evaporationRate)),
        condensationRate: Math.max(0, Math.min(100, condensationRate)),
        precipitationRate: Math.max(0, Math.min(100, precipitationRate)),
        currentWindDir: vars.windDirection
      };
    })
  );

  updateVariable(key: keyof SystemVariables, value: number) {
    this.variables.next({ ...this.variables.value, [key]: value });
  }

  getCurrentWindDir(): number {
    return this.variables.value.windDirection;
  }
}

