import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { UserService, User } from './core/services/user.service';
import { WebSocketService } from './core/services/websocket.service';
import { TranslationService, SupportedLocale } from './core/services/translation.service';
import { ViewportService } from './core/services/viewport.service';
import { LoadingComponent } from './shared/feedback/loading/loading.component';
import { NavbarComponent } from './shared/layout/navbar/navbar.component';
import { ApiService } from './core/services/api.service';
import { KeyboardCommandService } from './core/services/keyboard-command.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LoadingComponent, NavbarComponent],
  template: `
    <div class="app-wrapper">
      <app-loading [isLoading]="isLoading"></app-loading>
      <app-navbar></app-navbar>
      <div class="router-outlet-container">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    @use '../styles/variables' as *;
    
    .app-wrapper {
      height: 100vh;
      height: var(--viewport-height, 100vh);
      width: 100vw;
      width: var(--viewport-width, 100vw);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
      padding-top: env(safe-area-inset-top);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
      padding-bottom: env(safe-area-inset-bottom);
    }
    
    .router-outlet-container {
      flex: 1;
      overflow: hidden;
      min-height: 0;
      max-height: var(--available-height, 100vh);
      -webkit-overflow-scrolling: touch;
      position: relative;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  user: User | null = null;
  isLoading: boolean = false;
  private userSubscription?: Subscription;
  private loadingSubscription?: Subscription;
  private keyboardCommandSubscription?: Subscription;

      constructor(
        private router: Router,
        private authService: AuthService,
        private userService: UserService,
        private websocketService: WebSocketService,
        private translationService: TranslationService,
        private viewportService: ViewportService,
        private apiService: ApiService,
        private keyboardCommandService: KeyboardCommandService
      ) {
        // ViewportService is initialized in constructor, this ensures it starts tracking immediately
      }

  ngOnInit(): void {
    // Subscribe to user changes
    this.userSubscription = this.userService.user$.subscribe(user => {
      const previousLocationId = this.user?.locationId;
      const previousUser = this.user;
      this.user = user;
      
      // Update locale when user changes
      if (user?.locale) {
        this.translationService.setLocale(user.locale as SupportedLocale);
      }
      
      // Connect WebSocket if authenticated and user has locationId
      // Only connect if:
      // 1. User just logged in (previousUser is null/undefined and user exists)
      // 2. LocationId changed
      if (this.authService.isAuthenticated() && user) {
        const shouldConnect = !previousUser || (previousLocationId !== user?.locationId);
        
        if (shouldConnect) {
          this.websocketService.disconnect();
          this.websocketService.connect(user?.locationId || undefined);
        }
      } else if (!user) {
        // User logged out, disconnect
        this.websocketService.disconnect();
      }
    });

    // If authenticated, always fetch fresh user data from server
    if (this.authService.isAuthenticated()) {
      this.loadUserData();
    }

    // Subscribe to API loading state
    this.loadingSubscription = this.apiService.loading$.subscribe((loading) => {
      this.isLoading = loading;
    });

    // Subscribe to keyboard commands from OS-level keyboard listener
    this.keyboardCommandSubscription = this.websocketService.messages$.subscribe((message) => {
      if (message.type === 'KeyboardCommand' && message.key) {
        this.handleKeyboardCommand(message.key);
      }
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.loadingSubscription?.unsubscribe();
    this.keyboardCommandSubscription?.unsubscribe();
  }

  loadUserData(): void {
    const storedUser = this.userService.getUser();
    const preservedLocationId = storedUser?.locationId;
    const preservedLocation = storedUser?.location;
    const storedUsername = this.authService.getStoredUsername();
    
    // Retry logic: server might not be ready immediately after restart
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 1000; // 1 second
    
    const attemptLoadUser = () => {
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          if (user) {
            if (!user.locationId && preservedLocationId) {
              user.locationId = preservedLocationId;
            }
            if (!user.location && preservedLocation) {
              user.location = preservedLocation;
            }
            
            this.userService.setUser(user);
            // Don't call connect() directly here - the user$ subscription will handle it
            // This prevents duplicate connections when setUser() triggers the subscription
          } else {
            // User not found or API failed - retry if we haven't exceeded max retries
            if (retryCount < maxRetries && storedUsername) {
              retryCount++;
              console.log(`Failed to load user data, retrying... (${retryCount}/${maxRetries})`);
              setTimeout(attemptLoadUser, retryDelay);
            } else {
              // Only logout if we've exhausted retries or no username stored
              console.warn('Failed to load user data after retries, logging out');
              this.logout();
            }
          }
        },
        error: (error) => {
          // Network/server error - retry if we haven't exceeded max retries
          if (retryCount < maxRetries && storedUsername) {
            retryCount++;
            console.log(`Error loading user data (${error.message}), retrying... (${retryCount}/${maxRetries})`);
            setTimeout(attemptLoadUser, retryDelay);
          } else {
            // Only logout if we've exhausted retries
            console.error('Failed to load user data after retries:', error);
            this.logout();
          }
        }
      });
    };
    
    attemptLoadUser();
  }

  logout(): void {
    this.websocketService.disconnect();
    this.userService.clearUser();
    this.authService.logout();
  }

  /**
   * Handle keyboard commands from client app
   * Dispatches synthetic keyboard events that will be caught by playlist-view's existing handlers
   */
  handleKeyboardCommand(key: string): void {
    // If number key is received, notify service to switch to manual tab (only on playlist route)
    const isNumberKey = /^[0-9]$/.test(key);
    if (isNumberKey && this.router.url === '/playlist') {
      // Queue the number key - it will be processed after tab switch
      this.keyboardCommandService.queueNumberKey(key);
      // Notify to switch tab - this is idempotent
      this.keyboardCommandService.notifyNumberKeyReceived();
    } else {
      // For non-number keys, dispatch immediately
      this.dispatchKeyboardEvent(key);
    }
  }

  /**
   * Dispatch synthetic keyboard event
   */
  private dispatchKeyboardEvent(key: string): void {
    // Create a synthetic keyboard event that playlist-view's keyboard handler will catch
    // The playlist-view component listens at window level with capture phase
    const event = new KeyboardEvent('keydown', {
      key: key,
      code: this.getKeyCode(key),
      bubbles: true,
      cancelable: true,
      view: window
    });

    // Mark event as synthetic/remote so it can be identified if needed
    Object.defineProperty(event, 'isRemote', {
      writable: false,
      value: true
    });

    // Override target to ensure it's a valid HTMLElement with closest() method
    // This is necessary because synthetic events don't have proper target by default
    Object.defineProperty(event, 'target', {
      writable: false,
      value: document.body
    });

    // Dispatch at window level (where playlist-view listens)
    window.dispatchEvent(event);
  }

  /**
   * Map key names to key codes for synthetic events
   */
  private getKeyCode(key: string): string {
    const keyCodeMap: { [key: string]: string } = {
      'ArrowLeft': 'ArrowLeft',
      'ArrowRight': 'ArrowRight',
      'ArrowUp': 'ArrowUp',
      'ArrowDown': 'ArrowDown',
      'Enter': 'Enter',
      'Escape': 'Escape',
      '0': 'Digit0',
      '1': 'Digit1',
      '2': 'Digit2',
      '3': 'Digit3',
      '4': 'Digit4',
      '5': 'Digit5',
      '6': 'Digit6',
      '7': 'Digit7',
      '8': 'Digit8',
      '9': 'Digit9'
    };
    return keyCodeMap[key] || key;
  }
}