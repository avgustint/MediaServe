import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "../../websocket.service";
import { LibraryItem, PlaylistService } from "../../playlist.service";
import { PlaylistListComponent } from "../playlist-list/playlist-list.component";
import { ManualComponent } from "../manual/manual.component";
import { Subscription } from "rxjs";

@Component({
  selector: "app-playlist",
  standalone: true,
  imports: [CommonModule, PlaylistListComponent, ManualComponent],
  templateUrl: "./playlist.component.html",
  styleUrls: ["./playlist.component.scss"]
})
export class PlaylistComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("textContainer", { static: false }) textContainer!: ElementRef<HTMLDivElement>;
  @ViewChild("imageContainer", { static: false }) imageContainer!: ElementRef<HTMLDivElement>;

  currentContent: WebSocketMessage | null = null;
  private subscription?: Subscription;
  activeTab: "playlist" | "manual" = "playlist";
  selectedPlaylistGuid?: number;
  
  // Current item tracking
  currentItemGuid?: number;
  currentPage?: number;
  currentItemName?: string;
  playlistItems: LibraryItem[] = [];
  currentItemIndex: number = -1;
  private resizeHandler = () => {
    if (this.currentContent?.type === "text") {
      this.adjustTextSize();
    }
  };

  // Manual tab item tracking
  manualItem: LibraryItem | null = null;
  manualItemPages: number[] = [];

  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer,
    private playlistService: PlaylistService
  ) {}

  ngOnInit(): void {
    // Load saved playlist guid from localStorage
    const savedGuid = localStorage.getItem("selectedPlaylistGuid");
    if (savedGuid) {
      this.selectedPlaylistGuid = parseInt(savedGuid, 10);
    }

    // Subscribe to WebSocket messages
    this.subscription = this.websocketService.messages$.subscribe((message: WebSocketMessage) => {
      this.currentContent = message;

      // Adjust font size for text after view update
      if (message.type === "text") {
        setTimeout(() => this.adjustTextSize(), 100);
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
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    window.removeEventListener("resize", this.resizeHandler);
  }

  switchTab(tab: "playlist" | "manual"): void {
    this.activeTab = tab;
    // Clear manual item tracking when switching tabs
    if (tab === 'playlist') {
      this.manualItem = null;
      this.manualItemPages = [];
    }
  }

  onPlaylistSelected(guid: number): void {
    this.selectedPlaylistGuid = guid;
    // Save to localStorage to remember selection
    localStorage.setItem("selectedPlaylistGuid", guid.toString());
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

  getPlaylistItemType(item: LibraryItem): string {
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  }

  onPlaylistItemsLoaded(items: LibraryItem[]): void {
    this.playlistItems = items;
  }

  onPlaylistItemClick(item: LibraryItem): void {
    if (item.guid) {
      this.currentItemGuid = item.guid;
      this.currentPage = 1;
      this.currentItemName = item.name;
      this.currentItemIndex = this.playlistItems.findIndex(i => i.guid === item.guid);
      
      const changeMessage = {
        type: "Change",
        guid: item.guid,
        page: 1
      };
      this.websocketService.send(JSON.stringify(changeMessage));
      console.log("Sent Change message for GUID:", item.guid);
    } else {
      console.warn("Playlist item does not have a GUID");
    }
  }

  onPlaylistItemPageClick(event: { item: LibraryItem; page: number }): void {
    if (event.item.guid) {
      this.currentItemGuid = event.item.guid;
      this.currentPage = event.page;
      this.currentItemName = event.item.name;
      this.currentItemIndex = this.playlistItems.findIndex(i => i.guid === event.item.guid);
      
      const changeMessage = {
        type: "Change",
        guid: event.item.guid,
        page: event.page
      };
      this.websocketService.send(JSON.stringify(changeMessage));
      console.log("Sent Change message for GUID:", event.item.guid, " and page:", event.page);
    }
  }
  
  onManualItemSelected(item: LibraryItem, page: number = 1): void {
    this.currentItemGuid = item.guid;
    this.currentPage = page;
    this.currentItemName = item.name;
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
          
          const changeMessage = {
            type: "Change",
            guid: this.manualItem.guid,
            page: nextPage
          };
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
          
          const changeMessage = {
            type: "Change",
            guid: this.manualItem.guid,
            page: prevPage
          };
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
      const changeMessage = {
        type: "Change",
        guid: this.manualItem.guid,
        page: pageNum
      };
      this.websocketService.send(JSON.stringify(changeMessage));
      return;
    }
    
    // Handle playlist tab
    const currentItem = this.playlistItems.find(item => item.guid === this.currentItemGuid);
    if (!currentItem) return;
    
    this.onPlaylistItemPageClick({ item: currentItem, page: pageNum });
  }
}
