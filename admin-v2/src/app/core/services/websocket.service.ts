import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WebSocketMessage {
  type: 'text' | 'image' | 'url' | 'video' | 'iframe' | 'SelectPlaylist' | 'SelectLibraryItem' | 'ActionResponse' | 'KeyboardCommand' | 'UrlPlayPause' | 'DisplayVisibleState';
  content?: string;
  guid?: number;
  page?: number;
  background_color?: string;
  font_color?: string;
  css?: { [key: string]: string }; // CSS custom properties object
  locationId?: number;
  chordsVisible?: boolean;
  chordTransposition?: number;
  actionType?: string;
  status?: 'processing' | 'success' | 'error';
  message?: string;
  timestamp?: string;
  key?: string; // For KeyboardCommand messages
  play?: boolean; // For UrlPlayPause messages - true to play, false to pause
  contentVisible?: boolean; // For DisplayVisibleState - whether display shows content or blank page
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: WebSocket | null = null;
  private messageSubject = new Subject<WebSocketMessage>();
  public messages$ = this.messageSubject.asObservable();
  
  private connectionStatusSubject = new BehaviorSubject<ConnectionStatus>('disconnected');
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  /** Last content message received (for replay when playlist-view mounts after reconnect) */
  private lastContentSubject = new BehaviorSubject<WebSocketMessage | null>(null);
  public lastContent$ = this.lastContentSubject.asObservable();

  private reconnectTimeout: any = null;
  private currentLocationId: number | null = null;
  private fallbackUrl: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isUsingFallback = false;

  private getWsUrl(): string {
    // Check if there's a configured server URL in localStorage (user override)
    const configuredServerUrl = localStorage.getItem('mediaserver_api_url');
    if (configuredServerUrl) {
      const wsUrl = configuredServerUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      return wsUrl;
    }
    
    // Check URL parameter for server override
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      const serverParam = urlParams.get('server');
      if (serverParam) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const serverUrl = serverParam.startsWith('http') ? serverParam : `${protocol}//${serverParam.replace(/^https?:/, '')}`;
        if (!serverUrl.startsWith('ws') && !serverUrl.startsWith('wss')) {
          const wsUrl = serverUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
          localStorage.setItem('mediaserver_api_url', serverUrl.replace(/^ws/, 'http').replace(/^wss/, 'https'));
          return wsUrl;
        }
        localStorage.setItem('mediaserver_api_url', serverUrl.replace(/^ws/, 'http').replace(/^wss/, 'https'));
        return serverUrl;
      }
    }
    
    // Use shared configuration (evaluated at runtime)
    return environment.wsUrl;
  }

  connect(locationId?: number | null): void {
    // Disconnect existing connection before creating a new one
    if (this.socket) {
      // Remove event listeners to prevent reconnection attempts
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onopen = null;
      this.socket.onmessage = null;
      
      // Close existing socket
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        this.socket.close();
      }
      this.socket = null;
    }

    // Build WebSocket URL with locationId if provided
    let url = this.getWsUrl();
    
    // Generate fallback URL: if url contains fixed IP, fallback to localhost
    if (url.includes('192.168.0.100')) {
      this.fallbackUrl = url.replace('192.168.0.100', 'localhost');
    } else {
      this.fallbackUrl = null;
    }
    
    if (locationId) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}locationId=${locationId}`;
      if (this.fallbackUrl) {
        this.fallbackUrl = `${this.fallbackUrl}${separator}locationId=${locationId}`;
      }
      this.currentLocationId = locationId;
    } else {
      this.currentLocationId = null;
    }

    // Reset reconnect attempts when explicitly connecting
    this.reconnectAttempts = 0;
    this.isUsingFallback = false;

    this.attemptConnection(url, false, locationId);
  }

  private attemptConnection(url: string, isFallback: boolean, locationId?: number | null): void {
    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Update status to connecting
    this.connectionStatusSubject.next('connecting');

    try {
      this.socket = new WebSocket(url);
      this.isUsingFallback = isFallback;

      this.socket.onopen = () => {
        console.log(`WebSocket connection established to ${url}`);
        this.connectionStatusSubject.next('connected');
        this.reconnectAttempts = 0; // Reset on successful connection
        
        // Send AdminClient initialization message to register as admin client
        // This ensures the server knows this is an admin app that should receive keyboard commands
        const adminInitMessage = {
          type: 'AdminClient',
          locationId: locationId || undefined
        };
        this.send(JSON.stringify(adminInitMessage));
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage;
          this.messageSubject.next(data);
          // Store content messages for late subscribers (e.g. playlist-view mounting after reconnect)
          if (data.type === 'text' || data.type === 'image' || data.type === 'url' || data.type === 'video' || data.type === 'iframe') {
            this.lastContentSubject.next(data);
          }
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
            this.attemptConnection(this.fallbackUrl!, true, locationId);
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
            this.reconnectTimeout = setTimeout(() => {
              this.attemptConnection(this.fallbackUrl!, true, this.currentLocationId || undefined);
            }, 3000);
          } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Retry with same URL
            this.reconnectAttempts++;
            this.reconnectTimeout = setTimeout(() => {
              this.attemptConnection(url, isFallback, this.currentLocationId || undefined);
            }, 5000);
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
        this.reconnectTimeout = setTimeout(() => {
          this.attemptConnection(this.fallbackUrl!, true, locationId);
        }, 1000);
      } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.reconnectTimeout = setTimeout(() => {
          this.attemptConnection(url, isFallback, locationId);
        }, 5000);
      }
    }
  }

  disconnect(): void {
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close(1000); // Normal closure
      this.socket = null;
    }

    this.connectionStatusSubject.next('disconnected');
    this.reconnectAttempts = 0;
    this.isUsingFallback = false;
    this.lastContentSubject.next(null); // Clear stored content on disconnect
  }

  send(message: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }
}
