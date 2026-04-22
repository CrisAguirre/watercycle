import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Si ya está logueado, redirigir al dashboard
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }

    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.errorMessage = '';
      const { email, password } = this.loginForm.value;
      
      this.authService.login({ email, password }).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (err: any) => {
          this.errorMessage = err.error?.message || 'Error al iniciar sesión. Verifique sus credenciales.';
        }
      });
    } else {
      this.errorMessage = 'Por favor, complete todos los campos requeridos.';
      this.loginForm.markAllAsTouched();
    }
  }
}
