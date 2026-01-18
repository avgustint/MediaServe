import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    @use '../../../styles/variables' as *;
    
    .page-container {
      flex: 1;
      overflow: hidden;
      min-height: 0;
      -webkit-overflow-scrolling: touch;
      position: relative;
      display: flex;
      flex-direction: column;
    }
  `]
})
export class PageContainerComponent {}
