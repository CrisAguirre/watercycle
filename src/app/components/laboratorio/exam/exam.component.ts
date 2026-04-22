import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExamService, Question, ExamData } from '../../../services/exam.service';

@Component({
  selector: 'app-exam',
  templateUrl: './exam.component.html',
  styleUrls: ['./exam.component.css']
})
export class ExamComponent implements OnInit, OnDestroy {
  examName: string = '';
  examData: ExamData | null = null;
  
  // State
  state: 'loading' | 'instructions' | 'playing' | 'submitting' | 'result' | 'error' = 'loading';
  errorMessage: string = '';
  
  // Progress
  currentQuestionIndex: number = 0;
  answers: { [key: string]: string[] } = {};
  
  // Timer
  timeLeft: number = 0;
  timerInterval: any;
  
  // Anti-cheat
  warnings: number = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private examService: ExamService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.examName = params.get('id') || '';
      this.checkAttemptsAndLoad();
    });
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  @HostListener('window:blur', ['$event'])
  onBlur(event: any): void {
    if (this.state === 'playing') {
      this.warnings++;
      alert(`¡ADVERTENCIA! Has salido de la pestaña de la evaluación. Regresa de inmediato. Advertencia ${this.warnings}/2`);
      if (this.warnings >= 2) {
        alert('Se ha excedido el límite de advertencias. La evaluación será enviada automáticamente.');
        this.submitExam();
      }
    }
  }

  checkAttemptsAndLoad(): void {
    this.examService.getUserExams().subscribe({
      next: (exams: any[]) => {
        const attempts = exams.filter((e: any) => e.examName === this.examName).length;
        if (attempts >= 2) {
          this.state = 'error';
          this.errorMessage = 'Has alcanzado el límite máximo de 2 intentos para esta evaluación.';
        } else {
          this.loadExamData();
        }
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = 'Error al verificar intentos previos.';
      }
    });
  }

  loadExamData(): void {
    this.examService.getExamQuestions(this.examName).subscribe({
      next: (data: ExamData) => {
        this.examData = data;
        this.state = 'instructions';
      },
      error: () => {
        this.state = 'error';
        this.errorMessage = 'No se pudo cargar la evaluación. Es posible que aún no esté disponible.';
      }
    });
  }

  startExam(): void {
    this.state = 'playing';
    this.currentQuestionIndex = 0;
    this.startQuestionTimer();
  }

  get currentQuestion(): Question {
    return this.examData!.questions[this.currentQuestionIndex];
  }

  startQuestionTimer(): void {
    this.clearTimer();
    this.timeLeft = this.currentQuestion.timeLimit;
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.nextQuestion();
      }
    }, 1000);
  }

  clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  toggleOption(option: string): void {
    const qId = this.currentQuestion.id;
    if (!this.answers[qId]) {
      this.answers[qId] = [];
    }

    if (this.currentQuestion.subtype === 'single') {
      this.answers[qId] = [option];
    } else {
      const idx = this.answers[qId].indexOf(option);
      if (idx > -1) {
        this.answers[qId].splice(idx, 1);
      } else {
        // Limit to 2 for double answers
        if (this.answers[qId].length < 2) {
          this.answers[qId].push(option);
        }
      }
    }
  }

  isOptionSelected(option: string): boolean {
    const qId = this.currentQuestion.id;
    return this.answers[qId] ? this.answers[qId].includes(option) : false;
  }

  nextQuestion(): void {
    // If no answer, empty array
    if (!this.answers[this.currentQuestion.id]) {
      this.answers[this.currentQuestion.id] = [];
    }

    if (this.currentQuestionIndex < this.examData!.questions.length - 1) {
      this.currentQuestionIndex++;
      this.startQuestionTimer();
    } else {
      this.submitExam();
    }
  }

  submitExam(): void {
    this.clearTimer();
    this.state = 'submitting';

    // Calculate score
    let correctCount = 0;
    const formattedAnswers = [];

    for (const q of this.examData!.questions) {
      const userAns = this.answers[q.id] || [];
      const correctAns = q.correctAnswers;
      
      let isCorrect = false;
      if (userAns.length === correctAns.length && userAns.every(val => correctAns.includes(val))) {
        isCorrect = true;
        correctCount++;
      }

      formattedAnswers.push({
        questionId: q.id,
        providedAnswer: userAns,
        isCorrect
      });
    }

    // Puntuación sobre 100
    const finalScore = Math.round((correctCount / this.examData!.questions.length) * 100);

    const submission = {
      examName: this.examName,
      score: finalScore,
      answers: formattedAnswers
    };

    this.examService.submitExam(submission).subscribe({
      next: () => {
        this.state = 'result';
        this.errorMessage = `Tu puntaje final es: ${finalScore}/100`;
      },
      error: (err: any) => {
        this.state = 'error';
        this.errorMessage = err.error?.message || 'Error al enviar la evaluación.';
      }
    });
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
  }
}
