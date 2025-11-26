import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService, User } from './user.service';
import { WebSocketService } from './websocket.service';
import { TranslationService, SupportedLocale } from './translation.service';
import { TranslatePipe } from './translation.pipe';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { LoadingComponent } from './shared/loading/loading.component';
import { ApiService } from './api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ConfirmDialogComponent, LoadingComponent, TranslatePipe],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  user: User | null = null;
  connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";
  mobileMenuOpen: boolean = false;
  isLoading: boolean = false;
  private connectionStatusSubscription?: Subscription;
  private loadingSubscription?: Subscription;

  // Logout confirmation dialog
  showLogoutConfirmDialog: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private websocketService: WebSocketService,
    private translationService: TranslationService,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    // Subscribe to user changes
    this.userService.user$.subscribe(user => {
      const previousLocationId = this.user?.locationId;
      this.user = user;
      // Update locale when user changes
      if (user?.locale) {
        this.translationService.setLocale(user.locale as SupportedLocale);
      }
      
      // Reconnect WebSocket if locationId changed
      if (this.authService.isAuthenticated()) {
        if (previousLocationId !== user?.locationId) {
          this.websocketService.disconnect();
          this.websocketService.connect(user?.locationId || undefined);
        }
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

    // Subscribe to API loading state
    this.loadingSubscription = this.apiService.loading$.subscribe((loading) => {
      this.isLoading = loading;
    });

    // Connect to WebSocket if authenticated (will connect after user data is loaded)
    // The connection will be established in loadUserData callback or user$ subscription
  }

  ngOnDestroy(): void {
    this.connectionStatusSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
  }

  loadUserData(): void {
    // Preserve locationId from localStorage before fetching fresh data
    const storedUser = this.userService.getUser();
    const preservedLocationId = storedUser?.locationId;
    const preservedLocation = storedUser?.location;
    
    this.authService.getCurrentUser().subscribe(user => {
      if (user) {
        // Ensure email is decoded (server should return decoded email via getUserWithPermissions)
        // But if somehow it's still encoded, decode it
        if (user.email && !user.email.includes('@')) {
          // Email doesn't contain @, might be encoded
          try {
            const decoded = atob(user.email);
            // If decoded result looks like an email, use it
            if (decoded.includes('@')) {
              user.email = decoded;
            }
          } catch (e) {
            // Decoding failed, email might be in unexpected format, use as-is
            console.warn('Email decoding failed, using as-is:', e);
          }
        }
        
        // Preserve locationId and location from localStorage if server doesn't return them
        // Only preserve these specific properties - use all other data from server
        if (!user.locationId && preservedLocationId) {
          user.locationId = preservedLocationId;
        }
        if (!user.location && preservedLocation) {
          user.location = preservedLocation;
        }
        
        this.userService.setUser(user);
        // Connect to WebSocket with user's locationId
        this.websocketService.connect(user.locationId || undefined);
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

  hasViewDisplayPermission(): boolean {
    return this.userService.hasPermission('ViewDisplay');
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

  navigateToUser(): void {
    this.router.navigate(["/user"]);
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

