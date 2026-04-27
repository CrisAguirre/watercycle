import { Component, Input, OnInit } from '@angular/core';
import { ProgressService } from '../../services/progress.service';
import { EvidenciaService } from '../../services/evidencia.service';
import { ExamService } from '../../services/exam.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-simulation-wrapper',
  templateUrl: './simulation-wrapper.component.html',
  styleUrls: ['./simulation-wrapper.component.css']
})
export class SimulationWrapperComponent implements OnInit {
  @Input() simTitle: string = '';
  @Input() simDescription: string = '';
  @Input() simNumber: number = 0; // 1:Evaporación, 2:Condensación, etc.
  @Input() lineamientos: string = '';
  @Input() bloque: 'agua' | 'agro' = 'agua';

  activeTab: 'actividad' | 'simulador' | 'evaluacion' = 'simulador';
  evalLocked: boolean = false;

  constructor(
    private progressService: ProgressService,
    private evidenciaService: EvidenciaService,
    private examService: ExamService
  ) {}

  ngOnInit() {
    this.checkPrerequisites();
  }

  checkPrerequisites() {
    // Obtenemos evidencias y exámenes del usuario
    forkJoin({
      evidencias: this.evidenciaService.getEvidencias(),
      exams: this.examService.getUserExams()
    }).subscribe(({ evidencias, exams }) => {
      
      const introCompleted = 
        evidencias.some(e => e.titulo.includes('Lluvia de Ideas')) && 
        evidencias.some(e => e.titulo.includes('Síntesis Final'));

      const hasExam = (name: string) => exams.some(e => e.examName === name);

      // Lógica Secuencial de Bloqueo de Evaluación
      if (this.simNumber === 1 || this.simNumber === 2) {
        // Sesión 2 (Evaporación/Condensación) -> Requiere Sesión 1 (Intro)
        if (!introCompleted) this.evalLocked = true;
      } 
      else if (this.simNumber === 3 || this.simNumber === 4) {
        // Sesión 3 (Precipitación/Infiltración) -> Requiere Evaluación Sesión 2
        if (!hasExam('evaporacion') && !hasExam('condensacion')) this.evalLocked = true;
      }
      else if (this.simNumber === 5) {
        // Sesión 4 (Ciclo Consolidado) -> Requiere Evaluación Sesión 3
        if (!hasExam('precipitacion') && !hasExam('infiltracion')) this.evalLocked = true;
      }
      else if (this.simNumber === 6) {
        // Sesión 5 (Factores Cultivo) -> Requiere Evaluación Sesión 4
        if (!hasExam('ciclo-consolidado')) this.evalLocked = true;
      }
      else if (this.simNumber === 7) {
        // Sesión 6 (Escalas Productivas) -> Requiere Evaluación Sesión 5
        if (!hasExam('factores-cultivo')) this.evalLocked = true;
      }
      else if (this.simNumber === 8) {
        // Sesión 7 (Resiliencia Agrícola) -> Requiere Evaluación Sesión 6
        if (!hasExam('escalas-productivas')) this.evalLocked = true;
      }
    });
  }

  setTab(tab: 'actividad' | 'simulador' | 'evaluacion') {
    if (tab === 'evaluacion' && this.evalLocked) {
      alert('🔒 Esta evaluación está bloqueada. Debes completar las actividades y evaluaciones de las sesiones anteriores para desbloquearla.');
      return;
    }
    this.activeTab = tab;
  }
}
