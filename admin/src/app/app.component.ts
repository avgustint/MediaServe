import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService, User } from './user.service';
import { WebSocketService } from './websocket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  user: User | null = null;
  connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";
  private connectionStatusSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private websocketService: WebSocketService
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

    // Subscribe to WebSocket connection status
    this.connectionStatusSubscription = this.websocketService.connectionStatus$.subscribe((status) => {
      this.connectionStatus = status;
    });

    // Connect to WebSocket if authenticated
    if (this.authService.isAuthenticated()) {
      this.websocketService.connect("ws://localhost:8080");
    }
  }

  ngOnDestroy(): void {
    this.connectionStatusSubscription?.unsubscribe();
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
    this.websocketService.disconnect();
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

