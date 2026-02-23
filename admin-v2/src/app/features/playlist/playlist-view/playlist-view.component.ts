import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
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
import { KeyboardCommandService } from "../../../core/services/keyboard-command.service";
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


  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer,
    private playlistService: PlaylistService,
    private userService: UserService,
    private chordSettingsService: ChordSettingsService,
    private keyboardCommandService: KeyboardCommandService
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
          this.loadManualItemForPages(storedContent.guid);
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

      if (message.type === 'SelectLibraryItem' && message.guid !== undefined) {
        // Only process if locationId matches (or if no locationId in message)
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          // Ignore stale sync messages that don't match our current selection
          // This prevents old SelectLibraryItem messages from overwriting new manual selections
          const now = Date.now();
          const timeSinceLastManualSelection = now - this.lastManualSelectionTime;
          
          // If we just made a manual selection (within last 2 seconds) and this sync message
          // is for a different GUID, ignore it (it's likely stale)
          if (timeSinceLastManualSelection < 2000 && 
              this.lastManualSelectionGuid !== undefined && 
              message.guid !== this.lastManualSelectionGuid) {
            console.log(`Ignoring stale SelectLibraryItem sync for guid ${message.guid}, current selection is ${this.lastManualSelectionGuid}`);
            return;
          }
          
          // Also ignore if we have a current selection and this sync message is for a different item
          // (unless we don't have a selection yet, in which case allow sync to set it)
          if (this.currentItemGuid !== undefined && 
              message.guid !== this.currentItemGuid &&
              this.activeTab === 'manual') {
            console.log(`Ignoring SelectLibraryItem sync for guid ${message.guid}, current selection is ${this.currentItemGuid}`);
            return;
          }
          
          this.handleLibraryItemSelection(message.guid, message.page, true);
        }
        return;
      }

      // Handle content messages
      if (message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video' || message.type === 'iframe') {
        // Update contentVisible from message (server includes it so admin has correct toggle state on load)
        if (message.contentVisible !== undefined) {
          this.contentVisible = message.contentVisible;
        }
        // Determine the GUID for this message
        const messageGuid = message.guid !== undefined ? message.guid : this.currentItemGuid;
        
        // Check if this message is for the current item (to avoid processing stale messages)
        if (messageGuid !== undefined && this.currentItemGuid !== undefined && messageGuid !== this.currentItemGuid) {
          // This message is for a different item, ignore it completely
          return;
        }
        
        // Update currentContent with the received message
        this.currentContent = { ...message };
        
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
        if (message.guid !== undefined) {
          this.loadManualItemForPages(message.guid);
        }
        
        // Always use service value for chord display state (preserve user's selection)
        // Only update from message if we don't have a stored preference yet (initial load)
        if (message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video' || message.type === 'iframe') {
          // Always restore from service to preserve user's chord display preference
          this.chordDisplayState = this.chordSettingsService.getChordDisplayState();
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
          
          // Only update originalContent if:
          // 1. This is a new item (different GUID), OR
          // 2. This is a different page of the same item (different page), OR
          // 3. We don't have originalContent yet for this item/page combination
          const isNewItemOrPage = (messageGuid !== undefined && messageGuid !== this.originalContentGuid) ||
                                  (messagePage !== undefined && messagePage !== this.originalContentPage) ||
                                  (messageGuid !== undefined && messagePage !== undefined && 
                                   (this.originalContentGuid === null || this.originalContentPage === null));
          const shouldUpdateOriginal = isNewItemOrPage || (this.originalContentGuid === null && hasChords);
          
          if (shouldUpdateOriginal && hasChords) {
            // Store as original content (with chords) - this is the TRUE original, untransposed
            this.originalContent = this.extractOriginalContent(receivedContent);
            if (messageGuid !== undefined) {
              this.originalContentGuid = messageGuid;
            } else if (this.currentItemGuid !== undefined) {
              this.originalContentGuid = this.currentItemGuid;
            }
            if (messagePage !== undefined) {
              this.originalContentPage = messagePage;
            } else if (this.currentPage !== undefined) {
              this.originalContentPage = this.currentPage;
            }
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
        }

        // Adjust font size for text after view update
        if (message.type === "text") {
          setTimeout(() => this.adjustTextSize(), 100);
        }

        // If received message's chordsVisible doesn't match what clients should see, rebroadcast
        // This ensures clients always get the correct visibility state
        // Skip rebroadcast when message has contentVisible - those are authoritative server pushes
        // (visibility toggle, connection/reconnect). Each admin would rebroadcast otherwise = N duplicates for N admins.
        if ((message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video') &&
            message.contentVisible === undefined) {
          const expectedChordsVisible = this.chordsVisibleForClients;
          if (message.chordsVisible !== undefined && 
              message.chordsVisible !== expectedChordsVisible &&
              this.currentContent) {
            setTimeout(() => {
              if (this.chordsVisibleForClients !== message.chordsVisible && this.currentContent) {
                this.broadcastContentUpdate();
              }
            }, 50);
          }
        }

        // If URL content is loaded, ensure focus stays on main container for keyboard handling
        if (message.type === "url" && this.activeTab === 'manual') {
          setTimeout(() => {
            const mainContainer = document.querySelector('.main-container') as HTMLElement;
            if (mainContainer) {
              mainContainer.focus();
              this.shouldMaintainFocus = true;
            }
          }, 100);
        }

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
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("keydown", this.keyboardHandler, true);
    document.removeEventListener("keydown", this.keyboardHandler, true);
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
    // Clear manual item tracking when switching tabs
    if (tab === 'playlist') {
      this.manualItem = null;
      this.manualItemPages = [];
    }
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
            if (fullItem && fullItem.type === 'text') {
              if (Array.isArray(fullItem.content)) {
                // Extract page numbers from content array
                this.manualItemPages = fullItem.content.map((pageContent: any) => pageContent.page || 1);
              } else {
                // Single page item
                this.manualItemPages = [1];
              }
            } else {
              this.manualItemPages = [];
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
  
  /** Load full library item for page buttons (manualItem/manualItemPages) - used on refresh and when content received */
  private loadManualItemForPages(guid: number): void {
    this.playlistService.getLibraryItemByGuid(guid).subscribe({
      next: (fullItem) => {
        if (fullItem && fullItem.guid === this.currentItemGuid) {
          this.manualItem = fullItem;
          this.currentItemName = fullItem.name;
          if (fullItem.type === 'text' && Array.isArray(fullItem.content)) {
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
    
    // Set manualItem/manualItemPages for page buttons (needed on refresh when SelectLibraryItem received)
    this.manualItem = item;
    this.currentItemName = item.name;
    if (item.type === 'text') {
      // Prefer playlist item's pages (filtered selection) when available
      this.manualItemPages = (item.pages && item.pages.length > 0)
        ? item.pages
        : (Array.isArray(item.content) ? item.content.map((p: { page?: number }) => p.page || 1) : [1]);
    } else {
      this.manualItemPages = [];
    }
    
    // If this is a new item OR a different page of the same item, reset originalContent tracking
    const isNewItem = guid !== this.currentItemGuid;
    const isDifferentPage = guid === this.currentItemGuid && page !== this.currentPage;
    
    if (isNewItem) {
      this.originalContent = null;
      this.originalContentGuid = null;
      this.originalContentPage = null;
      // Restore chord settings from service (keep selection across items)
      this.chordTransposition = this.chordSettingsService.getChordTransposition();
      this.chordDisplayState = this.chordSettingsService.getChordDisplayState();
      // Clear current content immediately to avoid showing old item while waiting for new one
      this.currentContent = null;
    } else if (isDifferentPage) {
      // Different page of the same item - reset originalContent for new page content
      this.originalContent = null;
      this.originalContentGuid = null;
      this.originalContentPage = null;
      // Clear current content to avoid showing old page while waiting for new one
      this.currentContent = null;
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
        chordsVisible: this.chordsVisibleForClients, // Send correct visibility for clients
        chordTransposition: this.chordTransposition // Include current chord transposition
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
            if (fullItem && fullItem.type === 'text') {
              if (Array.isArray(fullItem.content)) {
                // Extract page numbers from content array
                this.manualItemPages = fullItem.content.map((pageContent: any) => pageContent.page || 1);
              } else {
                // Single page item
                this.manualItemPages = [1];
              }
            } else {
              this.manualItemPages = [];
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
          if (fullItem.type === 'text') {
            if (Array.isArray(fullItem.content)) {
              // Extract page numbers from content array
              this.manualItemPages = fullItem.content.map((pageContent: any) => pageContent.page || 1);
            } else {
              // Single page item
              this.manualItemPages = [1];
            }
          } else {
            this.manualItemPages = [];
          }
        }
      },
      error: (error) => {
        console.error("Error loading full library item:", error);
        this.manualItem = item;
        // Fallback: extract pages from item if available
        if (item.type === 'text' && Array.isArray(item.content)) {
          this.manualItemPages = item.content.map((pageContent: any) => pageContent.page || 1);
        } else {
          this.manualItemPages = [];
        }
      }
    });
  }

  /** Toggle display visibility: green (visible) = show last item, red (hidden) = show blank page */
  onVisibilityToggleClick(): void {
    const user = this.userService.getUser();
    if (!user?.locationId) return;
    if (this.visibilityToggleDisabled) return; // Debounce: prevent double-send
    this.visibilityToggleDisabled = true;
    const visible = !this.contentVisible;
    const msg: any = {
      type: 'SetDisplayVisible',
      locationId: user.locationId,
      visible
    };
    this.websocketService.send(JSON.stringify(msg));
    this.contentVisible = visible;
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
    if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
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
    if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
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
      if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
        // Only check currentItem.pages if we're not using manualItemPages
        if (!(this.manualItem && this.manualItem.guid === this.currentItemGuid && this.manualItemPages.length > 0)) {
          const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
          if (currentPageIndex >= 0 && currentPageIndex < currentItem.pages.length - 1) {
            // Go to next page
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
            chordsVisible: this.chordsVisibleForClients,
            chordTransposition: this.chordTransposition
          };
          if (user?.locationId) {
            changeMessage.locationId = user.locationId;
          }
          this.websocketService.send(JSON.stringify(changeMessage));
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
      if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
        // Only check currentItem.pages if we're not using manualItemPages
        if (!(this.manualItem && this.manualItem.guid === this.currentItemGuid && this.manualItemPages.length > 0)) {
          const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
          if (currentPageIndex > 0) {
            // Go to previous page
            const prevPage = currentItem.pages[currentPageIndex - 1];
            this.onPlaylistItemPageClick({ item: currentItem, page: prevPage });
            return;
          }
        }
      }
      
      // Go to previous item in playlist
      if (this.currentItemIndex > 0) {
        const prevItem = this.playlistItems[this.currentItemIndex - 1];
        // Get last page if text item, otherwise just click
        if (prevItem.type === 'text' && prevItem.pages && prevItem.pages.length > 0) {
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
            chordsVisible: this.chordsVisibleForClients,
            chordTransposition: this.chordTransposition
          };
          if (user?.locationId) {
            changeMessage.locationId = user.locationId;
          }
          this.websocketService.send(JSON.stringify(changeMessage));
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
    
    // Handle manual/search tabs - if manualItem matches current item, use manualItemPages
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid) {
      // If manualItemPages is set, use it (for playlist items with selected pages)
      if (this.manualItemPages && this.manualItemPages.length > 0) {
        console.log('getAvailablePages - using manualItemPages:', this.manualItemPages);
        return this.manualItemPages;
      }
      // Otherwise, if manualItem has pages array, use that
      if (this.manualItem.pages && this.manualItem.pages.length > 0) {
        console.log('getAvailablePages - using manualItem.pages:', this.manualItem.pages);
        return this.manualItem.pages;
      }
    }
    
    // Handle playlist tab - check if current item is in playlist
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (currentItem) {
      // Return pages for text items
      if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
        console.log('getAvailablePages - using currentItem.pages:', currentItem.pages);
        return currentItem.pages;
      }
    }
    
    console.log('getAvailablePages - returning empty array');
    return [];
  }

  onPageButtonClick(pageNum: number): void {
    if (!this.currentItemGuid) return;
    
    // Handle manual/search tab - if manualItem matches current item
    if (this.manualItem && this.manualItem.guid === this.currentItemGuid) {
      this.currentPage = pageNum;
      const user = this.userService.getUser();
      const changeMessage: any = {
        type: "Change",
        guid: this.manualItem.guid,
        page: pageNum,
        chordsVisible: this.chordsVisibleForClients,
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
   * Request content from server with chordsVisible=true to get original content with chords
   */
  private requestContentWithChords(): void {
    if (!this.currentItemGuid) {
      return;
    }
    
    const user = this.userService.getUser();
    const changeMessage: any = {
      type: "Change",
      guid: this.currentItemGuid,
      page: this.currentPage || 1,
      chordsVisible: true, // Request content with chords
      chordTransposition: this.chordSettingsService.getChordTransposition() // Use current transposition
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
    // Increase by half a tone (semitone)
    // Use modulo 12 arithmetic like Pevec system: (12 + current + 1) % 12
    const current = this.chordTransposition || 0;
    this.chordTransposition = (12 + current + 1) % 12;
    this.chordSettingsService.setChordTransposition(this.chordTransposition);
    this.applyChordTranspositionToContent();
    this.broadcastContentUpdate();
  }

  decreaseChordTransposition(): void {
    // Decrease by half a tone (semitone)
    // Use modulo 12 arithmetic like Pevec system: (12 + current - 1) % 12
    const current = this.chordTransposition || 0;
    this.chordTransposition = (12 + current - 1) % 12;
    this.chordSettingsService.setChordTransposition(this.chordTransposition);
    this.applyChordTranspositionToContent();
    this.broadcastContentUpdate();
  }

  resetChordTransposition(): void {
    // Reset transposition to 0
    this.chordTransposition = 0;
    this.chordSettingsService.resetChordTransposition();
    this.applyChordTranspositionToContent();
    this.broadcastContentUpdate();
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

    // Update current content
    if (this.currentContent.content) {
      this.currentContent.content = modifiedContent;
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
    
    // For 'local' state, restore original content first (to ensure we have chords)
    // We'll send this to clients with chordsVisible: false
    if (this.chordDisplayState === 'local') {
      this.restoreOriginalContent();
    } else if (this.chordDisplayState === 'everywhere' || this.chordDisplayState === 'hidden') {
      // For 'everywhere' or 'hidden', restore original content first
      this.restoreOriginalContent();
    }

    // Always send content with chords - let clients handle visibility via chordsVisible flag
    // This allows clients to toggle visibility without re-requesting content
    const contentToSend = this.currentContent.content;

    // Determine chordsVisible based on state:
    // - 'everywhere': true (show on clients)
    // - 'local': false (hide on clients, show in admin only)
    // - 'hidden': false (hide everywhere)
    const chordsVisibleForClients = this.chordsVisibleForClients;

    // Only send if we have valid content and locationId
    if (!contentToSend || !user?.locationId) {
      return;
    }

    const message: any = {
      type: this.currentContent.type,
      content: contentToSend,
      background_color: this.currentContent.background_color,
      font_color: this.currentContent.font_color,
      chordsVisible: chordsVisibleForClients,
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

