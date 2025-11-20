import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  error: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Redirect to playlist if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/playlist']);
    }
  }

  onSubmit(): void {
    this.error = '';
    this.authService.login(this.username, this.password).subscribe({
      next: (success) => {
        if (success) {
          this.router.navigate(['/playlist']);
        } else {
          this.error = 'Invalid username or password';
        }
      },
      error: (error) => {
        console.error('Login error:', error);
        this.error = 'Login failed. Please try again.';
      }
    });
  }
}

