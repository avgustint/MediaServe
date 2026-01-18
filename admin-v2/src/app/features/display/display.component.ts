import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { WebSocketService } from "../../core/services/websocket.service";
import { Subscription } from "rxjs";

interface ActionStatus {
  actionType: string;
  status: 'processing' | 'success' | 'error';
  message: string;
  timestamp: string;
}

@Component({
  selector: "app-display",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./display.component.html",
  styleUrls: ["./display.component.scss"]
})
export class DisplayComponent implements OnInit, OnDestroy {
  actionStatuses: Map<string, ActionStatus> = new Map();
  customSourceName: string = '';
  predefinedSources: string[] = ['HDMI1', 'HDMI2', 'HDMI3', 'HDMI4', '1', '2', '3', '4'];
  private messageSubscription?: Subscription;

  constructor(private websocketService: WebSocketService) {}

  ngOnInit(): void {
    // Subscribe to WebSocket messages to receive action feedback
    this.messageSubscription = this.websocketService.messages$.subscribe((message) => {
      if (message.type === 'ActionResponse' && message.actionType && message.status) {
        const actionType = message.actionType; // Capture for use in setTimeout
        this.actionStatuses.set(actionType, {
          actionType: actionType,
          status: message.status,
          message: message.message || '',
          timestamp: message.timestamp || new Date().toISOString()
        });
        
        // Auto-clear success messages after 3 seconds
        if (message.status === 'success') {
          setTimeout(() => {
            this.actionStatuses.delete(actionType);
          }, 3000);
        }
        
        // Auto-clear error messages after 5 seconds
        if (message.status === 'error') {
          setTimeout(() => {
            this.actionStatuses.delete(actionType);
          }, 5000);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.messageSubscription?.unsubscribe();
  }

  powerOff(): void {
    this.sendAction('powerOff');
  }

  powerOn(): void {
    this.sendAction('powerOn');
  }

  volumeUp(): void {
    this.sendAction('volumeUp');
  }

  volumeDown(): void {
    this.sendAction('volumeDown');
  }

  selectSource(sourceName?: string): void {
    const source = sourceName || this.customSourceName || '1';
    this.sendAction('selectSource', source);
    this.customSourceName = ''; // Clear custom source after sending
  }

  selectPredefinedSource(source: string): void {
    this.sendAction('selectSource', source);
  }

  getStatus(actionType: string): ActionStatus | undefined {
    return this.actionStatuses.get(actionType);
  }

  getStatusClass(actionType: string): string {
    const status = this.actionStatuses.get(actionType);
    if (!status) return '';
    return `status-${status.status}`;
  }

  private sendAction(actionType: string, sourceName?: string): void {
    const actionMessage: any = {
      type: 'Action',
      actionType: actionType
    };
    if (sourceName) {
      actionMessage.sourceName = sourceName;
    }
    this.websocketService.send(JSON.stringify(actionMessage));
  }
}

