import { Component } from '@angular/core';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent {
  constructor(private authService: AuthService) { }

  isAdminOrProfesor(): boolean {
    const role = this.authService.getRole();
    return role === 'administrador' || role === 'profesor';
  }

  isStudentOrAdmin(): boolean {
    const role = this.authService.getRole();
    return role === 'estudiante' || role === 'administrador';
  }

  getResultadosLabel(): string {
    const role = this.authService.getRole();
    return role === 'estudiante' ? 'Mis Resultados' : 'Resultados';
  }

  logout() {
    this.authService.logout();
  }
}
