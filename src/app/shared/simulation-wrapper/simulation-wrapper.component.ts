import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-simulation-wrapper',
  templateUrl: './simulation-wrapper.component.html',
  styleUrls: ['./simulation-wrapper.component.css']
})
export class SimulationWrapperComponent {
  @Input() simTitle: string = '';
  @Input() simDescription: string = '';
  @Input() simNumber: number = 0;
  @Input() lineamientos: string = '';
  @Input() bloque: 'agua' | 'agro' = 'agua';

  activeTab: 'actividad' | 'simulador' | 'evaluacion' = 'simulador';

  setTab(tab: 'actividad' | 'simulador' | 'evaluacion') {
    this.activeTab = tab;
  }
}
