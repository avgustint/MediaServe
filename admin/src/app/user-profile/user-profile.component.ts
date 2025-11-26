import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { UserService, User } from "../user.service";
import { AuthService } from "../auth.service";
import { SettingsService } from "../settings/settings.service";
import { LocationsService, Location } from "../locations.service";
import { ErrorPopupComponent } from "../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../shared/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../translation.pipe";
import { TranslationService } from "../translation.service";
import { HttpErrorResponse } from "@angular/common/http";
import { InputTextModule } from "primeng/inputtext";
import { PasswordModule } from "primeng/password";
import { SelectModule } from "primeng/select";

@Component({
  selector: "app-user-profile",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe, InputTextModule, PasswordModule, SelectModule],
  templateUrl: "./user-profile.component.html",
  styleUrls: ["./user-profile.component.scss"]
})
export class UserProfileComponent implements OnInit {
  user: User | null = null;
  
  // For PrimeNG Dropdown
  localeOptions: Array<{ label: string; value: string | null }> = [];
  locations: Location[] = [];
  loadingLocations: boolean = false;
  
  // Edit mode
  isEditing: boolean = false;
  editName: string = "";
  editEmail: string = "";
  editLocale: string | null = null;
  editLocationId: number | null = null;
  
  // Password change
  showPasswordChange: boolean = false;
  currentPassword: string = "";
  newPassword: string = "";
  confirmPassword: string = "";
  
  // Error popup
  showError: boolean = false;
  errorMessage: string = "";
  
  // Logout confirmation dialog
  showLogoutConfirmDialog: boolean = false;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private settingsService: SettingsService,
    private translationService: TranslationService,
    private locationsService: LocationsService
  ) {}

  ngOnInit(): void {
    // Initialize locale options with translations
    this.localeOptions = [
      { label: this.translationService.translate('noLocale'), value: null },
      { label: this.translationService.translate('slovenian'), value: 'sl-SI' },
      { label: this.translationService.translate('ukEnglish'), value: 'en-GB' },
      { label: this.translationService.translate('italian'), value: 'it-IT' }
    ];
    this.loadLocations();
    this.loadUserData();
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
        this.loadingLocations = false;
      }
    });
  }

  loadUserData(): void {
    this.user = this.userService.getUser();
    if (this.user) {
      this.editName = this.user.name;
      this.editEmail = this.user.email;
      this.editLocale = this.user.locale || null;
      this.editLocationId = this.user.locationId || null;
    }
  }

  startEdit(): void {
    this.isEditing = true;
    this.showPasswordChange = false;
  }

  cancelEdit(): void {
    this.isEditing = false;
    if (this.user) {
      this.editName = this.user.name;
      this.editEmail = this.user.email;
      this.editLocale = this.user.locale || null;
      this.editLocationId = this.user.locationId || null;
    }
  }

  saveProfile(): void {
    if (!this.user) {
      return;
    }

    if (!this.editName || !this.editEmail) {
      this.showErrorPopup(this.translationService.translate('nameRequired'));
      return;
    }

    // Validate email format
    if (!this.isValidEmail(this.editEmail)) {
      this.showErrorPopup(this.translationService.translate('invalidEmail'));
      return;
    }

    // Encode email in base64
    const encodedEmail = btoa(unescape(encodeURIComponent(this.editEmail)));

    const userData: Partial<import("../settings/settings.service").User> = {
      name: this.editName,
      email: encodedEmail,
      role: this.user.role?.guid ?? null,
      locale: this.editLocale
    };

    this.settingsService.updateUser(this.user.guid, userData).subscribe({
      next: (updatedUser) => {
        // Update local user data
        const currentUser = this.userService.getUser();
        if (currentUser) {
          // Get the selected location object
          const selectedLocation = this.editLocationId 
            ? this.locations.find(loc => loc.guid === this.editLocationId)
            : null;
          
          const updatedUserData: User = {
            ...currentUser,
            name: updatedUser.name,
            email: updatedUser.email,
            locale: updatedUser.locale || null,
            locationId: this.editLocationId || undefined,
            location: selectedLocation || undefined
          };
          this.userService.setUser(updatedUserData);
          this.user = updatedUserData;
          
          // Update translation locale if changed
          if (updatedUser.locale && this.translationService.getCurrentLocale() !== updatedUser.locale) {
            this.translationService.setLocale(updatedUser.locale as import("../translation.service").SupportedLocale);
          }
        }
        this.isEditing = false;
      },
      error: (error: HttpErrorResponse) => {
        console.error("Error updating profile:", error);
        const errorMessage = error.error?.message || this.translationService.translate('errorSavingUser');
        this.showErrorPopup(errorMessage);
      }
    });
  }

  togglePasswordChange(): void {
    this.showPasswordChange = !this.showPasswordChange;
    if (this.showPasswordChange) {
      this.isEditing = false;
    }
    this.currentPassword = "";
    this.newPassword = "";
    this.confirmPassword = "";
  }

  changePassword(): void {
    if (!this.user) {
      return;
    }

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.showErrorPopup(this.translationService.translate('passwordRequired'));
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.showErrorPopup(this.translationService.translate('passwordsDoNotMatch'));
      return;
    }

    if (this.newPassword.length < 6) {
      this.showErrorPopup(this.translationService.translate('passwordTooShort'));
      return;
    }

    // Send plain passwords - server will hash new password with bcrypt and verify current password
    const userData: any = {
      currentPassword: this.currentPassword,
      password: this.newPassword
    };

    this.settingsService.updateUser(this.user!.guid, userData).subscribe({
      next: () => {
        this.showPasswordChange = false;
        this.currentPassword = "";
        this.newPassword = "";
        this.confirmPassword = "";
      },
      error: (error: HttpErrorResponse) => {
        console.error("Error changing password:", error);
        const errorMessage = error.error?.message || this.translationService.translate('errorChangingPassword');
        this.showErrorPopup(errorMessage);
      }
    });
  }

  logout(): void {
    this.showLogoutConfirmDialog = true;
  }

  onConfirmLogout(): void {
    this.userService.clearUser();
    this.authService.logout();
    this.closeLogoutConfirmDialog();
  }

  closeLogoutConfirmDialog(): void {
    this.showLogoutConfirmDialog = false;
  }

  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }

  isValidEmail(email: string): boolean {
    if (!email || email.trim().length === 0) {
      return false;
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email.trim());
  }

  getRoleName(): string {
    if (!this.user || !this.user.role) {
      return this.translationService.translate('noRole');
    }
    return this.user.role.name;
  }
}

