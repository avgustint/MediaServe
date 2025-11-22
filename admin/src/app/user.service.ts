import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserRole {
  guid: number;
  name: string;
}

export interface User {
  name: string;
  email: string;
  username: string;
  role: UserRole | null;
  guid: number;
  permissions: string[];
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
    return user ? user.permissions.includes(permissionName) : false;
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

