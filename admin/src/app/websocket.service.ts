import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../environments/environment';

export interface WebSocketMessage {
  type: 'text' | 'image' | 'url' | 'SelectPlaylist' | 'SelectLibraryItem';
  content: string;
  guid?: number;
  page?: number;
  background_color?: string;
  font_color?: string;
  locationId?: number;
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

  private wsUrl = environment.wsUrl;
  private reconnectTimeout: any = null;
  private currentLocationId: number | null = null;

  connect(locationId?: number | null): void {
    // Build WebSocket URL with locationId if provided
    let url = environment.wsUrl;
    if (locationId) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}locationId=${locationId}`;
      this.currentLocationId = locationId;
    } else {
      this.currentLocationId = null;
    }
    this.wsUrl = url;

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Update status to connecting
    this.connectionStatusSubject.next('connecting');

    try {
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.connectionStatusSubject.next('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.messageSubject.next(data as WebSocketMessage);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.connectionStatusSubject.next('disconnected');
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.connectionStatusSubject.next('disconnected');
        // Attempt to reconnect every 5 seconds with same locationId
        this.reconnectTimeout = setTimeout(() => this.connect(this.currentLocationId || undefined), 5000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.connectionStatusSubject.next('disconnected');
      // Attempt to reconnect every 5 seconds with same locationId
      this.reconnectTimeout = setTimeout(() => this.connect(this.currentLocationId || undefined), 5000);
    }
  }

  disconnect(): void {
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connectionStatusSubject.next('disconnected');
  }

  send(message: string): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    }
  }
}

