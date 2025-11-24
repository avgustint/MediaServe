import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

export const permissionGuard = (permissionName: string): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const userService = inject(UserService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    if (!userService.hasPermission(permissionName)) {
      router.navigate(['/playlist']); // Redirect to playlist if no permission
      return false;
    }

    return true;
  };
};

