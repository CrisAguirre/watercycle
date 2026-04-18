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

  constructor(public simService: SimulationService) { }

  ngOnInit(): void {
    this.variables$ = this.simService.variables$;
    this.rates$ = this.simService.rates$;

    this.rates$.subscribe(rates => {
      this.updateParticles(rates);
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

    // Rain: Ocurre sobre la cordillera (55 a 90%)
    const rainCount = Math.floor(rates.precipitationRate * 1.5); // más gotas para realismo
    this.rainDropParticles = Array(rainCount).fill(0).map((_, i) => ({
      left: 55 + Math.random() * 35 + '%',
      duration: 0.5 + Math.random() * 0.4 + 's',
      delay: Math.random() * 1 + 's'
    }));

    // Escorrentía: montañas
    const runoffCount = Math.floor(rates.precipitationRate / 1.5);
    this.runoffParticles = Array(runoffCount).fill(0).map((_, i) => ({
      duration: 3 + Math.random() * 3 + 's',
      delay: Math.random() * 3 + 's'
    }));
  }

  onVarChange(event: Event, key: string) {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    this.simService.updateVariable(key as keyof SystemVariables, Number(el.value));
  }
}
