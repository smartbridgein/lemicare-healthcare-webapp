import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1100;">
      <div class="toast show" [ngClass]="{'bg-danger text-white': type === 'error', 
                                         'bg-success text-white': type === 'success',
                                         'bg-warning': type === 'warning',
                                         'bg-info text-white': type === 'info'}" 
           role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header" [ngClass]="{'bg-danger text-white': type === 'error', 
                                             'bg-success text-white': type === 'success',
                                             'bg-warning': type === 'warning',
                                             'bg-info text-white': type === 'info'}">
          <i class="bi" [ngClass]="{'bi-exclamation-circle-fill': type === 'error',
                                   'bi-check-circle-fill': type === 'success',
                                   'bi-exclamation-triangle-fill': type === 'warning',
                                   'bi-info-circle-fill': type === 'info'}" 
             class="me-2"></i>
          <strong class="me-auto">{{ title }}</strong>
          <button type="button" class="btn-close btn-close-white" (click)="close()"></button>
        </div>
        <div class="toast-body">
          <p class="mb-0">{{ message }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast {
      min-width: 350px;
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    }
  `]
})
export class ToastComponent {
  @Input() title: string = 'Notification';
  @Input() message: string = '';
  @Input() visible: boolean = false;
  @Input() type: 'error' | 'success' | 'warning' | 'info' = 'info';
  @Output() visibleChange = new EventEmitter<boolean>();
  
  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
