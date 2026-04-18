import { Component, OnInit } from '@angular/core';
import { SimulationService, SystemVariables, CycleRates } from '../../services/simulation.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-simulation',
  templateUrl: './simulation.component.html',
  styleUrls: ['./simulation.component.css']
})
export class SimulationComponent implements OnInit {
  variables$!: Observable<SystemVariables>;
  rates$!: Observable<CycleRates>;

  evaporationParticles: any[] = [];
  rainDropParticles: any[] = [];
  runoffParticles: any[] = [];
  // Caching visual para evitar el parpadeo del Ecosistema Autónomo
  private lastPrecip = -1;
  private lastEvap = -1;
  private lastWindDir = '';

  constructor(public simService: SimulationService) { }

  ngOnInit(): void {
    this.variables$ = this.simService.variables$;
    this.rates$ = this.simService.rates$;

    this.rates$.subscribe(rates => {
      // Optimizador: Solo regenera las gotas de partículas si cambió drásticamente el nivel de agua o el viento
      if (
        Math.abs(this.lastPrecip - rates.precipitationRate) > 8 ||
        Math.abs(this.lastEvap - rates.evaporationRate) > 8 ||
        this.lastWindDir !== rates.currentWindDir
      ) {
        this.lastPrecip = rates.precipitationRate;
        this.lastEvap = rates.evaporationRate;
        this.lastWindDir = rates.currentWindDir;
        this.updateParticles(rates);
      }
    });
  }

  updateParticles(rates: CycleRates) {
    // Evaporation: Ocurre sobre el mar (0 a 30%)
    const evapCount = Math.floor(rates.evaporationRate / 1.5);
    this.evaporationParticles = Array(evapCount).fill(0).map((_, i) => ({
      left: 2 + Math.random() * 25 + '%',
      duration: 3 + Math.random() * 4 + 's',
      delay: Math.random() * 2 + 's'
    }));

    // Rain: Distribuida en área sobre el mapa según coordenadas isométricas aéreas
    const rainCount = Math.floor(rates.precipitationRate * 1.5); 
    let baseLeft = 55, rangeLeft = 35; // Este
    if (['W', 'NW', 'SW'].includes(rates.currentWindDir)) {
      baseLeft = 10; rangeLeft = 30; // Oeste Oceánico
    } else if (['N', 'S'].includes(rates.currentWindDir)) {
      baseLeft = 40; rangeLeft = 20; // Paralelo Centro
    }

    this.rainDropParticles = Array(rainCount).fill(0).map((_, i) => ({
      left: baseLeft + Math.random() * rangeLeft + '%',
      duration: 0.5 + Math.random() * 0.4 + 's',
      delay: Math.random() * 0.5 + 's'
    }));

    // Escorrentía: Desde las montañas hacia el centro
    const runoffCount = ['E', 'NE', 'SE'].includes(rates.currentWindDir) ? Math.floor(rates.precipitationRate / 1.5) : 0;
    this.runoffParticles = Array(runoffCount).fill(0).map((_, i) => ({
      duration: 3 + Math.random() * 3 + 's',
      delay: Math.random() * 3 + 's'
    }));
  }

  onVarChange(event: Event, key: string) {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    const value = key === 'windDirection' ? el.value : Number(el.value);
    this.simService.updateVariable(key as keyof SystemVariables, value);
  }

  // HUD Text Parsers
  getEvapState(rate: number): string {
    if (rate <= 5) return 'Mínima / Estancada';
    if (rate < 40) return 'Leve (Mar estable)';
    if (rate < 75) return 'Moderada (En ascenso)';
    return 'Altamente Acelerada';
  }

  getCondState(rate: number): string {
    if (rate <= 5) return 'Despejado / Nula';
    if (rate < 40) return 'Parcial / Ligera';
    if (rate < 75) return 'Densa (Nubarrones)';
    return 'Saturación Crítica';
  }

  getPrecipState(rate: number): string {
    if (rate === 0) return 'Seco (Ausente)';
    if (rate < 30) return 'Llovizna / Rocío';
    if (rate < 60) return 'Lluvia Moderada';
    return 'Precipitación Torrencial';
  }

  // Cuarta Fase: Escorrentía Analítica
  getRunoffRate(rates: any): number {
    const wind = rates.currentWindDir;
    if (['E', 'NE', 'SE'].includes(wind)) return rates.precipitationRate; 
    if (['N', 'S'].includes(wind)) return rates.precipitationRate * 0.4;
    return 0;
  }

  getRunoffState(rRate: number): string {
    if (rRate <= 0) return 'Cauces Secos';
    if (rRate < 30) return 'Flujo de Ríos Moderado';
    if (rRate < 60) return 'Corriente Terrestre Alta';
    return 'Desbordamiento e Infiltración';
  }

  // Animación del Widget Brújula
  getCompassRotation(dir: string | undefined | null): string {
    const angleMap: Record<string, string> = {
      'N': '0deg', 'NE': '45deg', 'E': '90deg', 'SE': '135deg',
      'S': '180deg', 'SW': '225deg', 'W': '270deg', 'NW': '315deg'
    };
    return angleMap[dir || 'N'] || '0deg';
  }
}

