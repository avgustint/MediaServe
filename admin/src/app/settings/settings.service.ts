import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { AuthService } from "../auth.service";
import { environment } from "../../environments/environment";

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
  is_admin: number; // 0 or 1, SQLite boolean representation
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
  private readonly API_URL = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // User operations
  getAllUsers(): Observable<User[]> {
    const username = this.authService.getStoredUsername();
    const url = username 
      ? `${this.API_URL}/users?username=${encodeURIComponent(username)}`
      : `${this.API_URL}/users`;
    return this.http.get<User[]>(url);
  }

  createUser(user: Partial<User>): Observable<User> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.post<User>(`${this.API_URL}/users`, user, { headers });
  }

  updateUser(guid: number, user: Partial<User>): Observable<User> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    const username = this.authService.getStoredUsername();
    const url = username 
      ? `${this.API_URL}/users/${guid}?username=${encodeURIComponent(username)}`
      : `${this.API_URL}/users/${guid}`;
    return this.http.put<User>(url, user, { headers });
  }

  deleteUser(guid: number): Observable<void> {
    const username = this.authService.getStoredUsername();
    const url = username 
      ? `${this.API_URL}/users/${guid}?username=${encodeURIComponent(username)}`
      : `${this.API_URL}/users/${guid}`;
    return this.http.delete<void>(url);
  }

  // Role operations
  getAllRoles(): Observable<Role[]> {
    const username = this.authService.getStoredUsername();
    const url = username 
      ? `${this.API_URL}/roles?username=${encodeURIComponent(username)}`
      : `${this.API_URL}/roles`;
    return this.http.get<Role[]>(url);
  }

  createRole(role: Partial<Role>): Observable<Role> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.post<Role>(`${this.API_URL}/roles`, role, { headers });
  }

  updateRole(guid: number, role: Partial<Role>): Observable<Role> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.put<Role>(`${this.API_URL}/roles/${guid}`, role, { headers });
  }

  deleteRole(guid: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.API_URL}/roles/${guid}`);
  }

  checkRoleUsage(guid: number): Observable<{ isUsed: boolean; isAdmin: boolean; canDelete: boolean }> {
    const username = this.authService.getStoredUsername();
    const url = username 
      ? `${this.API_URL}/roles/${guid}/usage?username=${encodeURIComponent(username)}`
      : `${this.API_URL}/roles/${guid}/usage`;
    return this.http.get<{ isUsed: boolean; isAdmin: boolean; canDelete: boolean }>(url);
  }

  // Permission operations
  getAllPermissions(): Observable<Permission[]> {
    const username = this.authService.getStoredUsername();
    const url = username 
      ? `${this.API_URL}/permissions?username=${encodeURIComponent(username)}`
      : `${this.API_URL}/permissions`;
    return this.http.get<Permission[]>(url);
  }

  getRolePermissions(roleGuid: number): Observable<number[]> {
    const username = this.authService.getStoredUsername();
    const url = username 
      ? `${this.API_URL}/roles/${roleGuid}/permissions?username=${encodeURIComponent(username)}`
      : `${this.API_URL}/roles/${roleGuid}/permissions`;
    return this.http.get<number[]>(url);
  }

  updateRolePermissions(roleGuid: number, permissions: number[]): Observable<number[]> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.put<number[]>(
      `${this.API_URL}/roles/${roleGuid}/permissions`,
      { permissions },
      { headers }
    );
  }

  // General settings operations
  getGeneralSettings(username: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/settings?username=${encodeURIComponent(username)}`);
  }

  updateGeneralSettings(username: string, settings: any): Observable<any> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.put<any>(
      `${this.API_URL}/settings?username=${encodeURIComponent(username)}`,
      settings,
      { headers }
    );
  }
}

