import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { DomSanitizer, SafeResourceUrl, SafeHtml } from "@angular/platform-browser";
import { WebSocketService, WebSocketMessage } from "./websocket.service";
import { FormatTextPipe } from "./format-text.pipe";
import { Subscription } from "rxjs";
import { AUTO_LOGIN_LOCATION_ID, getServerBaseUrlRuntime } from "./api.config";

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
  // Separate state for text pages so we can prepare next page off-screen
  currentTextContent: WebSocketMessage | null = null;
  nextTextContent: WebSocketMessage | null = null;
  // Index of the currently visible text page (0 or 1)
  activeTextPageIndex: 0 | 1 = 0;
  // True while slide transition between pages is running
  isTextTransitioning: boolean = false;
  // Duration of slide transition in ms (keep in sync with CSS)
  private readonly textTransitionDuration = 400;

  // Simple slide-in animation toggle for non-text content (image, url, video, iframe)
  mediaSlideToggle: boolean = false;

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
    if (this.currentTextContent) {
      // Recalculate font size for currently visible text page
      this.adjustTextSizeForPage(this.activeTextPageIndex);
    }
  };

  private formatTextPipe: FormatTextPipe;

  constructor(
    private websocketService: WebSocketService,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
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
      // Prefer chordVisibility (3-state): show only when 'everywhere'
      // Fall back to chordsVisible for legacy messages
      const shouldShowChords = message.chordVisibility !== undefined
        ? (message.chordVisibility === 'everywhere')
        : (message.chordsVisible !== undefined ? message.chordsVisible : undefined);
      if (shouldShowChords !== undefined) {
        if (this.showChords !== shouldShowChords) {
          this.showChords = shouldShowChords;
        }
      }

      // Update content (chords should always be in the content, visibility controlled by showChords)
      // Only update if this is a content message (text, image, url, video, or iframe)
      if (message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video' || message.type === 'iframe') {
        if (message.type === "text") {
          // Text content uses a double-buffered slide transition between two pages.
          // First text message: show immediately (no slide), still using font-size calculation.
          // Also handle case where we're switching from non-text content to text
          if (!this.currentTextContent && !this.nextTextContent) {
            this.isTextReady = false;
            this.currentTextContent = message;
            this.currentContent = message;
            this.activeTextPageIndex = 0;
            this.isTextTransitioning = false;
            this.nextTextContent = null; // Ensure nextTextContent is null

            // Wait for DOM to render current page, then calculate font-size on page 0
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                this.adjustTextSizeForPage(0);
                requestAnimationFrame(() => {
                  this.isTextReady = true;
                });
              });
            });
            return;
          }

          // If a transition is already running, replace the nextTextContent
          // so that the latest page is shown next.
          if (this.isTextTransitioning) {
            this.nextTextContent = message;
            this.currentContent = message;
            return;
          }

          // Same page with only chord transposition change: update in place, skip slide animation
          const currentGuid = this.currentTextContent?.guid ?? this.currentContent?.guid;
          const currentPage = this.currentTextContent?.page ?? this.currentContent?.page ?? 1;
          const msgPage = message.page ?? 1;
          if (currentGuid !== undefined && message.guid !== undefined &&
              currentGuid === message.guid && currentPage === msgPage) {
            this.currentTextContent = message;
            this.currentContent = message;
            this.nextTextContent = null;
            // Recalculate font size for current page (content may have changed slightly with transposition)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                this.adjustTextSizeForPage(this.activeTextPageIndex);
                this.cdr.detectChanges();
              });
            });
            return;
          }

          // All subsequent text messages (after the first one) use slide transition
          // This includes both page changes within a song and song changes
          const nextPageIndex: 0 | 1 = this.activeTextPageIndex === 0 ? 1 : 0;
          this.isTextReady = false;
          // Store the new content in nextTextContent (this will be shown on the next page)
          this.nextTextContent = message;
          this.currentContent = message;

          // Render next page off-screen, then calculate its font size
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Calculate font size for the page that will become active
              this.adjustTextSizeForPage(nextPageIndex);

              // After calculation, trigger slide transition
              requestAnimationFrame(() => {
                // Mark text as ready BEFORE changing active page so content is visible
                this.isTextReady = true;
                this.isTextTransitioning = true;
                
                // Change which page is active - this triggers the CSS transition
                // The new active page will show nextTextContent via getTextForPage logic
                this.activeTextPageIndex = nextPageIndex;

                // After transition completes, swap content and reset flags
                setTimeout(() => {
                  // Swap: next becomes current (the transitioned page is now the current one)
                  // Ensure we have valid content before swapping
                  if (this.nextTextContent) {
                    this.currentTextContent = this.nextTextContent;
                    this.nextTextContent = null;
                  }
                  this.isTextTransitioning = false;
                  // Ensure text remains ready after transition
                  this.isTextReady = true;
                  // Trigger change detection to ensure view updates
                  this.cdr.detectChanges();
                }, this.textTransitionDuration);
              });
            });
          });
        } else {
          // For non-text content (image, url, video, iframe), always use slide transition
          // Hide text first if it was showing
          if (this.currentTextContent) {
            this.isTextReady = false;
            this.currentTextContent = null;
            this.nextTextContent = null;
            this.isTextTransitioning = false;
          }

          // Update non-text content and trigger slide-in animation
          // First, hide the current content by moving it off-screen
          this.mediaSlideToggle = false;
          
          // Wait for the container to move off-screen, then update content and slide in
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Update content while off-screen
              this.currentContent = message;
              this.cdr.detectChanges();
              
              // Now slide it in from the right
              requestAnimationFrame(() => {
                this.mediaSlideToggle = true;
              });
            });
          });
        }
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

  // Get server URL at runtime (like websocket service does)
  private getServerBaseUrl(): string {
    // Use shared configuration (evaluated at runtime)
    return getServerBaseUrlRuntime();
  }

  private loadLocations(): void {
    this.locationsLoading = true;
    this.locationsError = null;

    this.http
      .get<{ guid: number; name: string; description?: string }[]>(`${this.getServerBaseUrl()}/locations`)
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

    // Connect to WebSocket with locationId (websocket service will determine URL at runtime)
    // This matches the admin app pattern - the websocket service handles URL detection
    console.log(`[WebSocket] Connecting with locationId: ${this.locationId}`);
    this.websocketService.connect(undefined, this.locationId);
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
   * Convenience method to adjust font size for a specific text page (0 or 1).
   * It will locate the corresponding .text-content element and run the
   * font-size calculation on that element.
   */
  private adjustTextSizeForPage(pageIndex: 0 | 1): void {
    if (!this.textContainer) {
      this.isTextReady = true;
      return;
    }

    const container = this.textContainer.nativeElement;
    const selector =
      pageIndex === 0
        ? ".text-page.page-0 .text-content"
        : ".text-page.page-1 .text-content";
    const textElement = container.querySelector(selector) as HTMLElement | null;

    // Get the content for this specific page
    const pageContent = pageIndex === this.activeTextPageIndex ? this.currentTextContent : this.nextTextContent;
    this.adjustTextSize(textElement, pageContent);
  }

  /**
   * Adjust text size - calculates on the provided element (or the first .text-content if omitted)
   * @param targetTextElement The text element to calculate font size for
   * @param contentOverride Optional content to use instead of currentContent
   */
  adjustTextSize(targetTextElement?: HTMLElement | null, contentOverride?: WebSocketMessage | null): void {
    if (!this.textContainer) {
      this.isTextReady = true; // Mark as ready even if calculation fails
      return;
    }

    const container = this.textContainer.nativeElement;
    const textElement =
      targetTextElement || (container.querySelector(".text-content") as HTMLElement | null);

    if (!textElement) {
      this.isTextReady = true; // Mark as ready even if element not found
      return;
    }

    // Use provided content or fall back to currentTextContent
    const content = contentOverride || this.currentTextContent;
    if (!content || content.type !== "text") {
      this.isTextReady = true;
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
    const text = content.content;

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
      // If it's already a full URL, use it; otherwise construct from runtime server URL
      if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
        return this.sanitizer.bypassSecurityTrustResourceUrl(videoUrl);
      } else {
        // Relative path - construct full URL using runtime method
        const fullUrl = `${this.getServerBaseUrl()}${videoUrl.startsWith('/') ? videoUrl : '/' + videoUrl}`;
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

  get text(): string {
    return this.currentContent?.type === "text" && this.currentContent.content ? this.currentContent.content : "";
  }

  get backgroundColor(): string {
    // For text content, prefer currentTextContent; otherwise use currentContent
    const content = this.currentTextContent || this.currentContent;
    return content?.background_color || "#000000";
  }

  get fontColor(): string {
    return this.currentContent?.font_color || "#FFFFFF";
  }

  get chordFontColor(): string {
    return this.currentContent?.chord_font_color || "#210789";
  }

  get textContainerStyle(): { [key: string]: string } {
    // For text container, use currentTextContent if available, otherwise currentContent
    const content = this.currentTextContent || this.currentContent;
    const style: { [key: string]: string } = {
      'background-color': content?.background_color || "#000000"
    };
    
    // Apply CSS custom properties from library item if present
    // Only apply safe properties that won't break the layout (no display, width, height, flex properties)
    if (content?.css && typeof content.css === 'object') {
      const cssObj = content.css;
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

  /**
   * Get text content for a specific page (0 or 1)
   */
  getTextForPage(pageIndex: 0 | 1): string {
    // During transition, the page that's becoming active should show nextTextContent
    // After transition, active page shows currentTextContent
    if (this.isTextTransitioning && pageIndex === this.activeTextPageIndex) {
      // We're transitioning to this page, show nextTextContent (which will become current)
      // Fallback to currentTextContent if nextTextContent is not available (safety)
      const content = this.nextTextContent || this.currentTextContent;
      return content?.type === "text" && content.content ? content.content : "";
    } else if (pageIndex === this.activeTextPageIndex) {
      // Active page shows currentTextContent
      // After transition completes, currentTextContent should have the new content
      // Fallback to nextTextContent if currentTextContent is not available (safety during swap)
      const content = this.currentTextContent || this.nextTextContent;
      return content?.type === "text" && content.content ? content.content : "";
    } else {
      // Inactive page: during transition it shows old currentTextContent (sliding out)
      // When not transitioning, it shows nextTextContent if available (preparing for next transition)
      if (this.isTextTransitioning) {
        // During transition, inactive page shows the old currentTextContent
        return this.currentTextContent?.type === "text" && this.currentTextContent.content ? this.currentTextContent.content : "";
      } else {
        // Not transitioning, inactive page shows nextTextContent if preparing
        return this.nextTextContent?.type === "text" && this.nextTextContent.content ? this.nextTextContent.content : "";
      }
    }
  }

  /**
   * Get text content style (color) for a specific page
   */
  textContentStyleForPage(pageIndex: 0 | 1): { [key: string]: string } {
    let content: WebSocketMessage | null = null;
    if (this.isTextTransitioning && pageIndex === this.activeTextPageIndex && this.nextTextContent) {
      content = this.nextTextContent;
    } else if (pageIndex === this.activeTextPageIndex) {
      content = this.currentTextContent;
    } else {
      // Inactive page: during transition show old currentTextContent, otherwise show nextTextContent if available
      content = this.isTextTransitioning ? this.currentTextContent : (this.nextTextContent || this.currentTextContent);
    }
    const fontColor = content?.font_color || "#FFFFFF";
    return {
      'color': fontColor
    };
  }

  /**
   * Get chord font color for a specific page
   */
  getChordFontColorForPage(pageIndex: 0 | 1): string {
    let content: WebSocketMessage | null = null;
    if (this.isTextTransitioning && pageIndex === this.activeTextPageIndex && this.nextTextContent) {
      content = this.nextTextContent;
    } else if (pageIndex === this.activeTextPageIndex) {
      content = this.currentTextContent;
    } else {
      // Inactive page: during transition show old currentTextContent, otherwise show nextTextContent if available
      content = this.isTextTransitioning ? this.currentTextContent : (this.nextTextContent || this.currentTextContent);
    }
    return content?.chord_font_color || "#210789";
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

}
