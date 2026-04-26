import { Component, OnInit } from '@angular/core';
import { ExamService } from '../../../services/exam.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-results',
  templateUrl: './results.component.html',
  styleUrls: ['./results.component.css']
})
export class ResultsComponent implements OnInit {
  results: any[] = [];
  loading = true;
  errorMessage = '';
  role = '';

  constructor(
    private examService: ExamService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.role = this.authService.getRole() || '';
    this.loadResults();
  }

  loadResults(): void {
    const request = this.role === 'estudiante' 
      ? this.examService.getUserExams() 
      : this.examService.getAllResults();

    request.subscribe({
      next: (data) => {
        this.results = data;
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar los resultados. Intente nuevamente.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  getScoreClass(score: number): string {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-mid';
    return 'score-low';
  }
}
