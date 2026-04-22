import { Component, OnInit } from '@angular/core';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-users-list',
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.css']
})
export class UsersListComponent implements OnInit {
  users: any[] = [];
  loading = true;
  errorMessage = '';
  role = '';

  constructor(
    private userService: UserService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.role = this.authService.getRole() || '';
    if (this.role === 'estudiante') {
      this.errorMessage = 'No tienes permiso para ver esta sección.';
      this.loading = false;
      return;
    }
    
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err: any) => {
        this.errorMessage = 'Error al cargar los usuarios.';
        this.loading = false;
      }
    });
  }
}
