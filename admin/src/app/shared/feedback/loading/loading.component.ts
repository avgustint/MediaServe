import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="isLoading" class="loading-overlay" [attr.aria-busy]="true" role="status" aria-live="polite">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p *ngIf="message" class="loading-message">{{ message }}</p>
        <div *ngIf="progressTotal > 0" class="progress-bar-container">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" [style.width.%]="progressPercent"></div>
          </div>
          <span class="progress-bar-label">{{ progressCurrent }}/{{ progressTotal }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }

    .loading-spinner {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      text-align: center;
    }

    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .loading-message {
      margin: 0;
      color: #333;
    }

    .progress-bar-container {
      margin-top: 1rem;
      width: 100%;
      min-width: 200px;
    }

    .progress-bar-track {
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: #3498db;
      border-radius: 4px;
      transition: width 0.2s ease;
    }

    .progress-bar-label {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.75rem;
      color: #666;
    }
  `]
})
export class LoadingComponent {
  @Input() isLoading: boolean = false;
  @Input() message: string = '';
  @Input() progressCurrent: number = 0;
  @Input() progressTotal: number = 0;

  get progressPercent(): number {
    if (this.progressTotal <= 0) return 0;
    return Math.min(100, Math.round((this.progressCurrent / this.progressTotal) * 100));
  }
}

