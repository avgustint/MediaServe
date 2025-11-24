import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { UserEditorComponent } from "./user-editor/user-editor.component";
import { RoleEditorComponent } from "./role-editor/role-editor.component";
import { RolePermissionsEditorComponent } from "./role-permissions-editor/role-permissions-editor.component";
import { TranslatePipe } from "../translation.pipe";
import { UserService } from "../user.service";

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [CommonModule, UserEditorComponent, RoleEditorComponent, RolePermissionsEditorComponent, TranslatePipe],
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.scss"]
})
export class SettingsComponent implements OnInit {
  activeTab: "users" | "roles" | "permissions" | null = null;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    // Set default active tab based on available permissions
    if (this.hasViewUsersPermission()) {
      this.activeTab = "users";
    } else if (this.hasViewRolesPermission()) {
      this.activeTab = "roles";
    }
  }

  hasViewUsersPermission(): boolean {
    return this.userService.hasPermission("ViewUsers");
  }

  hasViewRolesPermission(): boolean {
    return this.userService.hasPermission("ViewRoles");
  }

  switchTab(tab: "users" | "roles" | "permissions"): void {
    this.activeTab = tab;
  }
}

