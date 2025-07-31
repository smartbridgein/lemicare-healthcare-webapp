import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-error-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="visible" class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 1100;">
      <div class="toast show bg-white" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header bg-danger text-white">
          <i class="bi bi-exclamation-circle-fill me-2"></i>
          <strong class="me-auto">Error</strong>
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
export class ErrorToastComponent implements OnInit, OnDestroy {
  @Input() message: string = '';
  @Input() visible: boolean = false;
  @Input() autoHide: boolean = true;
  @Input() duration: number = 5000; // 5 seconds
  @Output() visibleChange = new EventEmitter<boolean>();
  
  private destroy$ = new Subject<void>();
  
  ngOnInit(): void {
    // Auto hide toast after duration if autoHide is true
    if (this.visible && this.autoHide) {
      this.startAutoHideTimer();
    }
  }
  
  ngOnChanges(): void {
    // Start timer when visibility changes to true
    if (this.visible && this.autoHide) {
      this.startAutoHideTimer();
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
  
  private startAutoHideTimer(): void {
    timer(this.duration)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.close();
      });
  }
}
