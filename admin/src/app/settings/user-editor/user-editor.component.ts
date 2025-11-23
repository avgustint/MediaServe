import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SettingsService, User, Role } from "../settings.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin } from "rxjs";

@Component({
  selector: "app-user-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent],
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
  
  private searchSubject = new Subject<string>();

  hasEditUsersPermission: boolean = false;

  constructor(
    private settingsService: SettingsService,
    private userService: UserService
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
      this.showErrorPopup("Name, Email, and Username are required.");
      return;
    }

    if (this.isNewUser && !this.userPassword) {
      this.showErrorPopup("Password is required for new users.");
      return;
    }

    const userData: Partial<User> = {
      name: this.userName,
      email: this.userEmail,
      username: this.userUsername,
      role: this.userRole,
      locale: this.userLocale || null
    };

    if (this.userPassword) {
      (userData as any).password = this.userPassword;
    }

    const saveOperation = this.isNewUser
      ? this.settingsService.createUser(userData)
      : this.settingsService.updateUser(this.editingUser!.guid, userData);

    saveOperation.subscribe({
      next: () => {
        this.loadData();
        this.cancelEdit();
      },
      error: (error) => {
        console.error("Error saving user:", error);
        this.showErrorPopup("Error saving user. Please try again.");
      }
    });
  }

  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to delete user "${user.name}"?`)) {
      this.settingsService.deleteUser(user.guid).subscribe({
        next: () => {
          this.loadData();
          if (this.editingUser?.guid === user.guid) {
            this.cancelEdit();
          }
        },
        error: (error) => {
          console.error("Error deleting user:", error);
          this.showErrorPopup("Error deleting user. Please try again.");
        }
      });
    }
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
}

