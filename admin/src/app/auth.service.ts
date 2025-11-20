import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import * as CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly STORAGE_KEY = 'admin_authenticated';
  private readonly API_URL = 'http://localhost:8080';

  constructor(
    private router: Router,
    private http: HttpClient
  ) {}

  login(username: string, password: string): Observable<boolean> {
    // Hash password with MD5 before sending
    const hashedPassword = CryptoJS.MD5(password).toString();
    
    return this.http.post<{ success: boolean; message: string }>(
      `${this.API_URL}/login`,
      { username, password: hashedPassword }
    ).pipe(
      map(response => {
        if (response.success) {
          localStorage.setItem(this.STORAGE_KEY, 'true');
          return true;
        }
        return false;
      }),
      catchError(error => {
        console.error('Login error:', error);
        return of(false);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }
}

