import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ApiError {
  success: false;
  message: string;
  stack?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private get API_URL() {
    // Get server URL at runtime
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      
      // Check if there's a configured server URL in localStorage
      const configuredServerUrl = localStorage.getItem('mediaserver_api_url');
      if (configuredServerUrl) {
        return configuredServerUrl;
      }
      
      // Check URL parameter for server override
      const urlParams = new URLSearchParams(window.location.search);
      const serverParam = urlParams.get('server');
      if (serverParam) {
        const serverUrl = serverParam.startsWith('http') ? serverParam : `${protocol}//${serverParam}`;
        localStorage.setItem('mediaserver_api_url', serverUrl);
        return serverUrl;
      }
      
      // If accessing from localhost, use fixed Raspberry Pi IP (192.168.0.100)
      // User can override with ?server=localhost:8080 for local development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//192.168.0.100:5000`;
      }
      
      // If accessing from Raspberry Pi fixed IP, use that IP with port 5000
      if (hostname === '192.168.0.100') {
        return `${protocol}//192.168.0.100:5000`;
      }
      
      // For any other hostname, use same hostname with port 5000
      return `${protocol}//${hostname}:5000`;
    }
    return environment.apiUrl;
  }
  private readonly USERNAME_KEY = 'admin_username';
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor(
    private http: HttpClient
  ) {}

  /**
   * Get request with error handling
   */
  get<T>(endpoint: string, params?: { [key: string]: any }): Observable<T> {
    // Don't show loading spinner for search operations to prevent blinking
    const isSearchOperation = endpoint.includes('/search') || 
                               endpoint.includes('/library/search') ||
                               endpoint.includes('/playlists/search');
    
    if (!isSearchOperation) {
      this.setLoading(true);
    }
    
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }

    // Add username to params if authenticated
    const username = this.getStoredUsername();
    if (username) {
      httpParams = httpParams.set('username', username);
    }

    return this.http.get<T>(`${this.API_URL}${endpoint}`, {
      params: httpParams,
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        if (!isSearchOperation) {
          this.setLoading(false);
        }
        return response;
      }),
      catchError(error => {
        if (!isSearchOperation) {
          this.setLoading(false);
        }
        return this.handleError(error);
      })
    );
  }

  /**
   * Post request with error handling
   */
  post<T>(endpoint: string, body: any): Observable<T> {
    this.setLoading(true);
    
    return this.http.post<T>(`${this.API_URL}${endpoint}`, body, {
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        this.setLoading(false);
        return response;
      }),
      catchError(error => {
        this.setLoading(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * Put request with error handling
   */
  put<T>(endpoint: string, body: any): Observable<T> {
    this.setLoading(true);
    
    // Add username to query params if authenticated
    let httpParams = new HttpParams();
    const username = this.getStoredUsername();
    if (username) {
      httpParams = httpParams.set('username', username);
    }

    return this.http.put<T>(`${this.API_URL}${endpoint}`, body, {
      params: httpParams,
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        this.setLoading(false);
        return response;
      }),
      catchError(error => {
        this.setLoading(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * Delete request with error handling
   */
  delete<T>(endpoint: string): Observable<T> {
    this.setLoading(true);
    
    // Add username to query params if authenticated
    let httpParams = new HttpParams();
    const username = this.getStoredUsername();
    if (username) {
      httpParams = httpParams.set('username', username);
    }

    return this.http.delete<T>(`${this.API_URL}${endpoint}`, {
      params: httpParams,
      headers: this.getHeaders()
    }).pipe(
      map(response => {
        this.setLoading(false);
        return response;
      }),
      catchError(error => {
        this.setLoading(false);
        return this.handleError(error);
      })
    );
  }

  /**
   * Get headers with authentication
   */
  private getHeaders(): HttpHeaders {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // Add authorization header if authenticated
    const username = this.getStoredUsername();
    if (username) {
      return headers.set('Authorization', `Bearer ${username}`);
    }

    return headers;
  }

  /**
   * Get stored username from localStorage (to avoid circular dependency)
   */
  private getStoredUsername(): string | null {
    return localStorage.getItem(this.USERNAME_KEY);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Unauthorized. Please log in again.';
        // Clear authentication on 401 (avoid circular dependency by not calling AuthService)
        localStorage.removeItem('admin_authenticated');
        localStorage.removeItem('admin_username');
      } else if (error.status === 403) {
        errorMessage = 'Access denied. Insufficient permissions.';
      } else if (error.status === 404) {
        errorMessage = 'Resource not found.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else {
        errorMessage = `Error: ${error.status} ${error.statusText}`;
      }
    }

    return throwError(() => ({
      success: false,
      message: errorMessage,
      status: error.status
    }));
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.loadingSubject.next(loading);
  }

  /**
   * Get current loading state
   */
  getLoading(): boolean {
    return this.loadingSubject.value;
  }
}
