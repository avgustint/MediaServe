import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { getWsUrl } from '../../../shared-config';

export interface WebSocketMessage {
  type: 'text' | 'image' | 'url' | 'video' | 'iframe' | 'UrlPlayPause';
  content?: string;
  background_color?: string;
  font_color?: string;
  chord_font_color?: string;
  css?: { [key: string]: string }; // CSS custom properties object
  locationId?: number;
  chordsVisible?: boolean;
  chordTransposition?: number;
  play?: boolean; // For UrlPlayPause messages - true to play, false to pause
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  public messages$ = this.messageSubject.asObservable();
  
  private connectionStatusSubject = new Subject<'connecting' | 'connected' | 'disconnected'>();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  // WebSocket URL - will be set when connect() is called
  private wsUrl: string = '';
  private fallbackUrl: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Get WebSocket URL from shared configuration (evaluated at runtime)
  private getWsUrlValue(): string {
    return getWsUrl();
  }

  connect(url?: string, locationId?: number | null): void {
    // If URL is provided, use it (for backward compatibility)
    if (url) {
      this.wsUrl = url;
      // Generate fallback URL: if url contains fixed IP, fallback to localhost
      if (url.includes('192.168.0.100')) {
        this.fallbackUrl = url.replace('192.168.0.100', 'localhost');
      } else {
        this.fallbackUrl = null;
      }
    } else {
      // Get URL from shared configuration (evaluated at runtime)
      const wsUrlValue = this.getWsUrlValue();
      this.wsUrl = wsUrlValue;
      // Generate fallback URL: if url contains fixed IP, fallback to localhost
      if (wsUrlValue.includes('192.168.0.100')) {
        this.fallbackUrl = wsUrlValue.replace('192.168.0.100', 'localhost');
      } else {
        this.fallbackUrl = null;
      }
    }

    // Add locationId to URL if provided
    let finalUrl = this.wsUrl;
    if (locationId) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${separator}locationId=${locationId}`;
    }

    this.attemptConnection(finalUrl);
  }

  private attemptConnection(url: string, isFallback: boolean = false): void {
    try {
      this.connectionStatusSubject.next('connecting');
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log(`WebSocket connection established to ${url}`);
        this.connectionStatusSubject.next('connected');
        this.reconnectAttempts = 0; // Reset on successful connection
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Ignore SelectLibraryItem and SelectPlaylist messages (only for admin apps)
          if (data.type === 'SelectLibraryItem' || data.type === 'SelectPlaylist') {
            return;
          }
          this.messageSubject.next(data as WebSocketMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error(`WebSocket error connecting to ${url}:`, error);
        // If primary URL fails and we have a fallback, try it
        if (!isFallback && this.fallbackUrl && this.reconnectAttempts === 0) {
          console.log(`Trying fallback URL: ${this.fallbackUrl}`);
          this.reconnectAttempts++;
          setTimeout(() => {
            if (this.socket) {
              this.socket.close();
            }
            this.attemptConnection(this.fallbackUrl!, true);
          }, 1000);
        } else {
          this.connectionStatusSubject.next('disconnected');
        }
      };

      this.socket.onclose = (event) => {
        console.log(`WebSocket connection closed to ${url}`);
        this.connectionStatusSubject.next('disconnected');
        
        // Only attempt reconnect if it wasn't a manual disconnect
        if (event.code !== 1000) {
          // Try fallback if primary failed and we haven't tried it yet
          if (!isFallback && this.fallbackUrl && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`Connection failed, trying fallback URL: ${this.fallbackUrl}`);
            this.reconnectAttempts++;
            setTimeout(() => this.attemptConnection(this.fallbackUrl!, true), 3000);
          } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Retry with same URL
            this.reconnectAttempts++;
            setTimeout(() => this.attemptConnection(url, isFallback), 3000);
          } else {
            console.error('Max reconnection attempts reached');
          }
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.connectionStatusSubject.next('disconnected');
      
      // Try fallback if available
      if (!isFallback && this.fallbackUrl && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.attemptConnection(this.fallbackUrl!, true), 1000);
      }
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.connectionStatusSubject.next('disconnected');
    }
  }

  send(message: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }
}

