import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { TranslationService, SupportedLocale } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translation.pipe';
import { LocationsService, Location } from '../services/locations.service';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TranslatePipe, InputTextModule, PasswordModule, ButtonModule, SelectModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  error: string = '';
  isLoading: boolean = false;
  locations: Location[] = [];
  loadingLocations: boolean = false;
  private autoLoginTimer: any = null;
  private hasInteracted: boolean = false;

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
      return;
    }
    
    // Load locations
    this.loadLocations();
    
    // Setup auto-login if configured
    this.setupAutoLogin();
  }

  ngOnDestroy(): void {
    this.clearAutoLoginTimer();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(): void {
    this.resetAutoLoginTimer();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(): void {
    this.resetAutoLoginTimer();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMousemove(): void {
    this.resetAutoLoginTimer();
  }

  private setupAutoLogin(): void {
    // Check if auto-login is enabled (timeout > 0)
    if (environment.autoLoginTimeout > 0) {
      // Start the auto-login timer only once on page load
      this.startAutoLoginTimer();
    }
  }

  private startAutoLoginTimer(): void {
    this.clearAutoLoginTimer();
    this.hasInteracted = false;
    this.autoLoginTimer = setTimeout(() => {
      // Only perform auto-login if user hasn't interacted
      if (!this.hasInteracted) {
        this.performAutoLogin();
      }
    }, environment.autoLoginTimeout * 1000);
  }

  private resetAutoLoginTimer(): void {
    // Cancel auto-login if user interacts
    if (environment.autoLoginTimeout > 0) {
      this.hasInteracted = true;
      this.clearAutoLoginTimer();
    }
  }

  private clearAutoLoginTimer(): void {
    if (this.autoLoginTimer) {
      clearTimeout(this.autoLoginTimer);
      this.autoLoginTimer = null;
    }
  }

  private performAutoLogin(): void {
    // Check if auto-login is configured
    if (!environment.autoLoginUsername || !environment.autoLoginPassword || !environment.autoLoginLocationId) {
      console.warn('Auto-login is enabled but credentials are not configured');
      return;
    }

    // Clear the timer
    this.clearAutoLoginTimer();

    // Set form values
    this.loginForm.patchValue({
      username: environment.autoLoginUsername,
      password: environment.autoLoginPassword,
      locationId: environment.autoLoginLocationId
    });

    // Perform login
    this.error = '';
    this.isLoading = true;

    this.authService.login(
      environment.autoLoginUsername,
      environment.autoLoginPassword,
      environment.autoLoginLocationId
    ).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response && response.success && response.user) {
          this.userService.setUser(response.user);
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
        console.error('Auto-login error:', error);
        this.error = error.message || this.translationService.translate('loginFailed');
      }
    });
  }

  loadLocations(): void {
    this.loadingLocations = true;
    this.locationsService.getAllLocations().subscribe({
      next: (locations) => {
        this.locations = locations;
        this.loadingLocations = false;
        
        // Auto-select if there's only one location available
        if (this.locations.length === 1) {
          const singleLocation = this.locations[0];
          this.loginForm.patchValue({
            locationId: singleLocation.guid
          });
        }
      },
      error: (error) => {
        console.error('Error loading locations:', error);
        this.error = this.translationService.translate('errorLoadingLocations');
        this.loadingLocations = false;
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    // Clear auto-login timer when user manually submits
    this.clearAutoLoginTimer();
    this.hasInteracted = true;

    this.error = '';
    this.isLoading = true;
    
    const { username, password, locationId } = this.loginForm.value;
    
    this.authService.login(username, password, locationId).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response && response.success && response.user) {
          this.userService.setUser(response.user);
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

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  get f() {
    return this.loginForm.controls as { [key: string]: any };
  }
}