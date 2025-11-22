import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "../websocket.service";
import { PlaylistService, PlaylistItem, LibraryItem, PlaylistSearchResult } from "../playlist.service";
import { PlaylistItemComponent } from "./playlist-item.component";
import { Subscription, debounceTime, distinctUntilChanged, Subject, switchMap, of } from "rxjs";

@Component({
  selector: "app-playlist",
  standalone: true,
  imports: [CommonModule, PlaylistItemComponent, FormsModule],
  templateUrl: "./playlist.component.html",
  styleUrls: ["./playlist.component.scss"]
})
export class PlaylistComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("textContainer", { static: false }) textContainer!: ElementRef<HTMLDivElement>;
  @ViewChild("imageContainer", { static: false }) imageContainer!: ElementRef<HTMLDivElement>;

  playlist: LibraryItem[] = [];
  currentContent: WebSocketMessage | null = null;
  private subscription?: Subscription;
  private connectionStatusSubscription?: Subscription;
  private searchSubscription?: Subscription;
  connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";
  searchTerm: string = "";
  searchResults: PlaylistSearchResult[] = [];
  showSearchResults: boolean = false;
  currentPlaylistGuid?: number;
  private searchSubject = new Subject<string>();
  private resizeHandler = () => {
    if (this.currentContent?.type === "text") {
      this.adjustTextSize();
    }
  };

  constructor(
    private websocketService: WebSocketService,
    private playlistService: PlaylistService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Load default playlist (last updated)
    this.loadPlaylist();

    // Subscribe to connection status
    this.connectionStatusSubscription = this.websocketService.connectionStatus$.subscribe((status) => {
      this.connectionStatus = status;
    });

    // Connect to WebSocket
    this.websocketService.connect("ws://localhost:8080");

    this.subscription = this.websocketService.messages$.subscribe((message: WebSocketMessage) => {
      this.currentContent = message;

      // Adjust font size for text after view update
      if (message.type === "text") {
        setTimeout(() => this.adjustTextSize(), 100);
      }
    });

    // Setup search with debounce
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((searchTerm) => {
        if (searchTerm.trim().length === 0) {
          this.searchResults = [];
          this.showSearchResults = false;
          return of([]);
        }
        return this.playlistService.searchPlaylists(searchTerm);
      })
    ).subscribe({
      next: (results) => {
        this.searchResults = results;
        this.showSearchResults = results.length > 0 || this.searchTerm.trim().length > 0;
      },
      error: (error) => {
        console.error("Error searching playlists:", error);
        this.searchResults = [];
        this.showSearchResults = false;
      }
    });
  }

  ngAfterViewInit(): void {
    // Listen for window resize to adjust text size
    window.addEventListener("resize", this.resizeHandler);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.connectionStatusSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    this.websocketService.disconnect();
    window.removeEventListener("resize", this.resizeHandler);
  }

  loadPlaylist(guid?: number): void {
    this.currentPlaylistGuid = guid;
    this.playlistService.getPlaylist(guid).subscribe({
      next: (items) => {
        this.playlist = items;
      },
      error: (error) => {
        console.error("Error loading playlist:", error);
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onSearchResultSelect(result: PlaylistSearchResult): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.loadPlaylist(result.guid);
  }

  clearSearch(): void {
    this.searchTerm = "";
    this.showSearchResults = false;
    this.searchResults = [];
    this.searchSubject.next("");
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

  onPlaylistItemClick(item: LibraryItem, page?: number): void {
    if (item.guid) {
      const changeMessage = {
        type: "Change",
        guid: item.guid,
        page: page || 1
      };
      this.websocketService.send(JSON.stringify(changeMessage));
      console.log("Sent Change message for GUID:", item.guid, " and page:", page);
    } else {
      console.warn("Playlist item does not have a GUID");
    }
  }

  onPlaylistItemPageClick(event: { item: LibraryItem; page: number }): void {
    this.onPlaylistItemClick(event.item, event.page);
  }

  onClearClick(): void {
    const clearMessage = {
      type: "Clear"
    };
    this.websocketService.send(JSON.stringify(clearMessage));
    console.log("Sent Clear message");
  }
}
