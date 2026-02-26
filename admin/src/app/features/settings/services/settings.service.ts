import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ApiService } from "../../../core/services/api.service";
import { AuthService } from "../../../core/services/auth.service";

export interface User {
  guid: number;
  name: string;
  email: string;
  username: string;
  role: number | null;
  locale: string | null;
}

export interface Role {
  guid: number;
  name: string;
  is_admin: number;
}

export interface Permission {
  guid: number;
  name: string;
  description: string | null;
}

@Injectable({
  providedIn: "root"
})
export class SettingsService {
  constructor(
    private apiService: ApiService,
    private authService: AuthService
  ) {}

  getAllUsers(): Observable<User[]> {
    const username = this.authService.getStoredUsername();
    return this.apiService.get<User[]>('/users', username ? { username } : undefined);
  }

  createUser(user: Partial<User>): Observable<User> {
    return this.apiService.post<User>('/users', user);
  }

  updateUser(guid: number, user: Partial<User>): Observable<User> {
    return this.apiService.put<User>(`/users/${guid}`, user);
  }

  deleteUser(guid: number): Observable<void> {
    return this.apiService.delete<void>(`/users/${guid}`);
  }

  getAllRoles(): Observable<Role[]> {
    const username = this.authService.getStoredUsername();
    return this.apiService.get<Role[]>('/roles', username ? { username } : undefined);
  }

  createRole(role: Partial<Role>): Observable<Role> {
    return this.apiService.post<Role>('/roles', role);
  }

  updateRole(guid: number, role: Partial<Role>): Observable<Role> {
    return this.apiService.put<Role>(`/roles/${guid}`, role);
  }

  deleteRole(guid: number): Observable<{ success: boolean; message: string }> {
    return this.apiService.delete<{ success: boolean; message: string }>(`/roles/${guid}`);
  }

  checkRoleUsage(guid: number): Observable<{ isUsed: boolean; isAdmin: boolean; canDelete: boolean }> {
    const username = this.authService.getStoredUsername();
    return this.apiService.get<{ isUsed: boolean; isAdmin: boolean; canDelete: boolean }>(
      `/roles/${guid}/usage`,
      username ? { username } : undefined
    );
  }

  getAllPermissions(): Observable<Permission[]> {
    const username = this.authService.getStoredUsername();
    return this.apiService.get<Permission[]>('/permissions', username ? { username } : undefined);
  }

  getRolePermissions(roleGuid: number): Observable<number[]> {
    const username = this.authService.getStoredUsername();
    return this.apiService.get<number[]>(
      `/roles/${roleGuid}/permissions`,
      username ? { username } : undefined
    );
  }

  updateRolePermissions(roleGuid: number, permissions: number[]): Observable<number[]> {
    return this.apiService.put<number[]>(`/roles/${roleGuid}/permissions`, { permissions });
  }

  getGeneralSettings(username: string): Observable<any> {
    return this.apiService.get<any>('/settings', { username });
  }

  updateGeneralSettings(username: string, settings: any): Observable<any> {
    // Note: username is automatically added by ApiService via localStorage
    return this.apiService.put<any>('/settings', settings);
  }
}
