import { Component, OnInit } from '@angular/core';
import { EvidenciaService } from '../../services/evidencia.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recursos',
  templateUrl: './recursos.component.html',
  styleUrls: ['./recursos.component.css']
})
export class RecursosComponent implements OnInit {
  activeSection: 'videos' | 'guias' | 'evidencias' = 'videos';
  evidencias: any[] = [];
  loading = false;
  role = '';

  constructor(
    private evidenciaService: EvidenciaService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.role = this.authService.getRole() || '';
    this.loadEvidencias();
  }

  loadEvidencias(): void {
    this.loading = true;
    this.evidenciaService.getEvidencias().subscribe({
      next: (data) => {
        this.evidencias = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  setSection(section: 'videos' | 'guias' | 'evidencias') {
    this.activeSection = section;
    if (section === 'evidencias') {
      this.loadEvidencias();
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  isTeacherOrAdmin(): boolean {
    return this.role === 'administrador' || this.role === 'profesor';
  }
}
