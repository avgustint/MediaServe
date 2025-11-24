import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SettingsService, User, Role } from "../settings.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../../translation.pipe";
import { TranslationService } from "../../translation.service";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin } from "rxjs";
import * as CryptoJS from "crypto-js";
import { HttpErrorResponse } from "@angular/common/http";

@Component({
  selector: "app-user-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe],
  templateUrl: "./user-editor.component.html",
  styleUrls: ["./user-editor.component.scss"]
})
export class UserEditorComponent implements OnInit {
  searchTerm: string = "";
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  roles: Role[] = [];
  
  editingUser: User | null = null;
  isNewUser: boolean = false;

  // Form fields
  userName: string = "";
  userEmail: string = "";
  userUsername: string = "";
  userPassword: string = "";
  userRole: number | null = null;
  userLocale: string | null = null;

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  userToDeleteGuid: number | null = null;
  
  private searchSubject = new Subject<string>();

  hasEditUsersPermission: boolean = false;

  constructor(
    private settingsService: SettingsService,
    public userService: UserService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.hasEditUsersPermission = this.userService.hasPermission("EditUsers");
    this.loadData();
    
    // Setup search with debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        return of(this.filterUsers(searchTerm));
      })
    ).subscribe({
      next: (filtered) => {
        this.filteredUsers = filtered;
      }
    });
  }

  loadData(): void {
    forkJoin({
      users: this.settingsService.getAllUsers(),
      roles: this.settingsService.getAllRoles()
    }).subscribe({
      next: ({ users, roles }) => {
        this.allUsers = users;
        this.roles = roles;
        this.filteredUsers = users;
      },
      error: (error) => {
        console.error("Error loading data:", error);
        this.showErrorPopup("Error loading data. Please try again.");
      }
    });
  }

  filterUsers(searchTerm: string): User[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.allUsers;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const terms = term.split(/\s+/).filter(t => t.length > 0);
    
    return this.allUsers.filter(user => {
      const nameMatch = terms.every(t => user.name.toLowerCase().includes(t));
      const emailMatch = terms.every(t => user.email.toLowerCase().includes(t));
      const usernameMatch = terms.every(t => user.username.toLowerCase().includes(t));
      return nameMatch || emailMatch || usernameMatch;
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.searchSubject.next("");
  }

  selectUser(user: User): void {
    if (!this.canModifyUser(user)) {
      return;
    }
    this.isNewUser = false;
    this.editingUser = { ...user };
    this.userName = user.name;
    this.userEmail = user.email;
    this.userUsername = user.username;
    this.userPassword = "";
    this.userRole = user.role;
    this.userLocale = user.locale;
  }

  addNewUser(): void {
    this.isNewUser = true;
    this.editingUser = null;
    this.userName = "";
    this.userEmail = "";
    this.userUsername = "";
    this.userPassword = "";
    this.userRole = null;
    this.userLocale = null;
  }

  cancelEdit(): void {
    this.editingUser = null;
    this.isNewUser = false;
    this.userName = "";
    this.userEmail = "";
    this.userUsername = "";
    this.userPassword = "";
    this.userRole = null;
    this.userLocale = null;
  }

  saveUser(): void {
    if (!this.userName || !this.userEmail || !this.userUsername) {
      this.showErrorPopup(this.translationService.translate('nameAndEmailAndUsernameRequired'));
      return;
    }

    // Validate email format
    if (!this.isValidEmail(this.userEmail)) {
      this.showErrorPopup(this.translationService.translate('invalidEmail'));
      return;
    }

    if (!this.userRole) {
      this.showErrorPopup(this.translationService.translate('roleRequired'));
      return;
    }

    if (!this.userLocale) {
      this.showErrorPopup(this.translationService.translate('localeRequired'));
      return;
    }

    if (this.isNewUser && !this.userPassword) {
      this.showErrorPopup(this.translationService.translate('passwordRequired'));
      return;
    }

    // Check if trying to modify administrator role without permission
    if (!this.isNewUser && this.editingUser) {
      const currentUser = this.userService.getUser();
      const currentIsAdmin = this.isAdministrator(currentUser);
      const targetIsAdmin = this.isUserAdministrator(this.editingUser);
      const newRole = this.roles.find(r => r.guid === this.userRole);
      const wouldBeAdmin = newRole && newRole.name && newRole.name.toLowerCase() === 'administrator';

      // Check if trying to set/remove administrator role
      if ((targetIsAdmin || wouldBeAdmin) && !currentIsAdmin) {
        this.showErrorPopup(this.translationService.translate('cannotModifyAdminRole'));
        return;
      }
    }

    // Encode email in base64
    const encodedEmail = btoa(unescape(encodeURIComponent(this.userEmail)));

    const userData: Partial<User> = {
      name: this.userName,
      email: encodedEmail,
      username: this.userUsername,
      role: this.userRole,
      locale: this.userLocale
    };

    // Encode password in MD5 if provided
    if (this.userPassword) {
      const md5Password = CryptoJS.MD5(this.userPassword).toString();
      (userData as any).password = md5Password;
    }

    const saveOperation = this.isNewUser
      ? this.settingsService.createUser(userData)
      : this.settingsService.updateUser(this.editingUser!.guid, userData);

    saveOperation.subscribe({
      next: () => {
        this.loadData();
        this.cancelEdit();
      },
      error: (error: HttpErrorResponse) => {
        console.error("Error saving user:", error);
        const errorMessage = error.error?.message || this.translationService.translate('errorSavingUser');
        this.showErrorPopup(errorMessage);
      }
    });
  }

  deleteUser(user: User): void {
    // Check if trying to delete administrator without permission
    const currentUser = this.userService.getUser();
    const currentIsAdmin = this.isAdministrator(currentUser);
    const targetIsAdmin = this.isUserAdministrator(user);

    if (targetIsAdmin && !currentIsAdmin) {
      this.showErrorPopup(this.translationService.translate('cannotDeleteAdmin'));
      return;
    }

    // Show confirmation dialog
    this.userToDeleteGuid = user.guid;
    this.confirmDialogTitle = this.translationService.translate('deleteUser');
    this.confirmDialogMessage = `${this.translationService.translate('deleteUserConfirm')} "${user.name}"? ${this.translationService.translate('thisActionCannotBeUndone')}`;
    this.showConfirmDialog = true;
  }

  onConfirmDelete(): void {
    if (this.userToDeleteGuid === null) {
      return;
    }

    const guidToDelete = this.userToDeleteGuid;
    this.settingsService.deleteUser(guidToDelete).subscribe({
      next: () => {
        this.loadData();
        if (this.editingUser?.guid === guidToDelete) {
          this.cancelEdit();
        }
        this.closeConfirmDialog();
      },
      error: (error: HttpErrorResponse) => {
        console.error("Error deleting user:", error);
        const errorMessage = error.error?.message || "Error deleting user. Please try again.";
        this.showErrorPopup(errorMessage);
        this.closeConfirmDialog();
      }
    });
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.userToDeleteGuid = null;
    this.confirmDialogTitle = "";
    this.confirmDialogMessage = "";
  }

  getRoleName(roleGuid: number | null): string {
    if (!roleGuid) return "No Role";
    const role = this.roles.find(r => r.guid === roleGuid);
    return role ? role.name : "Unknown Role";
  }

  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }

  isAdministrator(user: any): boolean {
    if (!user || !user.role || !user.role.name) {
      return false;
    }
    return user.role.name.toLowerCase() === 'administrator';
  }

  isUserAdministrator(user: User): boolean {
    if (!user || !user.role) {
      return false;
    }
    const role = this.roles.find(r => r.guid === user.role);
    if (!role || !role.name) {
      return false;
    }
    return role.name.toLowerCase() === 'administrator';
  }

  canModifyUser(user: User): boolean {
    if (!this.hasEditUsersPermission) {
      return false;
    }
    const currentUser = this.userService.getUser();
    const currentIsAdmin = this.isAdministrator(currentUser);
    const targetIsAdmin = this.isUserAdministrator(user);
    
    // Only administrators can modify administrators
    if (targetIsAdmin && !currentIsAdmin) {
      return false;
    }
    return true;
  }

  isRoleDisabled(): boolean {
    if (!this.hasEditUsersPermission) {
      return true;
    }
    if (this.isNewUser) {
      return false;
    }
    if (!this.editingUser) {
      return false;
    }
    const currentUser = this.userService.getUser();
    if (!currentUser) {
      return true;
    }
    const targetIsAdmin = this.isUserAdministrator(this.editingUser);
    const currentIsAdmin = this.isAdministrator(currentUser);
    
    // Disable role dropdown if editing an administrator and current user is not an administrator
    return targetIsAdmin && !currentIsAdmin;
  }

  isValidEmail(email: string): boolean {
    if (!email || email.trim().length === 0) {
      return false;
    }
    // RFC 5322 compliant email regex (simplified version)
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email.trim());
  }
}

