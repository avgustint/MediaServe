import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";

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
  private readonly API_URL = "http://localhost:8080";

  constructor(private http: HttpClient) {}

  // User operations
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.API_URL}/users`);
  }

  createUser(user: Partial<User>): Observable<User> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.post<User>(`${this.API_URL}/users`, user, { headers });
  }

  updateUser(guid: number, user: Partial<User>): Observable<User> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.put<User>(`${this.API_URL}/users/${guid}`, user, { headers });
  }

  deleteUser(guid: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/users/${guid}`);
  }

  // Role operations
  getAllRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.API_URL}/roles`);
  }

  // Permission operations
  getAllPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.API_URL}/permissions`);
  }

  getRolePermissions(roleGuid: number): Observable<number[]> {
    return this.http.get<number[]>(`${this.API_URL}/roles/${roleGuid}/permissions`);
  }

  updateRolePermissions(roleGuid: number, permissions: number[]): Observable<number[]> {
    const headers = new HttpHeaders({ "Content-Type": "application/json" });
    return this.http.put<number[]>(
      `${this.API_URL}/roles/${roleGuid}/permissions`,
      { permissions },
      { headers }
    );
  }
}

