import { Component, Input, OnInit } from '@angular/core';
import { ProgressService } from '../../services/progress.service';

@Component({
  selector: 'app-simulation-wrapper',
  templateUrl: './simulation-wrapper.component.html',
  styleUrls: ['./simulation-wrapper.component.css']
})
export class SimulationWrapperComponent implements OnInit {
  @Input() simTitle: string = '';
  @Input() simDescription: string = '';
  @Input() simNumber: number = 0;
  @Input() lineamientos: string = '';
  @Input() bloque: 'agua' | 'agro' = 'agua';

  activeTab: 'actividad' | 'simulador' | 'evaluacion' = 'simulador';
  evalLocked: boolean = false;

  constructor(private progressService: ProgressService) {}

  ngOnInit() {
    this.progressService.getProgress().subscribe(progress => {
      const currentId = progress.currentSimulationId ?? 0;
      const completed = progress.completedSimulations || [];
      if (this.simNumber > currentId && !completed.includes(this.simNumber)) {
        this.evalLocked = true;
      }
    });
  }

  setTab(tab: 'actividad' | 'simulador' | 'evaluacion') {
    if (tab === 'evaluacion' && this.evalLocked) {
      alert('Debes completar las sesiones anteriores en "Mis Sesiones" para desbloquear esta evaluación.');
      return;
    }
    this.activeTab = tab;
  }
}
