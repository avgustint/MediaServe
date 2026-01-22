import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "./websocket.service";
import { FormatTextPipe } from "./format-text.pipe";
import { Subscription } from "rxjs";
import { SERVER_BASE_URL, AUTO_LOGIN_LOCATION_ID } from "./api.config";

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
  @ViewChild("urlIframe", { static: false }) urlIframe!: ElementRef<HTMLIFrameElement>;
  @ViewChild("videoElement", { static: false }) videoElement!: ElementRef<HTMLVideoElement>;

  currentContent: WebSocketMessage | null = null;
  private subscription?: Subscription;
  private connectionStatusSubscription?: Subscription;
  connectionStatus: "connecting" | "connected" | "disconnected" = "disconnected";

  // Chord display state: default is to show chords
  showChords: boolean = true;
  
  // Text transition state: true when text is ready to be shown (after font size calculation)
  isTextReady: boolean = false;

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

  private keyboardHandler = (event: KeyboardEvent) => {
    this.handleKeyboardEvent(event);
  };

  private formatTextPipe: FormatTextPipe;

  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer,
    private http: HttpClient
  ) {
    this.formatTextPipe = new FormatTextPipe(sanitizer);
  }

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

      // Always update chord visibility first (before updating content)
      // This ensures visibility changes are applied immediately
      // Only update if chordsVisible is explicitly set in the message
      if (message.chordsVisible !== undefined) {
        // Only update if the value actually changed to prevent unnecessary re-renders
        if (this.showChords !== message.chordsVisible) {
          this.showChords = message.chordsVisible;
        }
      }
      // If chordsVisible is undefined, keep current state (don't default to true)

      // Update content (chords should always be in the content, visibility controlled by showChords)
      // Only update if this is a content message (text, image, url, or video)
      if (message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video') {
        // For text content, update content first but keep it hidden, then calculate font size
        if (message.type === "text") {
          // Set isTextReady to false FIRST - this ensures opacity class is removed before content update
          this.isTextReady = false;
          
          // If switching from different content type, clear current content first
          if (this.currentContent && this.currentContent.type !== "text") {
            this.currentContent = null;
          }
          
          // Update content first (it will be hidden by opacity: 0)
          requestAnimationFrame(() => {
            this.currentContent = message;
            
            // Wait for DOM to update, then calculate font size on the actual visible element
            // (which is currently hidden with opacity: 0)
            requestAnimationFrame(() => {
              this.adjustTextSize();
              // After font size calculation, show the text
              requestAnimationFrame(() => {
                this.isTextReady = true;
              });
            });
          });
        } else {
          // For non-text content, hide text first if it was showing
          if (this.currentContent?.type === "text") {
            this.isTextReady = false;
          }
          // Update immediately for non-text content
          this.currentContent = message;
          this.isTextReady = true;
        }
      }
    });
  }

  ngAfterViewInit(): void {
    // Listen for window resize to adjust text size
    window.addEventListener("resize", this.resizeHandler);
    // Listen for keyboard events to forward to admin app
    window.addEventListener("keydown", this.keyboardHandler, true);
    
    // Note: Admin app is opened as a separate Chromium window by kiosk-start.sh
    // No need to open it from here
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.connectionStatusSubscription?.unsubscribe();
    this.websocketService.disconnect();
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("keydown", this.keyboardHandler, true);
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

    // 3) Try auto-login location from config (if enabled)
    if (AUTO_LOGIN_LOCATION_ID && AUTO_LOGIN_LOCATION_ID > 0) {
      this.locationId = AUTO_LOGIN_LOCATION_ID;
      this.locationInput = String(AUTO_LOGIN_LOCATION_ID);
      localStorage.setItem("displayLocationId", String(AUTO_LOGIN_LOCATION_ID));
      this.initializeWebSocketConnection();
      return;
    }

    // 4) No location yet -> load locations and show selector UI
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
          
          // Auto-select if there's only one location available
          if (this.locations.length === 1) {
            const singleLocation = this.locations[0];
            this.locationId = singleLocation.guid;
            this.locationInput = String(singleLocation.guid);
            localStorage.setItem("displayLocationId", String(singleLocation.guid));
            this.showLocationSelector = false;
            this.initializeWebSocketConnection();
          }
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

    // Convert HTTP URL to WebSocket URL (replace http:// with ws:// or https:// with wss://)
    const wsBaseUrl = SERVER_BASE_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    // Connect to WebSocket with locationId as query parameter so server can route by location
    const wsUrl = `${wsBaseUrl}?locationId=${this.locationId}`;
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

  /**
   * Adjust text size - calculates on the actual visible element (which is hidden during calculation)
   */
  adjustTextSize(): void {
    if (!this.textContainer || !this.currentContent || this.currentContent.type !== "text") {
      this.isTextReady = true; // Mark as ready even if calculation fails
      return;
    }

    const container = this.textContainer.nativeElement;
    const textElement = container.querySelector(".text-content") as HTMLElement;

    if (!textElement) {
      this.isTextReady = true; // Mark as ready even if element not found
      return;
    }

    // Ensure text is hidden during calculation (should already be hidden via opacity: 0)
    // But we'll also use visibility as a backup
    const originalVisibility = textElement.style.visibility;
    textElement.style.visibility = 'hidden';

    // Get container dimensions, accounting for padding
    const containerStyle = window.getComputedStyle(container);
    const paddingX = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);
    const paddingY = parseFloat(containerStyle.paddingTop) + parseFloat(containerStyle.paddingBottom);
    
    const containerWidth = container.clientWidth - paddingX;
    const containerHeight = container.clientHeight - paddingY;
    const text = this.currentContent.content;

    if (!text || text.trim().length === 0) {
      textElement.style.visibility = originalVisibility;
      this.isTextReady = true;
      return;
    }

    // Binary search for optimal font size
    let minFont = 10;
    let maxFont = Math.min(containerWidth, containerHeight);
    let bestFont = minFont;

    // Set initial font size (hidden, so no flash)
    textElement.style.fontSize = `${minFont}px`;

    // Binary search to find maximum font size that fits
    while (minFont <= maxFont) {
      const fontSize = Math.floor((minFont + maxFont) / 2);
      textElement.style.fontSize = `${fontSize}px`;

      // Force reflow to get accurate measurements
      textElement.offsetHeight;

      // Check if text fits within container with some padding
      // Use available width/height (95% of container) to account for max-width/max-height CSS
      const availableWidth = containerWidth * 0.95;
      const availableHeight = containerHeight * 0.95;
      const textWidth = textElement.scrollWidth;
      const textHeight = textElement.scrollHeight;

      if (textWidth <= availableWidth && textHeight <= availableHeight) {
        bestFont = fontSize;
        minFont = fontSize + 1;
      } else {
        maxFont = fontSize - 1;
      }
    }

    // Apply the best font size found
    textElement.style.fontSize = `${bestFont}px`;
    
    // Restore visibility - opacity transition will handle the fade-in
    textElement.style.visibility = originalVisibility;
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

  private addAutoplayToEmbedUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // For YouTube, add enablejsapi=1 for postMessage API to work
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        if (!urlObj.searchParams.has('enablejsapi')) {
          urlObj.searchParams.set('enablejsapi', '1');
        }
      }
      
      // Check if URL already has autoplay parameter
      if (urlObj.searchParams.has('autoplay')) {
        // Update existing autoplay to 1
        urlObj.searchParams.set('autoplay', '1');
        return urlObj.toString();
      }
      
      // Add autoplay parameter
      urlObj.searchParams.set('autoplay', '1');
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
      
      // Check if URL already contains autoplay
      if (modifiedUrl.includes('autoplay=')) {
        // Replace existing autoplay value with 1
        return modifiedUrl.replace(/autoplay=[^&]*/i, 'autoplay=1');
      }
      
      // Add autoplay parameter
      const separator = modifiedUrl.includes('?') ? '&' : '?';
      return `${modifiedUrl}${separator}autoplay=1`;
    }
  }

  get safeUrl(): SafeResourceUrl {
    if (this.currentContent?.type === "url" && this.currentContent.content) {
      const url = this.currentContent.content as string;
      const urlWithAutoplay = this.addAutoplayToEmbedUrl(url);
      return this.sanitizer.bypassSecurityTrustResourceUrl(urlWithAutoplay);
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl("about:blank");
  }

  get videoSrc(): SafeResourceUrl {
    if (this.currentContent?.type === "video" && this.currentContent.content) {
      const videoUrl = this.currentContent.content as string;
      // If it's already a full URL, use it; otherwise construct from SERVER_BASE_URL
      if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
        return this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
      } else {
        // Relative path - construct full URL
        const fullUrl = `${SERVER_BASE_URL}${videoUrl.startsWith('/') ? videoUrl : '/' + videoUrl}`;
        return this.sanitizer.bypassSecurityTrustResourceUrl(fullUrl);
      }
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl("about:blank");
  }

  get text(): string {
    return this.currentContent?.type === "text" && this.currentContent.content ? this.currentContent.content : "";
  }

  get backgroundColor(): string {
    return this.currentContent?.background_color || "#000000";
  }

  get fontColor(): string {
    return this.currentContent?.font_color || "#FFFFFF";
  }

  get chordFontColor(): string {
    return this.currentContent?.chord_font_color || "#210789";
  }

  get textContainerStyle(): { [key: string]: string } {
    const style: { [key: string]: string } = {
      'background-color': this.backgroundColor
    };
    
    // Apply CSS custom properties from library item if present
    // Only apply safe properties that won't break the layout (no display, width, height, flex properties)
    if (this.currentContent?.css && typeof this.currentContent.css === 'object') {
      const cssObj = this.currentContent.css;
      const safeProperties = Object.keys(cssObj).filter(key => {
        // Only allow CSS custom properties (--*) or safe styling properties
        // Exclude layout-critical properties
        const layoutProperties = ['display', 'width', 'height', 'flex', 'flex-direction', 
                                  'align-items', 'justify-content', 'overflow', 'position'];
        return key.startsWith('--') || !layoutProperties.includes(key);
      });
      
      safeProperties.forEach(key => {
        style[key] = cssObj[key];
      });
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

  get videoContainerStyle(): { [key: string]: string } {
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

  /**
   * Handle keyboard events and forward to admin app via server
   * Only captures specific keys: arrow keys, numbers, Enter
   */
  private handleKeyboardEvent(event: KeyboardEvent): void {
    const key = event.key;

    // Only capture specific keys
    const allowedKeys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'Enter', 'Escape'
    ];

    if (!allowedKeys.includes(key)) {
      return; // Ignore other keys (like space, which should work on video)
    }

    // Don't capture if user is typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Don't capture if target is a video element or inside a video container
    // Let video handle its own controls (space for play/pause, arrow keys for seeking, etc.)
    if (target.tagName === 'VIDEO' || target.closest('.video-container')) {
      return;
    }

    // Send keyboard command to server
    // Server will validate IP and forward to admin apps on same IP
    this.sendKeyboardCommand(key);
  }

  /**
   * Send keyboard command to server via HTTP POST
   */
  private sendKeyboardCommand(key: string): void {
    this.http.post(`${SERVER_BASE_URL}/api/keyboard/command`, {
      key: key,
      timestamp: Date.now()
    }).subscribe({
      next: () => {
        // Successfully sent to server
        // Server will forward to admin apps on same IP
      },
      error: (err) => {
        // Silently fail - server might not be running or endpoint might not exist
        // Don't log to avoid console spam
      }
    });
  }

  /**
   * Handle keyboard events on video element
   * Prevents default behavior for number keys and other allowed keys
   * so they can bubble up to the window handler for forwarding to admin app
   * Explicitly handles space key for play/pause
   */
  onVideoKeyDown(event: KeyboardEvent): void {
    const key = event.key;

    // Only intercept the same keys that the window handler processes
    const allowedKeys = [
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'Enter', 'Escape'
    ];

    // Explicitly handle space key for play/pause
    // Don't prevent default - let video handle it naturally, but ensure window handler doesn't interfere
    if (key === ' ' || key === 'Space') {
      // Stop propagation to prevent window handler from interfering
      event.stopPropagation();
      // Don't prevent default - let the video element's native behavior handle play/pause
      return;
    }

    if (allowedKeys.includes(key)) {
      // Prevent default behavior (e.g., video seeking/restarting on number keys)
      event.preventDefault();
      // Don't stop propagation - let the event bubble up so the window handler
      // (which uses capture phase) can process it for forwarding to admin app
    }
  }

}
