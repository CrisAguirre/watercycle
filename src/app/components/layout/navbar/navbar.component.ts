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

  logout() {
    this.authService.logout();
  }
}
