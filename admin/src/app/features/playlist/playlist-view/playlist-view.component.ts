import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DomSanitizer, SafeResourceUrl, SafeHtml } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "../../../core/services/websocket.service";
import { LibraryItem, PlaylistService } from "../services/playlist.service";
import { ChordSettingsService } from "../services/chord-settings.service";
import { PlaylistListComponent } from "../playlist-list/playlist-list.component";
import { ManualComponent } from "../manual/manual.component";
import { SearchComponent } from "../search/search.component";
import { TranslatePipe } from "../../../shared/pipes/translation.pipe";
import { FormatTextPipe } from "../../../shared/pipes/format-text.pipe";
import { UserService } from "../../../core/services/user.service";
import { AuthService } from "../../../core/services/auth.service";
import { SettingsService } from "../../settings/services/settings.service";
import { KeyboardCommandService } from "../../../core/services/keyboard-command.service";
import { RecentItemsService } from "../services/recent-items.service";
import { environment } from "../../../../environments/environment";
import { Subscription } from "rxjs";
import { filter, take } from "rxjs/operators";

@Component({
  selector: "app-playlist-view",
  standalone: true,
  imports: [CommonModule, PlaylistListComponent, ManualComponent, SearchComponent, TranslatePipe, FormatTextPipe],
  templateUrl: "./playlist-view.component.html",
  styleUrls: ["./playlist-view.component.scss"]
})
export class PlaylistViewComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("textContainer", { static: false }) textContainer!: ElementRef<HTMLDivElement>;
  @ViewChild("imageContainer", { static: false }) imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild("urlIframe", { static: false }) urlIframe!: ElementRef<HTMLIFrameElement>;
  @ViewChild("videoElement", { static: false }) videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild(ManualComponent, { static: false }) manualComponent!: ManualComponent;

  currentContent: WebSocketMessage | null = null;
  private subscription?: Subscription;
  private lastContentSubscription?: Subscription;
  private selectionSubscription?: Subscription;
  private keyboardCommandSubscription?: Subscription;
  private numberKeyQueueSubscription?: Subscription;
  private pendingNumberKeys: string[] = [];
  activeTab: "playlist" | "search" | "manual" = "manual";
  selectedPlaylistGuid?: number;
  
  // Current item tracking
  currentItemGuid?: number;
  currentPage?: number;
  currentItemName?: string;
  playlistItems: LibraryItem[] = [];
  currentItemIndex: number = -1;
  
  // Flag to prevent sending selection messages when receiving them
  private isReceivingSelection: boolean = false;
  private resizeHandler = () => {
    if (this.currentContent?.type === "text") {
      this.adjustTextSize();
    }
  };

  private keyboardHandler = (event: KeyboardEvent) => {
    this.handleKeyboardEvent(event);
  };

  // Manual tab item tracking
  manualItem: LibraryItem | null = null;
  manualItemPages: number[] = [];
  
  // Mobile sidebar state
  sidebarOpen: boolean = false;
  sidebarCollapsed: boolean = false;

  // Fullscreen state
  isFullscreen: boolean = false;

  // Dev mode flag - show chord controls only in development
  readonly isDevMode: boolean = !environment.production;
  readonly Math = Math;

  // Chord display state: 'local' (only on admin), 'everywhere' (all clients), 'hidden' (no chords)
  // Default: 'hidden' (chords hidden by default)
  chordDisplayState: 'local' | 'everywhere' | 'hidden' = 'hidden';
  
  // Chord transposition offset in semitones (0 = original key, positive = up, negative = down)
  chordTransposition: number = 0;
  private originalContent: string | null = null;

  // Content visibility: true = show last selected item, false = show blank/clear page (per location, from server)
  contentVisible: boolean = true;
  visibilityToggleDisabled: boolean = false; // Debounce: prevent double-send
  private originalContentGuid: number | null = null; // Track which item the originalContent belongs to
  private originalContentPage: number | null = null; // Track which page the originalContent belongs to
  
  // Computed chordsVisible based on display state (for admin local display)
  get chordsVisible(): boolean {
    return this.chordDisplayState !== 'hidden';
  }

  // Get chordsVisible value for clients (false for 'local' or 'hidden', true for 'everywhere')
  get chordsVisibleForClients(): boolean {
    return this.chordDisplayState === 'everywhere';
  }

  // Track if we need to maintain focus for keyboard handling
  private shouldMaintainFocus: boolean = false;
  
  // Track when we last made a manual selection to ignore stale sync messages
  private lastManualSelectionTime: number = 0;
  private lastManualSelectionGuid: number | undefined = undefined;

  // Throttle requestContentWithChords to prevent multi-admin loop (don't re-request right after receiving)
  private lastContentReceivedAt: number = 0;
  private static readonly REQUEST_CHORDS_DEBOUNCE_MS = 600;

  // Autoplay state
  autoplayPlaying: boolean = false;
  autoplayEndAt: number | null = null;
  autoplayTotalSeconds: number = 0;
  autoplayRemainingSeconds: number = 0;
  /** Continuous progress 0–1 for ring animation (avoids delay from discrete seconds) */
  autoplayProgress: number = 1;
  private autoplayTickInterval: ReturnType<typeof setInterval> | null = null;
  /** When currentContent is null (e.g. loading), use this to keep button visible if item has duration */
  private lastContentDurationForItem: number | null = null;
  // Hide delay phase (after last page, before content is hidden)
  autoplayHideDelayEndAt: number | null = null;
  autoplayHideDelayTotalSeconds: number = 0;
  autoplayHideDelayRemainingSeconds: number = 0;
  /** Continuous progress 0–1 for hide delay ring */
  autoplayHideDelayProgress: number = 1;

  /** Auto-hide: hide content after N seconds of no activity (from settings, 0 = disabled) */
  autoHideTimeoutSeconds: number = 0;
  private autoHideTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer,
    private playlistService: PlaylistService,
    private userService: UserService,
    private chordSettingsService: ChordSettingsService,
    private keyboardCommandService: KeyboardCommandService,
    private recentItemsService: RecentItemsService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private settingsService: SettingsService
  ) {}

  ngOnInit(): void {
    // Load saved playlist guid from localStorage
    const savedGuid = localStorage.getItem("selectedPlaylistGuid");
    if (savedGuid) {
      this.selectedPlaylistGuid = parseInt(savedGuid, 10);
    }

    // Load chord settings from service
    this.chordTransposition = this.chordSettingsService.getChordTransposition();
    this.chordDisplayState = this.chordSettingsService.getChordDisplayState();

    // Restore contentVisible state from service (survives component destruction during navigation)
    this.websocketService.contentVisible$.pipe(take(1)).subscribe((visible) => {
      this.contentVisible = visible;
      this.resetAutoHideTimer();
    });

    // Load general settings for auto-hide timeout
    const username = this.authService.getStoredUsername();
    if (username) {
      this.settingsService.getGeneralSettings(username).subscribe({
        next: (settings) => {
          this.autoHideTimeoutSeconds = parseInt(settings.autoHideTimeoutSeconds || '0', 10) || 0;
          this.resetAutoHideTimer();
        }
      });
    }

    // Apply last content if we missed it (e.g. mounted after reconnect - Subject doesn't replay)
    this.lastContentSubscription = this.websocketService.lastContent$.pipe(
      filter((c): c is WebSocketMessage => c != null),
      take(1)
    ).subscribe((storedContent) => {
      if (!this.currentContent) {
        this.currentContent = { ...storedContent };
        if (storedContent.guid !== undefined) this.currentItemGuid = storedContent.guid;
        if (storedContent.page !== undefined) this.currentPage = storedContent.page;
        this.chordDisplayState = this.chordSettingsService.getChordDisplayState();
        if (storedContent.chordTransposition !== undefined) {
          this.chordTransposition = storedContent.chordTransposition;
        }
        if (storedContent.type === 'text') {
          setTimeout(() => this.adjustTextSize(), 100);
        }
        if (storedContent.guid !== undefined) {
          this.loadManualItemForPagesIfNeeded(storedContent.guid);
        }
        // When chords visible locally but server sent display version (no chords), request content with chords
        const storedClientsHideChords = storedContent.chordVisibility !== undefined
          ? (storedContent.chordVisibility !== 'everywhere')
          : (storedContent.chordsVisible === false);
        if (storedContent.type === 'text' && storedContent.guid !== undefined &&
            this.chordDisplayState === 'local' && storedClientsHideChords) {
          this.requestContentWithChords();
        }
      }
    });

    // Subscribe to WebSocket messages
    this.subscription = this.websocketService.messages$.subscribe((message: WebSocketMessage) => {
      // Handle selection sync messages
      if (message.type === 'SelectPlaylist' && message.guid !== undefined) {
        // Only process if locationId matches (or if no locationId in message)
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          this.handlePlaylistSelection(message.guid, true);
        }
        return;
      }
      
      if (message.type === 'DisplayVisibleState') {
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          if (message.contentVisible !== undefined) {
            this.contentVisible = message.contentVisible;
          }
        }
        return;
      }

      if (message.type === 'AutoplayStarted') {
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          this.autoplayPlaying = true;
          this.autoplayEndAt = message.endAt ?? null;
          this.autoplayTotalSeconds = message.totalSeconds ?? 0;
          this.updateAutoplayRemaining();
          this.startAutoplayTick();
        }
        return;
      }

      if (message.type === 'AutoplayHideDelayStarted') {
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          this.autoplayPlaying = false;
          this.stopAutoplayTick();
          this.autoplayEndAt = null;
          this.autoplayTotalSeconds = 0;
          this.autoplayRemainingSeconds = 0;
          this.autoplayHideDelayEndAt = (message as { endAt?: number }).endAt ?? null;
          this.autoplayHideDelayTotalSeconds = (message as { totalSeconds?: number }).totalSeconds ?? 0;
          this.autoplayHideDelayRemainingSeconds = this.autoplayHideDelayTotalSeconds;
          this.startAutoplayTick();
        }
        return;
      }

      if (message.type === 'AutoplayStopped') {
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          this.resetAutoplayState();
        }
        return;
      }

      if (message.type === 'SelectLibraryItem' && message.guid !== undefined) {
        // Only process if locationId matches (or if no locationId in message)
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          // Ignore stale sync messages that don't match our current selection
          // This prevents old SelectLibraryItem messages from overwriting new manual selections
          const now = Date.now();
          const timeSinceLastManualSelection = now - this.lastManualSelectionTime;
          
          // If we just made a manual selection (within last 2 seconds) and this sync message
          // is for a different GUID, ignore it (it's likely stale from before our click)
          if (timeSinceLastManualSelection < 2000 && 
              this.lastManualSelectionGuid !== undefined && 
              message.guid !== this.lastManualSelectionGuid) {
            console.log(`Ignoring stale SelectLibraryItem sync for guid ${message.guid}, we just selected ${this.lastManualSelectionGuid}`);
            return;
          }
          
          this.handleLibraryItemSelection(message.guid, message.page, true);
        }
        return;
      }

      // Handle content messages
      if (message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video' || message.type === 'iframe') {
        this.lastContentReceivedAt = Date.now();

        // contentVisible state is authoritative only from:
        //   1. DisplayVisibleState messages (handled separately above)
        //   2. isBlankPage messages  (server explicitly sending hide/blank page)
        //   3. contentVisible:true   (content is being made visible again)
        // Ordinary content messages with contentVisible:false (e.g. Change response while
        // the audience display is hidden) must NOT flip the admin overlay on.
        if ((message as any).isBlankPage === true) {
          // Explicit blank/hide page — update visibility flag and stop here so the
          // admin keeps showing the current song preview under the overlay.
          this.contentVisible = false;
          return;
        }
        if (message.contentVisible === true) {
          this.contentVisible = true;
        }

        // Determine the GUID for this message
        const messageGuid = message.guid !== undefined ? message.guid : this.currentItemGuid;
        
        // Ignore content for a different item only if WE just clicked something locally
        // (cross-admin updates from another admin should always be accepted)
        if (messageGuid !== undefined && this.currentItemGuid !== undefined && messageGuid !== this.currentItemGuid) {
          const msSinceLocalSelect = Date.now() - this.lastManualSelectionTime;
          if (msSinceLocalSelect < 2000 && this.lastManualSelectionGuid === this.currentItemGuid) {
            return; // Stale content — arrived before our own click was broadcast
          }
          // Otherwise accept: another admin changed the item
        }
        
        // Update currentContent with the received message
        this.currentContent = { ...message };
        const msgDuration = (message as { duration?: number | null }).duration;
        if (message.guid !== undefined && message.guid === this.currentItemGuid) {
          this.lastContentDurationForItem = (msgDuration != null && msgDuration > 0) ? msgDuration : null;
        }
        
        // When content includes guid/page (e.g. on reconnect), track selection so subsequent
        // SelectLibraryItem sync won't clear the content we just received.
        // When contentVisible is false (showing blank page), keep previous selection for footer
        if (this.contentVisible) {
          if (message.guid !== undefined) {
            this.currentItemGuid = message.guid;
          }
          if (message.page !== undefined) {
            this.currentPage = message.page;
          }
        }
        
        // Load full item for page buttons (needed on refresh - manualItem/manualItemPages for getAvailablePages)
        // Only load when we don't already have correct data; when item is from playlist, preserve playlist pages
        if (message.guid !== undefined) {
          this.loadManualItemForPagesIfNeeded(message.guid);
        }
        
        // Chord display state: always sync from message when chordVisibility is present (multi-admin sync)
        if (message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video' || message.type === 'iframe') {
          if (message.chordVisibility !== undefined) {
            const msgState = message.chordVisibility as 'local' | 'everywhere' | 'hidden';
            this.chordDisplayState = msgState;
            this.chordSettingsService.setChordDisplayState(msgState);
          } else {
            this.chordDisplayState = this.chordSettingsService.getChordDisplayState();
          }
        }
        
        // Update chord transposition from message if present, otherwise use service value
        if (message.chordTransposition !== undefined) {
          this.chordTransposition = message.chordTransposition;
          // Save to service
          this.chordSettingsService.setChordTransposition(message.chordTransposition);
        } else {
          // Use service value (keep selection across items)
          this.chordTransposition = this.chordSettingsService.getChordTransposition();
        }
        
        // Store original content for text type (for chord transposition and chord visibility)
        // IMPORTANT: Only store originalContent when we receive content for a NEW item
        // or when we explicitly request it (to avoid overwriting with transposed/modified content)
        if (message.type === "text" && message.content) {
          const receivedContent = message.content as string;
          
          // Check if received content has chords
          const hasChords = /<chord\b[^>]*>.*?<\/chord>/gi.test(receivedContent);
          
          // Determine the page number for this message
          const messagePage = message.page !== undefined ? message.page : this.currentPage;
          
          // Always update originalContent from the best available raw source.
          // Prefer message.rawContent (explicit untransposed field from broadcastContentUpdate).
          // Fall back to receivedContent if it has chords (e.g. server-fetched via Change).
          const rawSource = message.rawContent;
          if (rawSource) {
            this.originalContent = rawSource;
            this.originalContentGuid = messageGuid ?? this.currentItemGuid ?? null;
            this.originalContentPage = messagePage ?? this.currentPage ?? null;
          } else if (hasChords) {
            this.originalContent = receivedContent;
            this.originalContentGuid = messageGuid ?? this.currentItemGuid ?? null;
            this.originalContentPage = messagePage ?? this.currentPage ?? null;
          }
          
          // Set the content initially to what we received
          this.currentContent.content = receivedContent;
          
          // Apply current transposition to the original content if needed
          // Only do this if originalContent is for the current item AND page
          if (this.originalContentGuid === messageGuid && 
              ((messagePage !== undefined && messagePage === this.originalContentPage) ||
               (messagePage === undefined && this.currentPage === this.originalContentPage))) {
            // Always work from originalContent to avoid double transposition
            if (this.chordTransposition !== 0 && this.originalContent) {
              // Restore original first, then apply transposition
              this.currentContent.content = this.originalContent;
              this.applyChordTranspositionToContent();
            } else if (this.chordTransposition === 0 && this.originalContent) {
              // If no transposition and we have original, use original (with chords)
              this.currentContent.content = this.originalContent;
            }
          }
          
          // Always apply chord display state after all processing
          // This ensures that if chords are hidden, they're removed from the content
          // regardless of transposition or original content restoration
          if (this.chordDisplayState === 'hidden' && this.currentContent.content) {
            const currentContentStr = this.currentContent.content as string;
            // Remove chords if they're present
            if (/<chord\b[^>]*>.*?<\/chord>/gi.test(currentContentStr)) {
              this.currentContent.content = this.removeChordsFromContent(currentContentStr);
            }
          }

          // When chords visible locally but server sent display version (no chords), request content with chords
          const messageClientsHideChords = message.chordVisibility !== undefined
            ? (message.chordVisibility !== 'everywhere')
            : (message.chordsVisible === false);
          if (!hasChords && this.chordDisplayState === 'local' && messageClientsHideChords &&
              (messageGuid ?? this.currentItemGuid) !== undefined) {
            this.requestContentWithChords();
          }
        }

        // Adjust font size for text after view update
        if (message.type === "text") {
          setTimeout(() => this.adjustTextSize(), 100);
        }

        // When receiving content update from another admin (no contentVisible = not initial connection),
        // sync our state to match - last writer wins. Do NOT rebroadcast (causes loop with multiple admins).

        // If URL or iframe content is loaded, ensure focus stays on main container for keyboard handling
        if ((message.type === "url" || message.type === "iframe") && this.activeTab === 'manual') {
          setTimeout(() => {
            const mainContainer = document.querySelector('.main-container') as HTMLElement;
            if (mainContainer) {
              mainContainer.focus();
              this.shouldMaintainFocus = true;
            }
          }, 100);
        }

        // Reset auto-hide timer when content changes (e.g. autoplay advancing pages)
        this.resetAutoHideTimer();
      }

      // If message is empty object, it's a clear/blank display (legacy or no defaultBlankPage)
      // When contentVisible is false, keep currentItemGuid for footer (shows what will restore on toggle)
      if (!message.type && !message.content) {
        if (this.contentVisible) {
          this.currentItemGuid = undefined;
          this.currentPage = undefined;
          this.currentItemName = undefined;
          this.currentItemIndex = -1;
        }
        // When hidden: treat empty as blank page - keep selection for restore info
      }
    });

    // Subscribe to keyboard command service to switch to manual tab when number key is received from client
    this.keyboardCommandSubscription = this.keyboardCommandService.numberKeyReceived$.subscribe(() => {
      // Switch to manual tab when number key is received from client
      if (this.activeTab !== 'manual') {
        this.switchTab('manual');
        // Process queued keys after tab switch completes (Angular change detection)
        setTimeout(() => {
          this.processPendingNumberKeys();
        }, 50);
      } else {
        // Already on manual tab, process immediately
        this.processPendingNumberKeys();
      }
    });

    // Subscribe to number key queue to collect keys while tab is switching
    this.numberKeyQueueSubscription = this.keyboardCommandService.numberKeyQueue$.subscribe((key: string) => {
      // Add key to queue - will be processed after tab switch or immediately if already on manual tab
      this.pendingNumberKeys.push(key);
      
      // If already on manual tab and component is ready, process immediately
      if (this.activeTab === 'manual' && this.manualComponent) {
        this.processPendingNumberKeys();
      }
    });
  }

  ngAfterViewInit(): void {
    // Listen for window resize to adjust text size
    window.addEventListener("resize", this.resizeHandler);
    // Listen for keyboard events at window level with capture to catch iframe events
    // Using capture phase (true) to intercept events before they reach iframe
    window.addEventListener("keydown", this.keyboardHandler, true);
    // Also listen at document level as fallback
    document.addEventListener("keydown", this.keyboardHandler, true);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.lastContentSubscription?.unsubscribe();
    this.selectionSubscription?.unsubscribe();
    this.keyboardCommandSubscription?.unsubscribe();
    this.numberKeyQueueSubscription?.unsubscribe();
    this.stopAutoplayTick();
    this.clearAutoHideTimer();
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("keydown", this.keyboardHandler, true);
    document.removeEventListener("keydown", this.keyboardHandler, true);
  }

  get showAutoplayButton(): boolean {
    if (!this.contentVisible) return false;
    const duration = this.currentContent
      ? (this.currentContent as WebSocketMessage & { duration?: number | null }).duration
      : this.lastContentDurationForItem;
    return !!(duration != null && duration > 0);
  }

  /** Reset autoplay state - call when user manually changes page or item */
  private resetAutoplayState(): void {
    this.stopAutoplayTick();
    this.autoplayPlaying = false;
    this.autoplayEndAt = null;
    this.autoplayTotalSeconds = 0;
    this.autoplayRemainingSeconds = 0;
    this.autoplayProgress = 1;
    this.autoplayHideDelayEndAt = null;
    this.autoplayHideDelayTotalSeconds = 0;
    this.autoplayHideDelayRemainingSeconds = 0;
    this.autoplayHideDelayProgress = 1;
  }

  private updateAutoplayRemaining(): void {
    if (this.autoplayEndAt != null && this.autoplayTotalSeconds > 0) {
      const msLeft = this.autoplayEndAt - Date.now();
      this.autoplayRemainingSeconds = Math.max(0, Math.ceil(msLeft / 1000));
      this.autoplayProgress = Math.max(0, Math.min(1, msLeft / (this.autoplayTotalSeconds * 1000)));
    }
    if (this.autoplayHideDelayEndAt != null && this.autoplayHideDelayTotalSeconds > 0) {
      const msLeft = this.autoplayHideDelayEndAt - Date.now();
      this.autoplayHideDelayRemainingSeconds = Math.max(0, Math.ceil(msLeft / 1000));
      this.autoplayHideDelayProgress = Math.max(0, Math.min(1, msLeft / (this.autoplayHideDelayTotalSeconds * 1000)));
    }
  }

  private startAutoplayTick(): void {
    this.stopAutoplayTick();
    this.autoplayTickInterval = setInterval(() => {
      this.updateAutoplayRemaining();
      this.cdr.markForCheck();
    }, 200);
  }

  private stopAutoplayTick(): void {
    if (this.autoplayTickInterval) {
      clearInterval(this.autoplayTickInterval);
      this.autoplayTickInterval = null;
    }
  }

  onAutoplayButtonClick(): void {
    const user = this.userService.getUser();
    if (!user?.locationId) return;
    if (!this.contentVisible && !this.autoplayPlaying) return; // Cannot start when hidden
    const play = !this.autoplayPlaying;
    const msg: Record<string, unknown> = {
      type: play ? 'AutoplayStart' : 'AutoplayStop',
      locationId: user.locationId,
      play
    };
    // When item is from playlist with specific pages, send them so server uses only those pages
    if (play && this.currentItemGuid) {
      const pages = this.getAvailablePages();
      if (pages.length > 0) {
        msg['playlistPages'] = pages;
      }
    }
    this.websocketService.send(JSON.stringify(msg));
  }

  /**
   * Process pending number keys from the queue
   * Called after tab switch completes or when already on manual tab
   */
  private processPendingNumberKeys(): void {
    if (!this.manualComponent || this.activeTab !== 'manual') {
      // If component not ready, retry after a short delay
      if (this.pendingNumberKeys.length > 0) {
        setTimeout(() => this.processPendingNumberKeys(), 50);
      }
      return;
    }

    // Process all pending keys
    while (this.pendingNumberKeys.length > 0) {
      const key = this.pendingNumberKeys.shift();
      if (key && this.manualComponent) {
        this.manualComponent.onNumberClick(key);
      }
    }
  }

  switchTab(tab: "playlist" | "search" | "manual"): void {
    this.activeTab = tab;
    // Do NOT clear manualItem/manualItemPages when switching to playlist tab.
    // If the displayed item was selected via numpad/search and is not in the playlist,
    // we need manualItem/manualItemPages for getAvailablePages() to show page buttons.
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleSidebarCollapse(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  onPlaylistSelected(guid: number): void {
    this.handlePlaylistSelection(guid, false);
  }
  
  handlePlaylistSelection(guid: number, fromSync: boolean = false): void {
    this.isReceivingSelection = fromSync;
    
    this.selectedPlaylistGuid = guid;
    // Save to localStorage to remember selection
    localStorage.setItem("selectedPlaylistGuid", guid.toString());
    
    // Send selection sync message if not from sync
    if (!fromSync) {
      const user = this.userService.getUser();
      const selectMessage: any = {
        type: 'SelectPlaylist',
        guid: guid
      };
      if (user?.locationId) {
        selectMessage.locationId = user.locationId;
      }
      this.websocketService.send(JSON.stringify(selectMessage));
    }
    
    this.isReceivingSelection = false;
  }

  adjustTextSize(): void {
    if (!this.textContainer || !this.currentContent || this.currentContent.type !== "text") {
      return;
    }

    const container = this.textContainer.nativeElement;
    const textElement = container.querySelector(".text-content") as HTMLElement;

    if (!textElement) {
      return;
    }

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const text = this.currentContent.content;

    if (!text || text.trim().length === 0) {
      return;
    }

    // Binary search for optimal font size
    let minFont = 10;
    let maxFont = Math.min(containerWidth, containerHeight);
    let bestFont = minFont;

    // Set initial font size
    textElement.style.fontSize = `${minFont}px`;

    // Binary search to find maximum font size that fits
    while (minFont <= maxFont) {
      const fontSize = Math.floor((minFont + maxFont) / 2);
      textElement.style.fontSize = `${fontSize}px`;

      // Force reflow to get accurate measurements
      textElement.offsetHeight;

      // Check if text fits within container with some padding
      const textWidth = textElement.scrollWidth;
      const textHeight = textElement.scrollHeight;

      if (textWidth <= containerWidth * 0.85 && textHeight <= containerHeight * 0.98) {
        bestFont = fontSize;
        minFont = fontSize + 1;
      } else {
        maxFont = fontSize - 1;
      }
    }

    // Apply the best font size found
    textElement.style.fontSize = `${bestFont}px`;
  }

  get imageSrc(): string {
    if (this.currentContent?.type === "image" && this.currentContent.content) {
      // Handle base64 image
      if (this.currentContent.content.startsWith("data:image")) {
        return this.currentContent.content;
      } else {
        // Assume it's base64 without data URI prefix
        return `data:image/png;base64,${this.currentContent.content}`;
      }
    }
    return "";
  }

  get safeUrl(): SafeResourceUrl {
    if (this.currentContent?.type === "url" && this.currentContent.content) {
      const url = this.currentContent.content as string;
      const urlWithParams = this.addParamsToUrl(url);
      return this.sanitizer.bypassSecurityTrustResourceUrl(urlWithParams);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl("about:blank");
  }

  get videoSrc(): SafeResourceUrl {
    if (this.currentContent?.type === "video" && this.currentContent.content) {
      const videoUrl = this.currentContent.content as string;
      // If it's already a full URL, use it; otherwise construct from environment.apiUrl
      if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
        return this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
      } else {
        // Relative path - construct full URL
        const fullUrl = `${environment.apiUrl}${videoUrl.startsWith('/') ? videoUrl : '/' + videoUrl}`;
        return this.sanitizer.bypassSecurityTrustResourceUrl(fullUrl);
      }
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl("about:blank");
  }

  get safeIframeHtml(): SafeHtml {
    if (this.currentContent?.type === "iframe" && this.currentContent.content) {
      return this.sanitizer.bypassSecurityTrustHtml(this.currentContent.content as string);
    }
    return this.sanitizer.bypassSecurityTrustHtml("");
  }

  private addParamsToUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // For YouTube, add enablejsapi=1 for postMessage API to work
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        if (!urlObj.searchParams.has('enablejsapi')) {
          urlObj.searchParams.set('enablejsapi', '1');
        }
      }
      
      return urlObj.toString();
    } catch (error) {
      // If URL parsing fails, try simple string manipulation
      let modifiedUrl = url;
      
      // For YouTube, add enablejsapi=1
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        if (!url.includes('enablejsapi=')) {
          const separator = url.includes('?') ? '&' : '?';
          modifiedUrl = `${url}${separator}enablejsapi=1`;
        }
      }
      
      return modifiedUrl;
    }
  }

  get text(): string {
    if (this.currentContent?.type === "text" && this.currentContent.content) {
      let content = this.currentContent.content as string;
      // Remove chords if hidden (for local display)
      if (this.chordDisplayState === 'hidden') {
        content = this.removeChordsFromContent(content);
      }
      return content;
    }
    return "";
  }

  get backgroundColor(): string {
    return this.currentContent?.background_color || "#000000";
  }

  get fontColor(): string {
    return this.currentContent?.font_color || "#FFFFFF";
  }

  get textContainerStyle(): { [key: string]: string } {
    const style: { [key: string]: string } = {
      'background-color': this.backgroundColor
    };
    
    // Apply CSS custom properties from library item if present
    if (this.currentContent?.css && typeof this.currentContent.css === 'object') {
      Object.assign(style, this.currentContent.css);
    }
    
    return style;
  }

  get textContentStyle(): { [key: string]: string } {
    return {
      'color': this.fontColor
    };
  }

  get imageContainerStyle(): { [key: string]: string } {
    // Container style only has background color - layout properties are in CSS
    return {
      'background-color': this.backgroundColor
    };
  }

  get imageStyle(): { [key: string]: string } {
    const style: { [key: string]: string } = {};
    
    // Apply CSS custom properties from library item to the image element itself
    // Only apply safe properties that won't break the image display
    if (this.currentContent?.css && typeof this.currentContent.css === 'object') {
      const cssObj = this.currentContent.css;
      const safeProperties = Object.keys(cssObj).filter(key => {
        // Only allow CSS custom properties (--*) or safe styling properties
        // Exclude layout-critical properties for image element (display is OK for img, but exclude flex properties)
        const layoutProperties = ['flex', 'flex-direction', 'align-items', 'justify-content', 'overflow', 'position'];
        return key.startsWith('--') || !layoutProperties.includes(key);
      });
      
      safeProperties.forEach(key => {
        style[key] = cssObj[key];
      });
    }
    
    return style;
  }

  get videoContainerStyle(): { [key: string]: string } {
    // Container style only has background color - layout properties are in CSS
    return {
      'background-color': this.backgroundColor
    };
  }

  getPlaylistItemType(item: LibraryItem): string {
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  }

  onPlaylistItemsLoaded(items: LibraryItem[]): void {
    this.playlistItems = items;
    // Debug: log items to check if pages are set correctly
    console.log('Playlist items loaded:', items.map(item => ({ 
      guid: item.guid, 
      name: item.name, 
      pages: item.pages 
    })));
  }

  onPlaylistItemClick(item: LibraryItem): void {
    if (item.guid) {
      // Debug: log item pages
      console.log('onPlaylistItemClick - item.pages:', item.pages, 'for item:', item.name);
      
      // Store the item and its selected pages for navigation
      this.manualItem = item;
      
      // Always use pages from the playlist item if it exists
      // The server should have already filtered pages based on playlist selection
      if (item.pages !== undefined && Array.isArray(item.pages)) {
        // Use the pages from the playlist (either filtered selected pages or all pages)
        this.manualItemPages = item.pages.length > 0 ? item.pages : [];
        console.log('onPlaylistItemClick - using item.pages:', this.manualItemPages);
      } else {
        // If pages is not set, it shouldn't happen, but fallback to loading from library
        // This should only happen if server didn't set pages property
        console.warn('onPlaylistItemClick - item.pages is not set, loading from library');
        this.manualItemPages = [];
        this.playlistService.getLibraryItemByGuid(item.guid).subscribe({
          next: (fullItem) => {
            if (fullItem && Array.isArray(fullItem.content) && fullItem.content.length > 0) {
              this.manualItemPages = fullItem.content.map((pageContent: any) => pageContent.page || 1);
            } else {
              this.manualItemPages = [1];
            }
            console.log('onPlaylistItemClick - loaded pages from library:', this.manualItemPages);
          },
          error: (error) => {
            console.error("Error loading full library item:", error);
            this.manualItemPages = [];
          }
        });
      }
      
      // If item has pages array (selected pages from playlist), use first page from that array
      // Otherwise default to page 1
      const initialPage = (this.manualItemPages && this.manualItemPages.length > 0) ? this.manualItemPages[0] : 1;
      
      this.handleLibraryItemSelection(item.guid, initialPage, false, item);
    }
  }
  
  /** Load item for page buttons (manualItem/manualItemPages). When item is selected from playlist tab with specific pages, use those; otherwise load full item with all pages. */
  private loadManualItemForPagesIfNeeded(guid: number): void {
    // Only use playlist pages when we're on playlist tab (item was selected from playlist)
    if (this.activeTab === 'playlist') {
      const playlistItem = this.playlistItems.find(i => i.guid === guid);
      if (playlistItem?.pages && Array.isArray(playlistItem.pages) && playlistItem.pages.length > 0) {
        this.manualItem = playlistItem;
        this.manualItemPages = playlistItem.pages;
        this.currentItemName = playlistItem.name;
        return;
      }
    }
    // Item from search/manual or playlist with all pages: load full item and use all pages
    this.playlistService.getLibraryItemByGuid(guid).subscribe({
      next: (fullItem) => {
        if (fullItem && fullItem.guid === this.currentItemGuid) {
          this.manualItem = fullItem;
          this.currentItemName = fullItem.name;
          if (Array.isArray(fullItem.content) && fullItem.content.length > 0) {
            this.manualItemPages = fullItem.content.map((pageContent: { page?: number }) => pageContent.page || 1);
          } else {
            this.manualItemPages = [1];
          }
        }
      }
    });
  }

  handleLibraryItemSelection(guid: number, page: number | undefined, fromSync: boolean = false, item?: LibraryItem): void {
    if (!guid) {
      return;
    }
    
    // Find item in playlist or use provided item
    let selectedItem = item;
    if (!selectedItem) {
      selectedItem = this.playlistItems.find(i => i.guid === guid);
    }
    
    // If still not found, load it
    if (!selectedItem) {
      this.playlistService.getLibraryItemByGuid(guid).subscribe({
        next: (loadedItem) => {
          if (loadedItem) {
            this.updateItemSelection(guid, page || 1, loadedItem, fromSync);
          }
        },
        error: (error) => {
          console.error("Error loading library item:", error);
        }
      });
      return;
    }
    
    this.updateItemSelection(guid, page || 1, selectedItem, fromSync);
  }
  
  updateItemSelection(guid: number, page: number, item: LibraryItem, fromSync: boolean): void {
    this.isReceivingSelection = fromSync;
    
    if (!fromSync) {
      this.recentItemsService.addItem(item);
    }

    // Set manualItem/manualItemPages for page buttons (needed on refresh when SelectLibraryItem received)
    this.manualItem = item;
    this.currentItemName = item.name;
    if (item.pages && item.pages.length > 0) {
      this.manualItemPages = item.pages;
    } else if (Array.isArray(item.content) && item.content.length > 0) {
      this.manualItemPages = item.content.map((p: { page?: number }) => p.page || 1);
    } else {
      this.manualItemPages = [1];
    }
    
    // If this is a new item OR a different page of the same item, reset originalContent tracking
    const isNewItem = guid !== this.currentItemGuid;
    const isDifferentPage = guid === this.currentItemGuid && page !== this.currentPage;
    
    if (isNewItem) {
      this.originalContent = null;
      this.originalContentGuid = null;
      this.originalContentPage = null;
      this.lastContentDurationForItem = null;
      this.resetAutoplayState();
      // Restore chord settings from service (keep selection across items)
      this.chordTransposition = this.chordSettingsService.getChordTransposition();
      this.chordDisplayState = this.chordSettingsService.getChordDisplayState();
      // When fromSync, do NOT clear currentContent — content comes from Change broadcast and may
      // have already arrived; clearing would wipe it and leave preview blank until next Change.
      if (!fromSync) {
        this.currentContent = null;
      }
    } else if (isDifferentPage) {
      // Different page of the same item - reset originalContent for new page content
      this.originalContent = null;
      this.originalContentGuid = null;
      this.originalContentPage = null;
      this.resetAutoplayState();
      if (!fromSync) {
        this.currentContent = null;
      }
    }
    
    // Track manual selections to filter out stale sync messages
    if (!fromSync && this.activeTab === 'manual') {
      this.lastManualSelectionTime = Date.now();
      this.lastManualSelectionGuid = guid;
    }
    
    this.currentItemGuid = guid;
    this.currentPage = page;
    this.currentItemName = item.name;
    this.currentItemIndex = this.playlistItems.findIndex(i => i.guid === guid);
    
    // Send Change message for content display (skip when fromSync - we already have content from reconnect)
    if (!fromSync) {
      const user = this.userService.getUser();
      const changeMessage: any = {
        type: "Change",
        guid: guid,
        page: page,
        chordVisibility: this.chordDisplayState,
        chordTransposition: this.chordTransposition
      };
      if (user?.locationId) {
        changeMessage.locationId = user.locationId;
      }
      this.websocketService.send(JSON.stringify(changeMessage));
    }
    
    // Send SelectLibraryItem message for sync (if not from sync)
    if (!fromSync) {
      const user = this.userService.getUser();
      const selectMessage: any = {
        type: "SelectLibraryItem",
        guid: guid,
        page: page
      };
      if (user?.locationId) {
        selectMessage.locationId = user.locationId;
      }
      this.websocketService.send(JSON.stringify(selectMessage));
    }
    
    this.isReceivingSelection = false;
    this.resetAutoHideTimer();
  }

  onPlaylistItemPageClick(event: { item: LibraryItem; page: number }): void {
    if (event.item.guid) {
      // Store the item and its selected pages for navigation
      this.manualItem = event.item;
      
      // Always use pages from the playlist item if it exists
      // The server should have already filtered pages based on playlist selection
      if (event.item.pages !== undefined && Array.isArray(event.item.pages)) {
        // Use the pages from the playlist (either filtered selected pages or all pages)
        this.manualItemPages = event.item.pages.length > 0 ? event.item.pages : [];
      } else {
        // If pages is not set, it shouldn't happen, but fallback to loading from library
        // This should only happen if server didn't set pages property
        this.manualItemPages = [];
        this.playlistService.getLibraryItemByGuid(event.item.guid).subscribe({
          next: (fullItem) => {
            if (fullItem && Array.isArray(fullItem.content) && fullItem.content.length > 0) {
              this.manualItemPages = fullItem.content.map((pageContent: any) => pageContent.page || 1);
            } else {
              this.manualItemPages = [1];
            }
          },
          error: (error) => {
            console.error("Error loading full library item:", error);
            this.manualItemPages = [];
          }
        });
      }
      
      this.handleLibraryItemSelection(event.item.guid, event.page, false, event.item);
    }
  }
  
  onManualItemSelected(item: LibraryItem, page: number = 1): void {
    this.handleLibraryItemSelection(item.guid, page, false, item);
    this.currentItemIndex = -1; // Not in playlist
    
    // Auto-close sidebar on mobile when item is found
    if (window.innerWidth <= 768 && this.sidebarOpen) {
      this.closeSidebar();
    }
    
    // Fetch full library item details to get pages information
    this.playlistService.getLibraryItemByGuid(item.guid).subscribe({
      next: (fullItem) => {
        if (fullItem) {
          // Store manual item details for navigation
          this.manualItem = fullItem;
          if (Array.isArray(fullItem.content) && fullItem.content.length > 0) {
            this.manualItemPages = fullItem.content.map((pageContent: any) => pageContent.page || 1);
          } else {
            this.manualItemPages = [1];
          }
        }
      },
      error: (error) => {
        console.error("Error loading full library item:", error);
        this.manualItem = item;
        if (Array.isArray(item.content) && item.content.length > 0) {
          this.manualItemPages = item.content.map((pageContent: any) => pageContent.page || 1);
        } else {
          this.manualItemPages = [1];
        }
      }
    });
  }

  private clearAutoHideTimer(): void {
    if (this.autoHideTimerId != null) {
      clearTimeout(this.autoHideTimerId);
      this.autoHideTimerId = null;
    }
  }

  /** Reset auto-hide timer. Call on: item selection, page change, visibility change. */
  private resetAutoHideTimer(): void {
    this.clearAutoHideTimer();
    const user = this.userService.getUser();
    if (
      this.autoHideTimeoutSeconds > 0 &&
      this.contentVisible &&
      user?.locationId
    ) {
      this.autoHideTimerId = setTimeout(() => {
        this.autoHideTimerId = null;
        if (this.contentVisible) {
          this.onVisibilityToggleClick();
        }
      }, this.autoHideTimeoutSeconds * 1000);
    }
  }

  /** Toggle display visibility: green (visible) = show last item, red (hidden) = show blank page */
  onVisibilityToggleClick(): void {
    const user = this.userService.getUser();
    if (!user?.locationId) return;
    if (this.visibilityToggleDisabled) return; // Debounce: prevent double-send
    this.visibilityToggleDisabled = true;
    this.resetAutoplayState(); // Stop autoplay counters when visibility changes
    const visible = !this.contentVisible;
    const msg: any = {
      type: 'SetDisplayVisible',
      locationId: user.locationId,
      visible
    };
    this.websocketService.send(JSON.stringify(msg));
    this.contentVisible = visible;
    this.resetAutoHideTimer();
    // Re-enable after 400ms to allow server response; prevents duplicate sends from double-click
    setTimeout(() => {
      this.visibilityToggleDisabled = false;
    }, 400);
    // Server will send content (blank or last item); don't clear currentItemGuid here (preserve for footer)
    if (!visible) {
      // UI will update from received blank page content; keep currentItemGuid for "what will restore" info
    }
  }

  /** ESC key: hide content (same as legacy Clear) */
  onClearClick(): void {
    if (!this.contentVisible) return; // Already hidden
    this.onVisibilityToggleClick();
  }

  canGoNext(): boolean {
    if (!this.currentItemGuid) return false;
    
    // If manualItem matches current item (from manual, search, or playlist tab), check manual item pages
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex >= 0 && currentPageIndex < this.manualItemPages.length - 1) {
          return true; // Has next page
        }
      }
      // Check if has next item in playlist (only for playlist items)
      if (this.currentItemIndex >= 0) {
        return this.currentItemIndex < this.playlistItems.length - 1;
      }
      return false; // Manual/search items don't have next item
    }
    
    // Playlist tab - check current item
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (!currentItem) return false;
    
    // Check if has more pages
    if (currentItem.pages && currentItem.pages.length > 0) {
      const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
      if (currentPageIndex >= 0 && currentPageIndex < currentItem.pages.length - 1) {
        return true; // Has next page
      }
    }
    
    // Check if has next item in playlist
    if (this.currentItemIndex >= 0) {
      return this.currentItemIndex < this.playlistItems.length - 1;
    }
    
    return false;
  }

  canGoPrevious(): boolean {
    if (!this.currentItemGuid) return false;
    
    // If manualItem matches current item (from manual, search, or playlist tab), check manual item pages
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex > 0) {
          return true; // Has previous page
        }
      }
      // Check if has previous item in playlist (only for playlist items)
      if (this.currentItemIndex > 0) {
        return true;
      }
      return false; // Manual/search items don't have previous item
    }
    
    // Playlist tab - check current item
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (!currentItem) return false;
    
    // Check if has previous pages
    if (currentItem.pages && currentItem.pages.length > 0) {
      const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
      if (currentPageIndex > 0) {
        return true; // Has previous page
      }
    }
    
    // Check if has previous item in playlist
    if (this.currentItemIndex > 0) {
      return true;
    }
    
    return false;
  }

  onNextClick(): void {
    if (!this.currentItemGuid) return;
    
    // Handle playlist tab first (if currentItemIndex >= 0, we're in playlist mode)
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (currentItem && this.currentItemIndex >= 0) {
      // If manualItem matches current item, use manualItemPages for navigation
      if (this.manualItem && this.manualItem.guid === this.currentItemGuid && this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex >= 0 && currentPageIndex < this.manualItemPages.length - 1) {
          // Go to next page using manualItemPages
          const nextPage = this.manualItemPages[currentPageIndex + 1];
          this.onPlaylistItemPageClick({ item: currentItem, page: nextPage });
          return;
        }
        // If on last page of manualItemPages, fall through to go to next item
      }
      
      // Check if has more pages in current item (only if not using manualItemPages)
      if (currentItem.pages && currentItem.pages.length > 0) {
        if (!(this.manualItem && this.manualItem.guid === this.currentItemGuid && this.manualItemPages.length > 0)) {
          const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
          if (currentPageIndex >= 0 && currentPageIndex < currentItem.pages.length - 1) {
            const nextPage = currentItem.pages[currentPageIndex + 1];
            this.onPlaylistItemPageClick({ item: currentItem, page: nextPage });
            return;
          }
        }
      }
      
      // Go to next item in playlist
      if (this.currentItemIndex >= 0 && this.currentItemIndex < this.playlistItems.length - 1) {
        const nextItem = this.playlistItems[this.currentItemIndex + 1];
        this.onPlaylistItemClick(nextItem);
      }
      return;
    }
    
    // Handle manual/search tab - if manualItem matches current item (and NOT in playlist)
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid && this.currentItemIndex < 0) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex >= 0 && currentPageIndex < this.manualItemPages.length - 1) {
          const nextPage = this.manualItemPages[currentPageIndex + 1];
          this.currentPage = nextPage;
          
          const user = this.userService.getUser();
          const changeMessage: any = {
            type: "Change",
            guid: this.manualItem.guid,
            page: nextPage,
            chordVisibility: this.chordDisplayState,
            chordTransposition: this.chordTransposition
          };
          if (user?.locationId) {
            changeMessage.locationId = user.locationId;
          }
          this.websocketService.send(JSON.stringify(changeMessage));
          this.resetAutoHideTimer();
          return;
        }
      }
      // No next available
      return;
    }
    
    // Fallback: if we reach here, item is not in playlist, so nothing to do
  }

  onPreviousClick(): void {
    if (!this.currentItemGuid) return;
    
    // Handle playlist tab first (if currentItemIndex >= 0, we're in playlist mode)
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (currentItem && this.currentItemIndex >= 0) {
      // If manualItem matches current item, use manualItemPages for navigation
      if (this.manualItem && this.manualItem.guid === this.currentItemGuid && this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex > 0) {
          // Go to previous page using manualItemPages
          const prevPage = this.manualItemPages[currentPageIndex - 1];
          this.onPlaylistItemPageClick({ item: currentItem, page: prevPage });
          return;
        }
      }
      
      // Check if has previous pages in current item (only if not using manualItemPages)
      if (currentItem.pages && currentItem.pages.length > 0) {
        if (!(this.manualItem && this.manualItem.guid === this.currentItemGuid && this.manualItemPages.length > 0)) {
          const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
          if (currentPageIndex > 0) {
            const prevPage = currentItem.pages[currentPageIndex - 1];
            this.onPlaylistItemPageClick({ item: currentItem, page: prevPage });
            return;
          }
        }
      }
      
      // Go to previous item in playlist
      if (this.currentItemIndex > 0) {
        const prevItem = this.playlistItems[this.currentItemIndex - 1];
        if (prevItem.pages && prevItem.pages.length > 0) {
          const lastPage = prevItem.pages[prevItem.pages.length - 1];
          this.onPlaylistItemPageClick({ item: prevItem, page: lastPage });
        } else {
          this.onPlaylistItemClick(prevItem);
        }
      }
      return;
    }
    
    // Handle manual/search tab - if manualItem matches current item (and NOT in playlist)
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid && this.currentItemIndex < 0) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex > 0) {
          const prevPage = this.manualItemPages[currentPageIndex - 1];
          this.currentPage = prevPage;
          
          const user = this.userService.getUser();
          const changeMessage: any = {
            type: "Change",
            guid: this.manualItem.guid,
            page: prevPage,
            chordVisibility: this.chordDisplayState,
            chordTransposition: this.chordTransposition
          };
          if (user?.locationId) {
            changeMessage.locationId = user.locationId;
          }
          this.websocketService.send(JSON.stringify(changeMessage));
          this.resetAutoHideTimer();
          return;
        }
      }
      // No previous available
      return;
    }
    
    // Fallback: if we reach here, item is not in playlist, so nothing to do
  }

  getAvailablePages(): number[] {
    if (!this.currentItemGuid) return [];
    
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid) {
      if (this.manualItemPages && this.manualItemPages.length > 0) {
        return this.manualItemPages;
      }
      if (this.manualItem.pages && this.manualItem.pages.length > 0) {
        return this.manualItem.pages;
      }
    }
    
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (currentItem?.pages && currentItem.pages.length > 0) {
      return currentItem.pages;
    }
    
    return [];
  }

  onPageButtonClick(pageNum: number): void {
    if (!this.currentItemGuid) return;
    
    // Handle manual/search tab - if manualItem matches current item
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid) {
      this.resetAutoplayState();
      this.currentPage = pageNum;
      const user = this.userService.getUser();
      const changeMessage: any = {
        type: "Change",
        guid: this.manualItem.guid,
        page: pageNum,
        chordVisibility: this.chordDisplayState,
        chordTransposition: this.chordTransposition
      };
      if (user?.locationId) {
        changeMessage.locationId = user.locationId;
      }
      this.websocketService.send(JSON.stringify(changeMessage));
      return;
    }
    
    // Handle playlist tab
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (!currentItem) return;
    
    this.onPlaylistItemPageClick({ item: currentItem, page: pageNum });
  }

  handleKeyboardEvent(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    
    // Check if the event is coming from an iframe by checking if target is iframe or inside iframe
    const isFromIframe = target.tagName === 'IFRAME' || 
                         (target.nodeName && target.nodeName.toLowerCase() === 'iframe') ||
                         target.closest('iframe') !== null ||
                         (event.view && event.view !== window);

    // Don't handle keyboard events if user is typing in an input field (unless it's from iframe)
    if (!isFromIframe) {
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
    }

    const key = event.key;

    // Handle ESC key for Clear command
    if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.onClearClick();
      // Blur iframe to prevent it from capturing focus
      if (isFromIframe) {
        this.blurIframe();
      }
      return;
    }

    // Handle arrow keys for page navigation (only when content is displayed)
    if ((key === 'ArrowRight' || key === 'ArrowDown') && this.currentItemGuid) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.onNextClick();
      // Blur iframe to prevent it from capturing focus
      if (isFromIframe) {
        this.blurIframe();
      }
      return;
    }

    if ((key === 'ArrowLeft' || key === 'ArrowUp') && this.currentItemGuid) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.onPreviousClick();
      // Blur iframe to prevent it from capturing focus
      if (isFromIframe) {
        this.blurIframe();
      }
      return;
    }

    // Only handle other keyboard events when manual component is active
    if (this.activeTab !== 'manual' || !this.manualComponent) {
      return;
    }

    // Handle number keys (0-9)
    if (key >= '0' && key <= '9') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.manualComponent.onNumberClick(key);
      // Blur iframe to prevent it from capturing focus
      if (isFromIframe) {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe: HTMLIFrameElement) => {
          try {
            // Try to blur the iframe's content window
            if (iframe.contentWindow) {
              iframe.contentWindow.blur();
            }
          } catch (e) {
            // Cross-origin iframe - can't access contentWindow
          }
        });
        // Blur any active element
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur();
        }
      }
      return;
    }

    // Handle Enter key
    if (key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.manualComponent.onEnterClick();
      // Blur iframe to prevent it from capturing focus
      if (isFromIframe) {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe: HTMLIFrameElement) => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.blur();
            }
          } catch (e) {
            // Cross-origin iframe - can't access contentWindow
          }
        });
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur();
        }
      }
      return;
    }

    // Handle Backspace key
    if (key === 'Backspace') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.manualComponent.onBackspaceClick();
      // Blur iframe to prevent it from capturing focus
      if (isFromIframe) {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach((iframe: HTMLIFrameElement) => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.blur();
            }
          } catch (e) {
            // Cross-origin iframe - can't access contentWindow
          }
        });
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur();
        }
      }
      return;
    }
  }

  private blurIframe(): void {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe: HTMLIFrameElement) => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.blur();
        }
      } catch (e) {
        // Cross-origin iframe - can't access contentWindow
      }
    });
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
  }

  onMainContainerFocus(): void {
    // Container is focused - keyboard events should work
  }

  onMainContainerBlur(): void {
    // If manual tab is active and URL content is displayed, maintain focus on container
    if (this.activeTab === 'manual' && this.currentContent?.type === 'url' && this.shouldMaintainFocus) {
      setTimeout(() => {
        const mainContainer = document.querySelector('.main-container') as HTMLElement;
        if (mainContainer && document.activeElement?.tagName === 'IFRAME') {
          mainContainer.focus();
        }
      }, 10);
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    // Close sidebar when entering fullscreen
    if (this.isFullscreen) {
      this.sidebarOpen = false;
    }
    // Recalculate font size after fullscreen toggle (container size changed)
    if (this.currentContent?.type === "text") {
      setTimeout(() => {
        this.adjustTextSize();
      }, 100);
    }
  }

  exitFullscreen(): void {
    this.isFullscreen = false;
    // Recalculate font size after exiting fullscreen (container size changed)
    if (this.currentContent?.type === "text") {
      setTimeout(() => {
        this.adjustTextSize();
      }, 100);
    }
  }

  toggleChordDisplay(): void {
    // Cycle through the three states: everywhere -> local -> hidden -> everywhere
    if (this.chordDisplayState === 'everywhere') {
      this.chordDisplayState = 'local';
      this.chordSettingsService.setChordDisplayState('local');
      // Restore original content for local display (chords visible in admin)
      this.restoreOriginalContent();
      // Broadcast to clients with chordsVisible: false (hide on clients, show in admin)
      this.broadcastContentUpdate();
      // Update local display separately
      this.updateLocalContent();
    } else if (this.chordDisplayState === 'local') {
      this.chordDisplayState = 'hidden';
      this.chordSettingsService.setChordDisplayState('hidden');
      // Restore original content before broadcasting (to ensure chords are in content)
      if (this.currentContent?.type === 'text' && this.originalContent) {
        this.currentContent.content = this.originalContent;
        // Apply transposition if needed
        if (this.chordTransposition !== 0) {
          this.applyChordTranspositionToContent();
        }
      }
      // Broadcast to hide everywhere
      this.broadcastContentUpdate();
    } else {
      this.chordDisplayState = 'everywhere';
      this.chordSettingsService.setChordDisplayState('everywhere');
      // If we don't have original content with chords, request it from server
      if (this.currentContent?.type === 'text' && this.currentItemGuid) {
        const hasChordsInOriginal = this.originalContent && /<chord\b[^>]*>.*?<\/chord>/gi.test(this.originalContent);
        if (!hasChordsInOriginal) {
          // Request content again with chordsVisible=true to get original content with chords
          this.requestContentWithChords();
          return;
        }
      }
      // Restore original content before broadcasting (to ensure chords are in content)
      this.restoreOriginalContent();
      // Broadcast to show everywhere
      this.broadcastContentUpdate();
    }
  }
  
  /**
   * Request content from server with chords for local admin display.
   * Sends chordVisibility so server keeps client state (e.g. 'local' = clients stay chordless).
   */
  private requestContentWithChords(): void {
    if (!this.currentItemGuid) {
      return;
    }
    // Skip if we just received content (prevents multi-admin loop - don't re-request immediately)
    const now = Date.now();
    if ((now - this.lastContentReceivedAt) < PlaylistViewComponent.REQUEST_CHORDS_DEBOUNCE_MS) {
      return;
    }
    
    const user = this.userService.getUser();
    const changeMessage: any = {
      type: "Change",
      guid: this.currentItemGuid,
      page: this.currentPage || 1,
      chordVisibility: this.chordDisplayState, // Preserve state so clients don't get chords
      chordTransposition: this.chordSettingsService.getChordTransposition()
    };
    if (user?.locationId) {
      changeMessage.locationId = user.locationId;
    }
    // Reset originalContent tracking so we'll store the fresh content
    this.originalContent = null;
    this.originalContentGuid = null;
    this.originalContentPage = null;
    this.websocketService.send(JSON.stringify(changeMessage));
  }
  
  /**
   * Restore original content with chords and apply transposition if needed
   */
  private restoreOriginalContent(): void {
    if (this.currentContent?.type === 'text' && this.originalContent) {
      this.currentContent.content = this.originalContent;
      // Apply transposition if needed
      if (this.chordTransposition !== 0) {
        this.applyChordTranspositionToContent();
      }
    }
  }
  
  private updateLocalContent(): void {
    if (!this.currentContent) {
      return;
    }

    // Restore original content first (to ensure we have chords if needed)
    this.restoreOriginalContent();

    // Update local display
    setTimeout(() => {
      if (this.currentContent?.type === "text") {
        this.adjustTextSize();
      }
    }, 100);
  }

  increaseChordTransposition(): void {
    const current = this.chordTransposition || 0;
    this.chordTransposition = (12 + current + 1) % 12;
    this.chordSettingsService.setChordTransposition(this.chordTransposition);
    this.applyChordTranspositionToContent();
    this.broadcastContentUpdate();
    this.cdr.detectChanges();
  }

  decreaseChordTransposition(): void {
    const current = this.chordTransposition || 0;
    this.chordTransposition = (12 + current - 1) % 12;
    this.chordSettingsService.setChordTransposition(this.chordTransposition);
    this.applyChordTranspositionToContent();
    this.broadcastContentUpdate();
    this.cdr.detectChanges();
  }

  resetChordTransposition(): void {
    this.chordTransposition = 0;
    this.chordSettingsService.resetChordTransposition();
    this.applyChordTranspositionToContent();
    this.broadcastContentUpdate();
    this.cdr.detectChanges();
  }

  private extractOriginalContent(content: string): string {
    // Store the original content as-is
    // This will be used as the base for all transpositions
    return content;
  }

  private transposeChord(chordName: string, semitones: number): string {
    if (!chordName || semitones === 0) {
      return chordName;
    }

    // Normalize step to range 0-12 (the transpose function uses step from 0-12)
    const step = ((semitones % 12) + 12) % 12;

    // Define chord arrays matching the transpose function exactly
    const dur = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'];
    const mol = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'b', 'h'];
    const chi = ['4', '7', 'maj7', 'dim', '5b', 'sus4', '6', '7/5#', '7/5b', '7/6', '7/4', '9', '9/5', '9/5b'];

    // Helper function to find the longest matching part index (from transpose function)
    function partIndex(str: string, parts: string[]): number {
      let matchLen = 0;
      let matchIndex = -1;
      for (let i = 0; i < parts.length; i++) {
        if (str.startsWith(parts[i])) {
          if (parts[i].length > matchLen) {
            matchIndex = i;
            matchLen = parts[i].length;
          }
        }
      }
      return matchIndex;
    }

    // Process the chord text following the transpose function logic exactly
    let txt = chordName;
    const ret: Array<{ b?: string; chord?: boolean; chi?: string }> = [];

    while (txt.length > 0) {
      let r: { b?: string; chord?: boolean; chi?: string } = {};
      let l = dur;
      let b = partIndex(txt, l);
      
      if (b === -1) {
        l = mol;
        b = partIndex(txt, l);
      }
      
      if (b !== -1) {
        // Found a valid chord - transpose it
        r.b = l[(b + step + l.length) % l.length];
        txt = txt.substring(l[b].length);
        r.chord = true;
        
        // Check for chi suffix after the chord
        b = partIndex(txt, chi);
        if (b !== -1) {
          r.chi = chi[b];
          txt = txt.substring(chi[b].length);
        }
      } else {
        // No chord match - accumulate character (preserves unmatched chars like "#", "/", etc.)
        if (ret.length > 0 && !ret[ret.length - 1].chord) {
          r = ret.pop()!;
        }
        r.b = (r.b ? r.b : '') + txt.substring(0, 1);
        txt = txt.substring(1);
      }
      
      ret.push(r);
    }

    // Build the transposed chord string - return r.b + r.chi values joined together
    // This matches how the original function's result array should be converted to a string
    return ret.map(item => {
      let result = item.b || '';
      if (item.chi) {
        result += item.chi;
      }
      return result;
    }).join('');
  }

  private applyChordTranspositionToContent(): void {
    if (!this.originalContent || !this.currentContent || this.currentContent.type !== 'text' || this.chordTransposition === 0) {
      // If no transposition, use original content
      if (this.currentContent && this.originalContent) {
        this.currentContent.content = this.originalContent;
      }
      return;
    }

    // Transpose all chords in chord tags, handling chi tags inside them
    const modifiedContent = this.originalContent.replace(
      /<chord\b([^>]*)>(.*?)<\/chord>/gi,
      (match, attributes, chordContent) => {
        // Parse chord content that may contain chi tags
        // Example: "C<chi>7</chi>" or "Am<chi>7</chi>" or just "C7" or "C Am"
        let processedContent = chordContent;
        
        // Extract chi tags and their content, replace with placeholders
        const chiPlaceholders: Array<{placeholder: string, chiContent: string}> = [];
        let chiIndex = 0;
        
        processedContent = processedContent.replace(
          /<chi\b[^>]*>(.*?)<\/chi>/gi,
          (chiMatch: string, chiContent: string) => {
            const placeholder = `__CHI_PLACEHOLDER_${chiIndex}__`;
            chiPlaceholders.push({ placeholder, chiContent });
            chiIndex++;
            return placeholder;
          }
        );
        
        // Now transpose the chord text (without chi tags)
        // The transposeChord function handles all parsing, so we just pass the entire content
        // Split by chi placeholders to process chord parts separately
        const chiPlaceholderRegex = /(__CHI_PLACEHOLDER_\d+__)/g;
        const segments = processedContent.split(chiPlaceholderRegex);
        
        const transposedSegments = segments.map((segment: string) => {
          // If it's a chi placeholder, keep it as-is (will be restored later)
          if (segment.match(/^__CHI_PLACEHOLDER_\d+__$/)) {
            return segment;
          }
          
          // Otherwise, transpose the entire segment - the transpose function handles all parsing
          return this.transposeChord(segment, this.chordTransposition);
        });
        
        let transposedChord = transposedSegments.join('');
        
        // Restore chi tags
        chiPlaceholders.forEach(({ placeholder, chiContent }) => {
          transposedChord = transposedChord.replace(
            new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            `<chi>${chiContent}</chi>`
          );
        });

        return `<chord${attributes ? ' ' + attributes.trim() : ''}>${transposedChord}</chord>`;
      }
    );

    // Update current content - assign new reference to ensure Angular detects change
    if (this.currentContent && modifiedContent) {
      this.currentContent = { ...this.currentContent, content: modifiedContent };
    }
  }

  /**
   * Remove all chord tags from content string
   */
  private removeChordsFromContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return content;
    }
    // Remove all <chord> tags and their content
    return content.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
  }

  private broadcastContentUpdate(): void {
    if (!this.currentContent) {
      return;
    }

    const user = this.userService.getUser();

    // For text: send two fields so server can route correctly:
    //   content    = transposed content  → forwarded to display clients as-is
    //   rawContent = untransposed original → forwarded to other admins so they never
    //                                        store pre-transposed text as their originalContent
    // For non-text: single content field (no transposition concept).
    let contentToSend: string | undefined;
    let rawContentToSend: string | undefined;
    if (this.currentContent.type === 'text' && this.originalContent) {
      // Build transposed version without mutating currentContent permanently
      rawContentToSend = this.originalContent;
      if (this.chordTransposition !== 0) {
        this.restoreOriginalContent(); // sets currentContent.content = original + transposition
        contentToSend = this.currentContent.content as string;
      } else {
        contentToSend = this.originalContent;
      }
    } else {
      contentToSend = this.currentContent.content as string;
    }

    // Only send if we have valid content and locationId
    if (!contentToSend || !user?.locationId) {
      return;
    }

    const message: any = {
      type: this.currentContent.type,
      content: contentToSend,
      rawContent: rawContentToSend,
      guid: this.currentContent.guid,
      page: this.currentContent.page,
      background_color: this.currentContent.background_color,
      font_color: this.currentContent.font_color,
      css: this.currentContent.css,
      chordVisibility: this.chordDisplayState,
      chordTransposition: this.chordTransposition,
      locationId: user.locationId
    };

    // Send as direct content update message (server will broadcast to all clients)
    this.websocketService.send(JSON.stringify(message));
    
    // Also update local display (except for 'local' state which is handled separately in toggleChordDisplay)
    if (this.chordDisplayState !== 'local') {
      setTimeout(() => {
        if (this.currentContent?.type === "text") {
          this.adjustTextSize();
        }
      }, 100);
    }
  }

  getChordDisplayIcon(): string {
    if (this.chordDisplayState === 'everywhere') {
      return 'fa-globe';
    } else if (this.chordDisplayState === 'local') {
      return 'fa-desktop';
    } else {
      return 'fa-eye-slash';
    }
  }

  getChordDisplayTitle(): 'showChordsEverywhere' | 'showChordsLocally' | 'hideChords' {
    if (this.chordDisplayState === 'everywhere') {
      return 'showChordsEverywhere';
    } else if (this.chordDisplayState === 'local') {
      return 'showChordsLocally';
    } else {
      return 'hideChords';
    }
  }
}

