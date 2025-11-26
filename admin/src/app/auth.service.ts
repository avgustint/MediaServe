import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
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

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {}

  login(username: string, password: string, locationId: number): Observable<LoginResponse | null> {
    // Send plain password - server will hash it with bcrypt
    return this.apiService.post<LoginResponse>('/login', { username, password, locationId }).pipe(
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

    return this.apiService.get<{ success: boolean; user?: User }>('/me', { username }).pipe(
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

