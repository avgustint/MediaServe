import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { WebSocketService } from "../websocket.service";

@Component({
  selector: "app-display",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./display.component.html",
  styleUrls: ["./display.component.scss"]
})
export class DisplayComponent {
  constructor(private websocketService: WebSocketService) {}

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

  private sendAction(actionType: string): void {
    const actionMessage = {
      type: 'Action',
      actionType: actionType
    };
    this.websocketService.send(JSON.stringify(actionMessage));
  }
}

