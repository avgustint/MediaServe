import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserRole {
  guid: number;
  name: string;
  is_admin?: number | boolean;
}

export interface User {
  name: string;
  email: string;
  username: string;
  role: UserRole | null;
  guid: number;
  permissions: string[];
  locale?: string | null;
  locationId?: number;
  location?: {
    guid: number;
    name: string;
    description?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly STORAGE_KEY = 'admin_user_data';
  private userSubject = new BehaviorSubject<User | null>(this.loadUserFromStorage());
  public user$: Observable<User | null> = this.userSubject.asObservable();

  constructor() {}

  setUser(user: User): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  clearUser(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.userSubject.next(null);
  }

  hasPermission(permissionName: string): boolean {
    const user = this.getUser();
    if (!user) {
      return false;
    }
    
    // Administrators have all permissions
    if (user.role && (user.role.is_admin === 1 || user.role.is_admin === true)) {
      return true;
    }
    
    // Check if user has the specific permission
    return user.permissions.includes(permissionName);
  }

  private loadUserFromStorage(): User | null {
    try {
      const userData = localStorage.getItem(this.STORAGE_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error loading user from storage:', error);
      return null;
    }
  }
}

