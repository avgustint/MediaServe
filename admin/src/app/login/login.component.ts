import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { UserService } from '../user.service';
import { TranslationService, SupportedLocale } from '../translation.service';
import { TranslatePipe } from '../translation.pipe';
import { LocationsService, Location } from '../locations.service';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslatePipe, InputTextModule, PasswordModule, ButtonModule, SelectModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  error: string = '';
  isLoading: boolean = false;
  locations: Location[] = [];
  loadingLocations: boolean = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private translationService: TranslationService,
    private locationsService: LocationsService,
    private fb: FormBuilder
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(3)]],
      locationId: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Redirect to playlist if already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/playlist']);
    }
    
    // Load locations
    this.loadLocations();
  }

  loadLocations(): void {
    this.loadingLocations = true;
    this.locationsService.getAllLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
        this.loadingLocations = false;
      },
      error: (error) => {
        console.error('Error loading locations:', error);
        this.error = this.translationService.translate('errorLoadingLocations') || 'Error loading locations';
        this.loadingLocations = false;
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.error = '';
    this.isLoading = true;
    
    const { username, password, locationId } = this.loginForm.value;
    
    // Send plain password - server will hash it with bcrypt
    this.authService.login(username, password, locationId).subscribe({
      next: (response) => {
        this.isLoading = false;
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
        this.isLoading = false;
        console.error('Login error:', error);
        this.error = error.message || this.translationService.translate('loginFailed');
      }
    });
  }

  /**
   * Mark all form fields as touched to show validation errors
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Get form control for template access
   */
  get f() {
    return this.loginForm.controls as { [key: string]: any };
  }
}


