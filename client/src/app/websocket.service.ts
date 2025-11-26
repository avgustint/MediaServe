import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface WebSocketMessage {
  type: 'text' | 'image' | 'url';
  content: string;
  background_color?: string;
  font_color?: string;
  locationId?: number;
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

  // Default WebSocket URL - can be configured
  private wsUrl = 'ws://localhost:8080';

  connect(url?: string): void {
    if (url) {
      this.wsUrl = url;
    }

    try {
      this.connectionStatusSubject.next('connecting');
      this.socket = new WebSocket(this.wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.connectionStatusSubject.next('connected');
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
        console.error('WebSocket error:', error);
        this.connectionStatusSubject.next('disconnected');
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.connectionStatusSubject.next('disconnected');
        // Optionally attempt to reconnect
        setTimeout(() => this.connect(), 3000);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.connectionStatusSubject.next('disconnected');
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

