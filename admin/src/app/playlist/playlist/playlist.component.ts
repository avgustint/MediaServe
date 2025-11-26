import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "../../websocket.service";
import { LibraryItem, PlaylistService } from "../../playlist.service";
import { PlaylistListComponent } from "../playlist-list/playlist-list.component";
import { ManualComponent } from "../manual/manual.component";
import { SearchComponent } from "../search/search.component";
import { TranslatePipe } from "../../translation.pipe";
import { FormatTextPipe } from "../../format-text.pipe";
import { UserService } from "../../user.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-playlist",
  standalone: true,
  imports: [CommonModule, PlaylistListComponent, ManualComponent, SearchComponent, TranslatePipe, FormatTextPipe],
  templateUrl: "./playlist.component.html",
  styleUrls: ["./playlist.component.scss"]
})
export class PlaylistComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("textContainer", { static: false }) textContainer!: ElementRef<HTMLDivElement>;
  @ViewChild("imageContainer", { static: false }) imageContainer!: ElementRef<HTMLDivElement>;
  @ViewChild(ManualComponent, { static: false }) manualComponent!: ManualComponent;

  currentContent: WebSocketMessage | null = null;
  private subscription?: Subscription;
  private selectionSubscription?: Subscription;
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

  // Track if we need to maintain focus for keyboard handling
  private shouldMaintainFocus: boolean = false;

  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer,
    private playlistService: PlaylistService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    // Load saved playlist guid from localStorage
    const savedGuid = localStorage.getItem("selectedPlaylistGuid");
    if (savedGuid) {
      this.selectedPlaylistGuid = parseInt(savedGuid, 10);
    }

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
      
      if (message.type === 'SelectLibraryItem' && message.guid !== undefined) {
        // Only process if locationId matches (or if no locationId in message)
        const user = this.userService.getUser();
        if (!message.locationId || message.locationId === user?.locationId) {
          this.handleLibraryItemSelection(message.guid, message.page, true);
        }
        return;
      }

      // Handle content messages
      if (message.type === 'text' || message.type === 'image' || message.type === 'url') {
        this.currentContent = message;

        // Adjust font size for text after view update
        if (message.type === "text") {
          setTimeout(() => this.adjustTextSize(), 100);
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
      
      // If message is empty object, it's a clear message
      if (!message.type && !message.content) {
        this.currentItemGuid = undefined;
        this.currentPage = undefined;
        this.currentItemName = undefined;
        this.currentItemIndex = -1;
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
    this.selectionSubscription?.unsubscribe();
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("keydown", this.keyboardHandler, true);
    document.removeEventListener("keydown", this.keyboardHandler, true);
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

      if (textWidth <= containerWidth * 0.8 && textHeight <= containerHeight * 0.95) {
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
    if (this.currentContent?.type === "image") {
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
    if (this.currentContent?.type === "url") {
      return this.sanitizer.bypassSecurityTrustResourceUrl(this.currentContent.content);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl("about:blank");
  }

  get text(): string {
    return this.currentContent?.type === "text" ? this.currentContent.content : "";
  }

  get backgroundColor(): string {
    return this.currentContent?.background_color || "#000000";
  }

  get fontColor(): string {
    return this.currentContent?.font_color || "#FFFFFF";
  }

  get textContainerStyle(): { [key: string]: string } {
    return {
      'background-color': this.backgroundColor
    };
  }

  get textContentStyle(): { [key: string]: string } {
    return {
      'color': this.fontColor
    };
  }

  get imageContainerStyle(): { [key: string]: string } {
    return {
      'background-color': this.backgroundColor
    };
  }

  getPlaylistItemType(item: LibraryItem): string {
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  }

  onPlaylistItemsLoaded(items: LibraryItem[]): void {
    this.playlistItems = items;
  }

  onPlaylistItemClick(item: LibraryItem): void {
    if (item.guid) {
      this.handleLibraryItemSelection(item.guid, 1, false, item);
    }
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
    
    this.currentItemGuid = guid;
    this.currentPage = page;
    this.currentItemName = item.name;
    this.currentItemIndex = this.playlistItems.findIndex(i => i.guid === guid);
    
    // Send Change message for content display
    const user = this.userService.getUser();
    const changeMessage: any = {
      type: "Change",
      guid: guid,
      page: page
    };
    if (user?.locationId) {
      changeMessage.locationId = user.locationId;
    }
    this.websocketService.send(JSON.stringify(changeMessage));
    
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
      this.handleLibraryItemSelection(event.item.guid, event.page, false, event.item);
    }
  }
  
  onManualItemSelected(item: LibraryItem, page: number = 1): void {
    this.handleLibraryItemSelection(item.guid, page, false, item);
    this.currentItemIndex = -1; // Not in playlist
    
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

  onClearClick(): void {
    const clearMessage = {
      type: "Clear"
    };
    this.websocketService.send(JSON.stringify(clearMessage));
    console.log("Sent Clear message");
    
    // Clear current item tracking
    this.currentItemGuid = undefined;
    this.currentPage = undefined;
    this.currentItemName = undefined;
    this.currentItemIndex = -1;
  }

  canGoNext(): boolean {
    if (!this.currentItemGuid) return false;
    
    // If in manual tab, check manual item pages
    if (this.activeTab === 'manual' && this.manualItem) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        return currentPageIndex >= 0 && currentPageIndex < this.manualItemPages.length - 1;
      }
      return false; // Manual items don't have next item
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
    
    // If in manual tab, check manual item pages
    if (this.activeTab === 'manual' && this.manualItem) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        return currentPageIndex > 0;
      }
      return false; // Manual items don't have previous item
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
    
    // Handle manual tab
    if (this.activeTab === 'manual' && this.manualItem) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex >= 0 && currentPageIndex < this.manualItemPages.length - 1) {
          const nextPage = this.manualItemPages[currentPageIndex + 1];
          this.currentPage = nextPage;
          
          const user = this.userService.getUser();
          const changeMessage: any = {
            type: "Change",
            guid: this.manualItem.guid,
            page: nextPage
          };
          if (user?.locationId) {
            changeMessage.locationId = user.locationId;
          }
          this.websocketService.send(JSON.stringify(changeMessage));
          return;
        }
      }
      // No next available in manual tab
      return;
    }
    
    // Handle playlist tab
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (!currentItem) return;
    
    // Check if has more pages in current item
    if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
      const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
      if (currentPageIndex >= 0 && currentPageIndex < currentItem.pages.length - 1) {
        // Go to next page
        const nextPage = currentItem.pages[currentPageIndex + 1];
        this.onPlaylistItemPageClick({ item: currentItem, page: nextPage });
        return;
      }
    }
    
    // Go to next item in playlist
    if (this.currentItemIndex >= 0 && this.currentItemIndex < this.playlistItems.length - 1) {
      const nextItem = this.playlistItems[this.currentItemIndex + 1];
      this.onPlaylistItemClick(nextItem);
    }
  }

  onPreviousClick(): void {
    if (!this.currentItemGuid) return;
    
    // Handle manual tab
    if (this.activeTab === 'manual' && this.manualItem) {
      if (this.manualItemPages.length > 0) {
        const currentPageIndex = this.manualItemPages.indexOf(this.currentPage || 1);
        if (currentPageIndex > 0) {
          const prevPage = this.manualItemPages[currentPageIndex - 1];
          this.currentPage = prevPage;
          
          const user = this.userService.getUser();
          const changeMessage: any = {
            type: "Change",
            guid: this.manualItem.guid,
            page: prevPage
          };
          if (user?.locationId) {
            changeMessage.locationId = user.locationId;
          }
          this.websocketService.send(JSON.stringify(changeMessage));
          return;
        }
      }
      // No previous available in manual tab
      return;
    }
    
    // Handle playlist tab
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (!currentItem) return;
    
    // Check if has previous pages in current item
    if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
      const currentPageIndex = currentItem.pages.indexOf(this.currentPage || 1);
      if (currentPageIndex > 0) {
        // Go to previous page
        const prevPage = currentItem.pages[currentPageIndex - 1];
        this.onPlaylistItemPageClick({ item: currentItem, page: prevPage });
        return;
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
  }

  getAvailablePages(): number[] {
    if (!this.currentItemGuid) return [];
    
    // Handle manual tab
    if (this.activeTab === 'manual' && this.manualItem) {
      return this.manualItemPages || [];
    }
    
    // Handle playlist tab
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (!currentItem) return [];
    
    // Return pages for text items
    if (currentItem.type === 'text' && currentItem.pages && currentItem.pages.length > 0) {
      return currentItem.pages;
    }
    
    return [];
  }

  onPageButtonClick(pageNum: number): void {
    if (!this.currentItemGuid) return;
    
    // Handle manual tab
    if (this.activeTab === 'manual' && this.manualItem) {
      this.currentPage = pageNum;
      const user = this.userService.getUser();
      const changeMessage: any = {
        type: "Change",
        guid: this.manualItem.guid,
        page: pageNum
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
}
