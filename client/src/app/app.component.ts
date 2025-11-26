import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "./websocket.service";
import { FormatTextPipe } from "./format-text.pipe";
import { Subscription } from "rxjs";
import { SERVER_BASE_URL } from "./api.config";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule, FormatTextPipe],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"]
})
export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild("textContainer", { static: false }) textContainer!: ElementRef<HTMLDivElement>;
  @ViewChild("imageContainer", { static: false }) imageContainer!: ElementRef<HTMLDivElement>;

  currentContent: WebSocketMessage | null = null;
  private subscription?: Subscription;
  private connectionStatusSubscription?: Subscription;
  connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";

  // Location handling
  locationId: number | null = null;
  showLocationSelector = false;
  locationInput: string = "";
  locations: { guid: number; name: string; description?: string }[] = [];
  locationsLoading = false;
  locationsError: string | null = null;

  private resizeHandler = () => {
    if (this.currentContent?.type === "text") {
      this.adjustTextSize();
    }
  };

  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.initializeLocation();

    // Subscribe to connection status changes
    this.connectionStatusSubscription = this.websocketService.connectionStatus$.subscribe(
      (status) => {
        this.connectionStatus = status;
      }
    );

    this.subscription = this.websocketService.messages$.subscribe((message: WebSocketMessage) => {
      // React only to messages for the currently selected location (if locationId is present)
      if (message.locationId != null && this.locationId != null && message.locationId !== this.locationId) {
        return;
      }

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
    this.connectionStatusSubscription?.unsubscribe();
    this.websocketService.disconnect();
    window.removeEventListener("resize", this.resizeHandler);
  }

  private initializeLocation(): void {
    // 1) Try URL parameter (location or locationId)
    const searchParams = new URLSearchParams(window.location.search);
    const urlLocationParam = searchParams.get("location") || searchParams.get("locationId");

    if (urlLocationParam) {
      const parsed = parseInt(urlLocationParam, 10);
      if (!isNaN(parsed)) {
        this.locationId = parsed;
        this.locationInput = String(parsed);
        localStorage.setItem("displayLocationId", String(parsed));
        this.initializeWebSocketConnection();
        return;
      }
    }

    // 2) Try localStorage
    const storedLocation = localStorage.getItem("displayLocationId");
    if (storedLocation) {
      const parsed = parseInt(storedLocation, 10);
      if (!isNaN(parsed)) {
        this.locationId = parsed;
        this.locationInput = String(parsed);
        this.initializeWebSocketConnection();
        return;
      }
    }

    // 3) No location yet -> load locations and show selector UI
    this.loadLocations();
    this.showLocationSelector = true;
  }

  private loadLocations(): void {
    this.locationsLoading = true;
    this.locationsError = null;

    this.http
      .get<{ guid: number; name: string; description?: string }[]>(`${SERVER_BASE_URL}/locations`)
      .subscribe({
        next: (locations) => {
          this.locations = locations || [];
          this.locationsLoading = false;
        },
        error: (err) => {
          console.error("Failed to load locations", err);
          this.locationsLoading = false;
          this.locationsError = "Failed to load locations";
        }
      });
  }

  private initializeWebSocketConnection(): void {
    if (this.locationId == null) {
      return;
    }

    // Connect to WebSocket with locationId as query parameter so server can route by location
    const wsUrl = `ws://localhost:8080?locationId=${this.locationId}`;
    this.websocketService.connect(wsUrl);
  }

  onConfirmLocation(): void {
    const parsed = parseInt(this.locationInput, 10);
    if (isNaN(parsed)) {
      return;
    }

    this.locationId = parsed;
    localStorage.setItem("displayLocationId", String(parsed));
    this.showLocationSelector = false;

    // Reconnect WebSocket with new location
    this.websocketService.disconnect();
    this.initializeWebSocketConnection();
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
}
