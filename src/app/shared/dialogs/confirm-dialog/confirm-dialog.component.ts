import { Component, ElementRef, Input, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var bootstrap: any;

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal fade" tabindex="-1" role="dialog" aria-labelledby="confirmDialogTitle" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="confirmDialogTitle">{{ title }}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p>{{ message }}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" (click)="confirm()">{{ confirmText || 'Confirm' }}</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-body {
      min-width: 300px;
    }
    .modal-footer {
      padding: 16px;
    }
  `]
})
export class ConfirmDialogComponent implements AfterViewInit, OnDestroy {
  @Input() title: string = 'Confirm Action';
  @Input() message: string = 'Are you sure you want to perform this action?';
  @Input() confirmText: string = 'Confirm';
  
  private modalElement!: HTMLElement;
  private modalInstance: any;
  private resultCallback: ((result: boolean) => void) | null = null;
  
  constructor(private elementRef: ElementRef) {}
  
  ngAfterViewInit(): void {
    this.modalElement = this.elementRef.nativeElement.querySelector('.modal');
    if (this.modalElement) {
      this.modalInstance = new bootstrap.Modal(this.modalElement);
      
      // Listen for modal close and handle result
      this.modalElement.addEventListener('hidden.bs.modal', () => {
        if (this.resultCallback) {
          this.resultCallback(false); // Return false if closed without explicit confirmation
        }
      });
    }
  }
  
  ngOnDestroy(): void {
    if (this.modalInstance) {
      this.modalInstance.dispose();
    }
  }
  
  /**
   * Shows the confirmation dialog
   * @param title The dialog title
   * @param message The message to display
   * @param confirmText Custom text for the confirm button
   * @returns Promise that resolves to boolean based on user action
   */
  show(title?: string, message?: string, confirmText?: string): Promise<boolean> {
    if (title) this.title = title;
    if (message) this.message = message;
    if (confirmText) this.confirmText = confirmText;
    
    if (this.modalInstance) {
      this.modalInstance.show();
    }
    
    return new Promise<boolean>((resolve) => {
      this.resultCallback = resolve;
    });
  }
  
  /**
   * Called when the confirm button is clicked
   */
  confirm(): void {
    if (this.resultCallback) {
      this.resultCallback(true);
    }
    
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
  }
  
  /**
   * Hide the modal programmatically
   */
  hide(): void {
    if (this.modalInstance) {
      this.modalInstance.hide();
    }
  }
}
