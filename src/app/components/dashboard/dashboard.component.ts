import { Component } from '@angular/core';

interface Session {
  number: number;
  title: string;
  subtitle: string;
  duration: string;
  simulations: string;
  lineamientos: string;
  status: 'completed' | 'available' | 'locked';
  route: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  sessions: Session[] = [
    {
      number: 1,
      title: 'El Concepto de Sistema',
      subtitle: 'Introducción al pensamiento sistémico',
      duration: '90 min',
      simulations: 'Video + Foro',
      lineamientos: 'Visión de Totalidad',
      status: 'available',
      route: '/laboratorio'
    },
    {
      number: 2,
      title: 'Componentes y Causalidad I',
      subtitle: 'Causa-efecto térmico en el ciclo del agua',
      duration: '90 min',
      simulations: 'Sim 1 (Evaporación) + Sim 2 (Condensación)',
      lineamientos: 'Lineamientos 1 y 2',
      status: 'locked',
      route: '/laboratorio/evaporacion'
    },
    {
      number: 3,
      title: 'Escalas y Representación I',
      subtitle: 'Cuantificar volúmenes y modelar flujos',
      duration: '90 min',
      simulations: 'Sim 3 (Precipitación) + Sim 4 (Infiltración)',
      lineamientos: 'Lineamientos 3 y 4',
      status: 'locked',
      route: '/laboratorio/precipitacion'
    },
    {
      number: 4,
      title: 'Visión de Totalidad',
      subtitle: 'Conservación, propósito y estabilidad global',
      duration: '120 min',
      simulations: 'Sim 5 (Ciclo Consolidado 3D)',
      lineamientos: 'Lineamientos 5, 6 y 7',
      status: 'locked',
      route: '/laboratorio/ciclo-consolidado'
    },
    {
      number: 5,
      title: 'Transferencia al Agro I',
      subtitle: 'Componentes bióticos y abióticos del cultivo',
      duration: '90 min',
      simulations: 'Sim 6 (Factores del Cultivo)',
      lineamientos: 'Lineamientos 1 y 2',
      status: 'locked',
      route: '/laboratorio/factores-cultivo'
    },
    {
      number: 6,
      title: 'Transferencia al Agro II',
      subtitle: 'Escalas productivas y diagramas de influencia',
      duration: '90 min',
      simulations: 'Sim 7 (Escalas Productivas)',
      lineamientos: 'Lineamientos 3 y 4',
      status: 'locked',
      route: '/laboratorio/escalas-productivas'
    },
    {
      number: 7,
      title: 'Sostenibilidad y Cierre',
      subtitle: 'Toma de decisiones ante crisis + Postest',
      duration: '120 min',
      simulations: 'Sim 8 (Resiliencia Agrícola) + Postest',
      lineamientos: 'Lineamientos 5, 6 y 7',
      status: 'locked',
      route: '/laboratorio/resiliencia-agricola'
    }
  ];

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return '✅ Completada';
      case 'available': return '▶️ Disponible';
      case 'locked': return '🔒 Bloqueada';
      default: return '';
    }
  }
}
