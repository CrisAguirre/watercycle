import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';

  constructor(private fb: FormBuilder, private router: Router) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      if (email === 'ciclodelagua@mail.com' && password === '1234567') {
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage = 'Credenciales inválidas. Por favor intente de nuevo.';
      }
    } else {
      this.errorMessage = 'Por favor, complete todos los campos requeridos.';
      this.loginForm.markAllAsTouched();
    }
  }
}
