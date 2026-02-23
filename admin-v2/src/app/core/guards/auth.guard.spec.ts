/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authService = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });
  });

  it('should allow activation when authenticated', () => {
    authService.isAuthenticated.and.returnValue(true);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );
    expect(result).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should redirect to login when not authenticated', () => {
    authService.isAuthenticated.and.returnValue(false);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
