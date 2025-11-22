import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService, User } from './user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  user: User | null = null;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Subscribe to user changes
    this.userService.user$.subscribe(user => {
      this.user = user;
    });

    // If authenticated, always fetch fresh user data from server
    if (this.authService.isAuthenticated()) {
      this.loadUserData();
    }
  }

  loadUserData(): void {
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        this.userService.setUser(user);
      } else {
        // If we can't get user data, log out
        this.logout();
      }
    });
  }

  logout(): void {
    this.userService.clearUser();
    this.authService.logout();
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  getUserName(): string {
    return this.user?.name || '';
  }

  hasViewEditorPermission(): boolean {
    return this.userService.hasPermission('ViewEditor');
  }

  navigateToPlaylist(): void {
    this.router.navigate(["/playlist"]);
  }

  navigateToEditor(): void {
    this.router.navigate(["/editor"]);
  }
}

