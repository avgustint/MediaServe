import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ViewportInfo {
  height: number;
  width: number;
  availableHeight: number;
  keyboardHeight: number;
  isKeyboardVisible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ViewportService {
  private viewportInfoSubject = new BehaviorSubject<ViewportInfo>(this.getInitialViewportInfo());
  public viewportInfo$: Observable<ViewportInfo> = this.viewportInfoSubject.asObservable();

  private visualViewport: VisualViewport | null = null;
  private resizeObserver?: ResizeObserver;

  constructor(private ngZone: NgZone) {
    this.initializeViewportTracking();
  }

  private getInitialViewportInfo(): ViewportInfo {
    const height = window.innerHeight;
    const width = window.innerWidth;
    const visualViewport = window.visualViewport;
    
    if (visualViewport) {
      const keyboardHeight = height - visualViewport.height;
      return {
        height: visualViewport.height,
        width: visualViewport.width,
        availableHeight: visualViewport.height,
        keyboardHeight: Math.max(0, keyboardHeight),
        isKeyboardVisible: keyboardHeight > 50 // Consider keyboard visible if height difference > 50px
      };
    }
    
    return {
      height,
      width,
      availableHeight: height,
      keyboardHeight: 0,
      isKeyboardVisible: false
    };
  }

  private initializeViewportTracking(): void {
    this.ngZone.runOutsideAngular(() => {
      // Check if Visual Viewport API is available
      if (window.visualViewport) {
        this.visualViewport = window.visualViewport;
        
        // Listen to Visual Viewport resize events
        this.visualViewport.addEventListener('resize', () => {
          this.updateViewportInfo();
        });

        this.visualViewport.addEventListener('scroll', () => {
          this.updateViewportInfo();
        });
      } else {
        // Fallback to window resize for browsers without Visual Viewport API
        window.addEventListener('resize', () => {
          this.updateViewportInfo();
        });
      }

      // Update on orientation change
      window.addEventListener('orientationchange', () => {
        // Delay to allow viewport to settle after orientation change
        setTimeout(() => {
          this.updateViewportInfo();
        }, 100);
      });
    });

    // Initial update
    this.updateViewportInfo();
  }

  private updateViewportInfo(): void {
    this.ngZone.run(() => {
      const info = this.getInitialViewportInfo();
      this.viewportInfoSubject.next(info);
      
      // Update CSS custom properties on document root
      document.documentElement.style.setProperty('--viewport-height', `${info.height}px`);
      document.documentElement.style.setProperty('--viewport-width', `${info.width}px`);
      document.documentElement.style.setProperty('--available-height', `${info.availableHeight}px`);
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
    });
  }

  getCurrentViewportInfo(): ViewportInfo {
    return this.viewportInfoSubject.value;
  }

  ngOnDestroy(): void {
    if (this.visualViewport) {
      this.visualViewport.removeEventListener('resize', this.updateViewportInfo);
      this.visualViewport.removeEventListener('scroll', this.updateViewportInfo);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
