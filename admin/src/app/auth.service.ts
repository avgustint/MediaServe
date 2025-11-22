import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { User } from './user.service';

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'admin_authenticated';
  private readonly USERNAME_KEY = 'admin_username';
  private readonly API_URL = 'http://localhost:8080';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  login(username: string, hashedPassword: string): Observable<LoginResponse | null> {
    // Password is already hashed in the login component
    return this.http.post<LoginResponse>(
      `${this.API_URL}/login`,
      { username, password: hashedPassword }
    ).pipe(
      map(response => {
        if (response.success && response.user) {
          localStorage.setItem(this.STORAGE_KEY, 'true');
          localStorage.setItem(this.USERNAME_KEY, username);
          return response;
        }
        return null;
      }),
      catchError(error => {
        console.error('Login error:', error);
        return of(null);
      })
    );
  }

  getCurrentUser(): Observable<User | null> {
    const username = localStorage.getItem(this.USERNAME_KEY);
    if (!username) {
      return of(null);
    }

    return this.http.get<{ success: boolean; user?: User }>(
      `${this.API_URL}/me?username=${encodeURIComponent(username)}`
    ).pipe(
      map(response => {
        if (response.success && response.user) {
          return response.user;
        }
        return null;
      }),
      catchError(error => {
        console.error('Get current user error:', error);
        return of(null);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  getStoredUsername(): string | null {
    return localStorage.getItem(this.USERNAME_KEY);
  }
}

