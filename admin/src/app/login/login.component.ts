import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { UserService } from '../user.service';
import { TranslationService, SupportedLocale } from '../translation.service';
import { TranslatePipe } from '../translation.pipe';
import * as CryptoJS from 'crypto-js';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  username: string = '';
  password: string = '';
  error: string = '';

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Redirect to playlist if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/playlist']);
    }
  }

  onSubmit(): void {
    this.error = '';
    
    // Hash password with MD5 before sending
    const hashedPassword = CryptoJS.MD5(this.password).toString();
    
    this.authService.login(this.username, hashedPassword).subscribe({
      next: (response) => {
        if (response && response.success && response.user) {
          // Store user data and permissions
          this.userService.setUser(response.user);
          // Set locale from user preferences
          if (response.user.locale) {
            this.translationService.setLocale(response.user.locale as SupportedLocale);
          }
          this.router.navigate(['/playlist']);
        } else {
          this.error = this.translationService.translate('invalidCredentials');
        }
      },
      error: (error) => {
        console.error('Login error:', error);
        this.error = this.translationService.translate('loginFailed');
      }
    });
  }
}

