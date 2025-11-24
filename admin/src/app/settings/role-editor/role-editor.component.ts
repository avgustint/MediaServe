import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SettingsService, Role } from "../settings.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { ConfirmDialogComponent } from "../../shared/confirm-dialog/confirm-dialog.component";
import { TranslatePipe } from "../../translation.pipe";
import { TranslationService } from "../../translation.service";
import { debounceTime, distinctUntilChanged, Subject, switchMap, of, forkJoin } from "rxjs";

@Component({
  selector: "app-role-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, ConfirmDialogComponent, TranslatePipe],
  templateUrl: "./role-editor.component.html",
  styleUrls: ["./role-editor.component.scss"]
})
export class RoleEditorComponent implements OnInit {
  searchTerm: string = "";
  allRoles: Role[] = [];
  filteredRoles: Role[] = [];
  
  editingRole: Role | null = null;
  isNewRole: boolean = false;

  // Form fields
  roleName: string = "";

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  // Confirm dialog
  showConfirmDialog: boolean = false;
  confirmDialogTitle: string = "";
  confirmDialogMessage: string = "";
  roleToDeleteGuid: number | null = null;
  
  private searchSubject = new Subject<string>();

  hasEditRolesPermission: boolean = false;

  constructor(
    private settingsService: SettingsService,
    public userService: UserService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.hasEditRolesPermission = this.userService.hasPermission("EditRoles");
    this.loadData();
    
    // Setup search with debounce
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        return of(this.filterRoles(searchTerm));
      })
    ).subscribe({
      next: (filtered) => {
        this.filteredRoles = filtered;
      }
    });
  }

  loadData(): void {
    this.settingsService.getAllRoles().subscribe({
      next: (roles) => {
        this.allRoles = roles;
        this.filteredRoles = roles;
      },
      error: (error) => {
        console.error("Error loading roles:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
      }
    });
  }

  filterRoles(searchTerm: string): Role[] {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.allRoles;
    }
    
    const term = searchTerm.toLowerCase().trim();
    return this.allRoles.filter(role => 
      role.name.toLowerCase().includes(term)
    );
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.filteredRoles = this.allRoles;
  }

  editRole(role: Role): void {
    if (!this.hasEditRolesPermission) {
      return;
    }

    this.editingRole = role;
    this.isNewRole = false;
    this.roleName = role.name;
  }

  addNewRole(): void {
    if (!this.hasEditRolesPermission) {
      return;
    }

    this.editingRole = null;
    this.isNewRole = true;
    this.roleName = "";
  }

  cancelEdit(): void {
    this.editingRole = null;
    this.isNewRole = false;
    this.roleName = "";
  }

  saveRole(): void {
    if (!this.hasEditRolesPermission) {
      return;
    }

    if (!this.roleName || this.roleName.trim().length === 0) {
      this.showErrorPopup(this.translationService.translate('roleRequired'));
      return;
    }

    if (this.isNewRole) {
      // Create new role (always non-admin)
      this.settingsService.createRole({
        name: this.roleName.trim(),
        is_admin: 0
      }).subscribe({
        next: (newRole) => {
          this.loadData();
          this.cancelEdit();
          this.showErrorPopup(this.translationService.translate('roleSaved'));
        },
        error: (error) => {
          console.error("Error creating role:", error);
          const message = error.error?.message || this.translationService.translate('errorSavingRole');
          this.showErrorPopup(message);
        }
      });
    } else if (this.editingRole) {
      // Update existing role (is_admin cannot be changed)
      const updateData: Partial<Role> = {
        name: this.roleName.trim()
      };

      this.settingsService.updateRole(this.editingRole.guid, updateData).subscribe({
        next: (updatedRole) => {
          this.loadData();
          this.cancelEdit();
          this.showErrorPopup(this.translationService.translate('roleSaved'));
        },
        error: (error) => {
          console.error("Error updating role:", error);
          const message = error.error?.message || this.translationService.translate('errorSavingRole');
          this.showErrorPopup(message);
        }
      });
    }
  }

  deleteRole(role: Role): void {
    if (!this.hasEditRolesPermission) {
      return;
    }

    // Check if role can be deleted
    this.settingsService.checkRoleUsage(role.guid).subscribe({
      next: (usageInfo) => {
        if (!usageInfo.canDelete) {
          if (usageInfo.isAdmin) {
            this.showErrorPopup(this.translationService.translate('cannotDeleteAdminRole'));
          } else if (usageInfo.isUsed) {
            this.showErrorPopup(this.translationService.translate('roleUsedByUsers'));
          }
          return;
        }

        // Show confirmation dialog
        this.roleToDeleteGuid = role.guid;
        this.confirmDialogTitle = this.translationService.translate('deleteRole');
        this.confirmDialogMessage = `${this.translationService.translate('deleteRoleConfirm')} "${role.name}"? ${this.translationService.translate('thisActionCannotBeUndone')}`;
        this.showConfirmDialog = true;
      },
      error: (error) => {
        console.error("Error checking role usage:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
      }
    });
  }

  onConfirmDelete(): void {
    if (this.roleToDeleteGuid === null) {
      return;
    }

    this.settingsService.deleteRole(this.roleToDeleteGuid).subscribe({
      next: () => {
        this.loadData();
        this.closeConfirmDialog();
      },
      error: (error) => {
        console.error("Error deleting role:", error);
        const message = error.error?.message || this.translationService.translate('errorDeletingRole');
        this.showErrorPopup(message);
        this.closeConfirmDialog();
      }
    });
  }

  closeConfirmDialog(): void {
    this.showConfirmDialog = false;
    this.roleToDeleteGuid = null;
    this.confirmDialogTitle = "";
    this.confirmDialogMessage = "";
  }

  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
    setTimeout(() => {
      if (message.includes("successfully") || message.includes("sucessfully")) {
        this.closeErrorPopup();
      }
    }, 2000);
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }

  isAdminRole(role: Role): boolean {
    return role.is_admin === 1;
  }

  canDeleteRole(role: Role): boolean {
    // Can only delete if has permission and role is not admin
    return this.hasEditRolesPermission && role.is_admin !== 1;
  }

  isRoleNameDisabled(): boolean {
    // Name can always be edited (including admin roles)
    return false;
  }
}

