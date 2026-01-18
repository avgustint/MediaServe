import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TranslatePipe } from "../../pipes/translation.pipe";

export type ToastType = 'success' | 'error' | 'info' | 'warning';

@Component({
  selector: "app-toast",
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: "./toast.component.html",
  styleUrls: ["./toast.component.scss"]
})
export class ToastComponent implements OnChanges, OnDestroy {
  @Input() message: string = "";
  @Input() type: ToastType = 'info';
  @Input() show: boolean = false;
  @Input() duration: number = 3000; // Auto-close after 3 seconds
  @Output() close = new EventEmitter<void>();

  private timeoutId?: any;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show && this.duration > 0) {
      this.clearTimeout();
      this.timeoutId = setTimeout(() => {
        this.onClose();
      }, this.duration);
    } else if (changes['show'] && !this.show) {
      this.clearTimeout();
    }
  }

  ngOnDestroy(): void {
    this.clearTimeout();
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  onClose(): void {
    this.show = false;
    this.close.emit();
  }
}

