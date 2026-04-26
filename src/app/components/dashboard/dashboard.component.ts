import { Component, OnInit } from '@angular/core';
import { ProgressService } from '../../services/progress.service';

interface Session {
  number: number;
  title: string;
  subtitle: string;
  duration: string;
  simulations: string;
  lineamientos: string;
  status: 'completed' | 'available' | 'locked';
  route: string;
  simId: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  sessions: Session[] = [
    {
      number: 1,
      title: 'Sesión de Introducción',
      subtitle: 'Justificación pedagógica y contextualización',
      duration: '45 min',
      simulations: 'Video + Foro',
      lineamientos: 'Pensamiento Sistémico',
      status: 'available',
      route: '/laboratorio',
      simId: 0
    },
    {
      number: 2,
      title: 'El Concepto de Sistema',
      subtitle: 'Introducción al pensamiento sistémico',
      duration: '90 min',
      simulations: 'Video + Foro',
      lineamientos: 'Visión de Totalidad',
      status: 'locked',
      route: '/laboratorio',
      simId: 0
    },
    {
      number: 3,
      title: 'Componentes y Causalidad I',
      subtitle: 'Causa-efecto térmico en el ciclo del agua',
      duration: '90 min',
      simulations: 'Sim 1 (Evaporación) + Sim 2 (Condensación)',
      lineamientos: 'Lineamientos 1 y 2',
      status: 'locked',
      route: '/laboratorio',
      simId: 1
    },
    {
      number: 4,
      title: 'Escalas y Representación I',
      subtitle: 'Cuantificar volúmenes y modelar flujos',
      duration: '90 min',
      simulations: 'Sim 3 (Precipitación) + Sim 4 (Infiltración)',
      lineamientos: 'Lineamientos 3 y 4',
      status: 'locked',
      route: '/laboratorio',
      simId: 3
    },
    {
      number: 5,
      title: 'Visión de Totalidad',
      subtitle: 'Conservación, propósito y estabilidad global',
      duration: '120 min',
      simulations: 'Sim 5 (Ciclo Consolidado 3D)',
      lineamientos: 'Lineamientos 5, 6 y 7',
      status: 'locked',
      route: '/laboratorio',
      simId: 5
    },
    {
      number: 6,
      title: 'Transferencia al Agro I',
      subtitle: 'Componentes bióticos y abióticos del cultivo',
      duration: '90 min',
      simulations: 'Sim 6 (Factores del Cultivo)',
      lineamientos: 'Lineamientos 1 y 2',
      status: 'locked',
      route: '/laboratorio',
      simId: 6
    },
    {
      number: 7,
      title: 'Transferencia al Agro II',
      subtitle: 'Escalas productivas y diagramas de influencia',
      duration: '90 min',
      simulations: 'Sim 7 (Escalas Productivas)',
      lineamientos: 'Lineamientos 3 y 4',
      status: 'locked',
      route: '/laboratorio',
      simId: 7
    },
    {
      number: 8,
      title: 'Sostenibilidad y Cierre',
      subtitle: 'Toma de decisiones ante crisis + Postest',
      duration: '120 min',
      simulations: 'Sim 8 (Resiliencia Agrícola) + Postest',
      lineamientos: 'Lineamientos 5, 6 y 7',
      status: 'locked',
      route: '/laboratorio',
      simId: 8
    }
  ];

  constructor(private progressService: ProgressService) {}

  ngOnInit(): void {
    this.loadProgress();
  }

  loadProgress(): void {
    this.progressService.getProgress().subscribe({
      next: (progress) => {
        const completed = progress.completedSimulations || [];
        // Por defecto arranca en la 1
        let currentId = progress.currentSimulationId || 1;
        // Ajuste en caso de que en la base de datos tengan currentSimulationId = 0 guardado
        if (currentId === 0) currentId = 1;

        this.sessions = this.sessions.map(session => {
          if (completed.includes(session.number)) {
            return { ...session, status: 'completed' };
          } else if (session.number === currentId) {
            return { ...session, status: 'available' };
          } else if (session.number < currentId) {
             // Por si acaso algún id anterior no está marcado como completado expresamente
            return { ...session, status: 'completed' };
          } else {
            return { ...session, status: 'locked' };
          }
        });
      },
      error: (err) => console.error('Error loading progress:', err)
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return '✅ Completada';
      case 'available': return '▶️ Disponible';
      case 'locked': return '🔒 Bloqueada';
      default: return '';
    }
  }
}
