import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { WebSocketService } from "../../core/services/websocket.service";
import { TranslationService } from "../../core/services/translation.service";
import { TranslatePipe } from "../../shared/pipes/translation.pipe";
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
  imports: [CommonModule, TranslatePipe],
  templateUrl: "./display.component.html",
  styleUrls: ["./display.component.scss"]
})
export class DisplayComponent implements OnInit, OnDestroy {
  actionStatuses: Map<string, ActionStatus> = new Map();
  private messageSubscription?: Subscription;

  private readonly serverMessageMap: Record<string, keyof import('../../core/services/translation.service').TranslationKeys> = {
    'cec-client not found. Please install cec-utils package.': 'cecClientNotInstalled',
  };

  constructor(
    private websocketService: WebSocketService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Subscribe to WebSocket messages to receive action feedback
    this.messageSubscription = this.websocketService.messages$.subscribe((message) => {
      if (message.type === 'ActionResponse' && message.actionType && message.status) {
        const actionType = message.actionType; // Capture for use in setTimeout
        const rawMessage = message.message || '';
        const translationKey = this.serverMessageMap[rawMessage];
        const translatedMessage = translationKey
          ? this.translationService.translate(translationKey)
          : rawMessage;
        this.actionStatuses.set(actionType, {
          actionType: actionType,
          status: message.status,
          message: translatedMessage,
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

  getStatus(actionType: string): ActionStatus | undefined {
    return this.actionStatuses.get(actionType);
  }

  getStatusClass(actionType: string): string {
    const status = this.actionStatuses.get(actionType);
    if (!status) return '';
    return `status-${status.status}`;
  }

  private sendAction(actionType: string): void {
    const actionMessage: any = {
      type: 'Action',
      actionType: actionType
    };
    this.websocketService.send(JSON.stringify(actionMessage));
  }
}

