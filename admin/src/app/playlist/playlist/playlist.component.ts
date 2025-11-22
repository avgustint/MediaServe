import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "../../websocket.service";
import { LibraryItem } from "../../playlist.service";
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
  private resizeHandler = () => {
    if (this.currentContent?.type === "text") {
      this.adjustTextSize();
    }
  };

  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer
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

  onPlaylistItemClick(item: LibraryItem): void {
    if (item.guid) {
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
      const changeMessage = {
        type: "Change",
        guid: event.item.guid,
        page: event.page
      };
      this.websocketService.send(JSON.stringify(changeMessage));
      console.log("Sent Change message for GUID:", event.item.guid, " and page:", event.page);
    }
  }

  onClearClick(): void {
    const clearMessage = {
      type: "Clear"
    };
    this.websocketService.send(JSON.stringify(clearMessage));
    console.log("Sent Clear message");
  }
}
