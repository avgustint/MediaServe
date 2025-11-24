import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService, User } from './user.service';
import { WebSocketService } from './websocket.service';
import { TranslationService, SupportedLocale } from './translation.service';
import { TranslatePipe } from './translation.pipe';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ConfirmDialogComponent, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  user: User | null = null;
  connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";
  mobileMenuOpen: boolean = false;
  private connectionStatusSubscription?: Subscription;

  // Logout confirmation dialog
  showLogoutConfirmDialog: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private websocketService: WebSocketService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Subscribe to user changes
    this.userService.user$.subscribe(user => {
      this.user = user;
      // Update locale when user changes
      if (user?.locale) {
        this.translationService.setLocale(user.locale as SupportedLocale);
      }
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
    // Show confirmation dialog instead of logging out directly
    this.showLogoutConfirmDialog = true;
  }

  onConfirmLogout(): void {
    // Close mobile menu if open
    this.mobileMenuOpen = false;
    // Perform logout
    this.websocketService.disconnect();
    this.userService.clearUser();
    this.authService.logout();
    this.closeLogoutConfirmDialog();
  }

  closeLogoutConfirmDialog(): void {
    this.showLogoutConfirmDialog = false;
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

  hasViewSettingsPermission(): boolean {
    return this.userService.hasPermission('ViewSettings');
  }

  shouldShowPlaylistButton(): boolean {
    return this.hasViewEditorPermission() || this.hasViewSettingsPermission();
  }

  navigateToPlaylist(): void {
    this.router.navigate(["/playlist"]);
  }

  navigateToEditor(): void {
    this.router.navigate(["/editor"]);
  }

  navigateToSettings(): void {
    this.router.navigate(["/settings"]);
    this.mobileMenuOpen = false;
  }

  navigateToDisplay(): void {
    this.router.navigate(["/display"]);
    this.mobileMenuOpen = false;
  }

  navigateToPlaylistMobile(): void {
    this.navigateToPlaylist();
    this.mobileMenuOpen = false;
  }

  navigateToEditorMobile(): void {
    this.navigateToEditor();
    this.mobileMenuOpen = false;
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  getConnectionStatusText(): string {
    switch (this.connectionStatus) {
      case 'connected':
        return this.translationService.translate('connected');
      case 'connecting':
        return this.translationService.translate('connecting');
      case 'disconnected':
        return this.translationService.translate('disconnected');
      default:
        return '';
    }
  }
}

