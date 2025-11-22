import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-error-popup",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./error-popup.component.html",
  styleUrls: ["./error-popup.component.scss"]
})
export class ErrorPopupComponent {
  @Input() message: string = "";
  @Input() show: boolean = false;
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.show = false;
    this.close.emit();
  }
}
