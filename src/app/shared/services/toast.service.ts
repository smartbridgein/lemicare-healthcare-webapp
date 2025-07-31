import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  /**
   * Show success toast notification
   * @param message Success message to display
   */
  showSuccess(message: string): void {
    // We can implement this with a proper toast library like ngx-toastr
    // For now, we'll just use a simple alert
    alert('Success: ' + message);
  }

  /**
   * Show error toast notification
   * @param message Error message to display
   */
  showError(message: string): void {
    // We can implement this with a proper toast library like ngx-toastr
    // For now, we'll just use a simple alert
    alert('Error: ' + message);
  }

  /**
   * Show warning toast notification
   * @param message Warning message to display
   */
  showWarning(message: string): void {
    // We can implement this with a proper toast library like ngx-toastr
    // For now, we'll just use a simple alert
    alert('Warning: ' + message);
  }

  /**
   * Show info toast notification
   * @param message Info message to display
   */
  showInfo(message: string): void {
    // We can implement this with a proper toast library like ngx-toastr
    // For now, we'll just use a simple alert
    alert('Info: ' + message);
  }
}
