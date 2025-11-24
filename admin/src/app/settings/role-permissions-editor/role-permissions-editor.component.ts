import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { SettingsService, Role, Permission } from "../settings.service";
import { UserService } from "../../user.service";
import { ErrorPopupComponent } from "../../shared/error-popup/error-popup.component";
import { TranslatePipe } from "../../translation.pipe";
import { TranslationService } from "../../translation.service";
import { forkJoin } from "rxjs";

@Component({
  selector: "app-role-permissions-editor",
  standalone: true,
  imports: [CommonModule, FormsModule, ErrorPopupComponent, TranslatePipe],
  templateUrl: "./role-permissions-editor.component.html",
  styleUrls: ["./role-permissions-editor.component.scss"]
})
export class RolePermissionsEditorComponent implements OnInit {
  roles: Role[] = [];
  permissions: Permission[] = [];
  rolePermissions: Map<number, number[]> = new Map();
  
  selectedRole: Role | null = null;
  selectedPermissions: number[] = [];

  // Error popup
  showError: boolean = false;
  errorMessage: string = "";

  hasEditRolesPermission: boolean = false;

  constructor(
    private settingsService: SettingsService,
    private userService: UserService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.hasEditRolesPermission = this.userService.hasPermission("EditRoles");
    this.loadData();
  }

  loadData(): void {
    forkJoin({
      roles: this.settingsService.getAllRoles(),
      permissions: this.settingsService.getAllPermissions()
    }).subscribe({
      next: ({ roles, permissions }) => {
        this.roles = roles;
        this.permissions = permissions;
        
        // Load permissions for all roles
        const permissionLoads = roles.map(role =>
          this.settingsService.getRolePermissions(role.guid).subscribe({
            next: (perms) => {
              this.rolePermissions.set(role.guid, perms);
            },
            error: (error) => {
              console.error(`Error loading permissions for role ${role.guid}:`, error);
              this.rolePermissions.set(role.guid, []);
            }
          })
        );
      },
      error: (error) => {
        console.error("Error loading data:", error);
        this.showErrorPopup(this.translationService.translate('errorLoadingData'));
      }
    });
  }

  selectRole(role: Role): void {
    this.selectedRole = role;
    const permissions = this.rolePermissions.get(role.guid) || [];
    this.selectedPermissions = [...permissions];
  }

  togglePermission(permissionGuid: number): void {
    // Prevent editing permissions for administrator role
    if (this.isAdministratorRole(this.selectedRole)) {
      return;
    }
    const index = this.selectedPermissions.indexOf(permissionGuid);
    if (index >= 0) {
      this.selectedPermissions.splice(index, 1);
    } else {
      this.selectedPermissions.push(permissionGuid);
    }
    // Sort to maintain consistent order
    this.selectedPermissions.sort((a, b) => a - b);
  }

  isPermissionSelected(permissionGuid: number): boolean {
    return this.selectedPermissions.includes(permissionGuid);
  }

  saveRolePermissions(): void {
    if (!this.selectedRole) {
      return;
    }

    // Prevent saving permissions for administrator role
    if (this.isAdministratorRole(this.selectedRole)) {
      this.showErrorPopup(this.translationService.translate('cannotModifyPermissionsForAdminRole'));
      return;
    }

    this.settingsService.updateRolePermissions(
      this.selectedRole.guid,
      this.selectedPermissions
    ).subscribe({
      next: (updatedPermissions) => {
        this.rolePermissions.set(this.selectedRole!.guid, updatedPermissions);
        this.selectedPermissions = [...updatedPermissions];
        this.showErrorPopup(this.translationService.translate('rolePermissionsUpdated'));
      },
      error: (error) => {
        console.error("Error saving role permissions:", error);
        this.showErrorPopup(this.translationService.translate('errorSavingRolePermissions'));
      }
    });
  }

  getRolePermissions(roleGuid: number): Permission[] {
    const permissionGuids = this.rolePermissions.get(roleGuid) || [];
    return this.permissions.filter(p => permissionGuids.includes(p.guid));
  }

  showErrorPopup(message: string): void {
    this.errorMessage = message;
    this.showError = true;
    setTimeout(() => {
      if (message.includes("successfully")) {
        this.closeErrorPopup();
      }
    }, 2000);
  }

  closeErrorPopup(): void {
    this.showError = false;
    this.errorMessage = "";
  }

  isAdministratorRole(role: Role | null): boolean {
    if (!role) {
      return false;
    }
    return role.is_admin === 1;
  }

  isRoleReadOnly(): boolean {
    return this.isAdministratorRole(this.selectedRole);
  }
}

