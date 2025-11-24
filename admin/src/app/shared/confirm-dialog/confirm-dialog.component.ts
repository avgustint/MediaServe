import { Component, Input, Output, EventEmitter } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslatePipe } from "../../translation.pipe";

@Component({
  selector: "app-confirm-dialog",
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: "./confirm-dialog.component.html",
  styleUrls: ["./confirm-dialog.component.scss"]
})
export class ConfirmDialogComponent {
  @Input() title: string = "Confirm";
  @Input() message: string = "";
  @Input() show: boolean = false;
  @Input() confirmText: string = "Confirm";
  @Input() cancelText: string = "Cancel";
  @Input() confirmColor: string = "danger"; // "danger" or "primary"
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  onConfirm(): void {
    this.show = false;
    this.confirm.emit();
  }

  onCancel(): void {
    this.show = false;
    this.cancel.emit();
    this.close.emit();
  }

  onClose(): void {
    this.show = false;
    this.close.emit();
  }
}

