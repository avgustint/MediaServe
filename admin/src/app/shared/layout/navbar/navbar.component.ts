import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService, User } from '../../../core/services/user.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../pipes/translation.pipe';
import { ConfirmDialogComponent } from '../../feedback/confirm-dialog/confirm-dialog.component';
import { environment } from '../../../../environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConfirmDialogComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit, OnDestroy {
  user: User | null = null;
  connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";
  mobileMenuOpen: boolean = false;
  showLogoutConfirmDialog: boolean = false;
  showAboutDialog: boolean = false;

  readonly appVersion = environment.version;

  /** Current time display (hh:mm:ss), updated every second */
  currentTimeDisplay: string = '';
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  private userSubscription?: Subscription;
  private connectionStatusSubscription?: Subscription;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private websocketService: WebSocketService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.userService.user$.subscribe(user => {
      this.user = user;
    });

    this.connectionStatusSubscription = this.websocketService.connectionStatus$.subscribe(status => {
      this.connectionStatus = status;
    });

    this.updateClockDisplay();
    this.clockInterval = setInterval(() => {
      this.updateClockDisplay();
      this.cdr.markForCheck();
    }, 1000);
  }

  private updateClockDisplay(): void {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    this.currentTimeDisplay = `${h}:${m}:${s}`;
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.connectionStatusSubscription?.unsubscribe();
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
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
    return this.userService.hasPermission('ViewPlaylist') || this.hasViewEditorPermission() || this.hasViewSettingsPermission();
  }

  navigateToPlaylist(): void {
    this.router.navigate(['/playlist']);
  }

  navigateToEditor(): void {
    this.router.navigate(['/editor']);
  }

  navigateToSettings(): void {
    this.router.navigate(['/settings']);
    this.mobileMenuOpen = false;
  }

  navigateToDisplay(): void {
    this.router.navigate(['/display']);
    this.mobileMenuOpen = false;
  }

  navigateToUser(): void {
    this.router.navigate(['/user']);
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

  logout(): void {
    this.showLogoutConfirmDialog = true;
  }

  onConfirmLogout(): void {
    this.closeMobileMenu();
    this.websocketService.disconnect();
    this.userService.clearUser();
    this.authService.logout();
    this.closeLogoutConfirmDialog();
  }

  closeLogoutConfirmDialog(): void {
    this.showLogoutConfirmDialog = false;
  }

  reloadApp(): void {
    window.location.reload();
  }

  openAboutDialog(): void {
    this.showAboutDialog = true;
    this.closeMobileMenu();
  }

  closeAboutDialog(): void {
    this.showAboutDialog = false;
  }
}
