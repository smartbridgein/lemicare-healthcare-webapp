import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-modal.html',
  styleUrls: ['./confirmation-modal.scss']
})
export class ConfirmationModalComponent {
  @Input() title: string = 'Confirm Action';
  @Input() message: string = 'Are you sure you want to proceed with this action?';
  @Input() confirmText: string = 'Confirm';
  @Input() cancelText: string = 'Cancel';
  @Input() confirmButtonClass: string = 'btn-danger'; // default is danger red
  @Input() headerClass: string = 'bg-light'; // default light header
  
  @Output() confirmed = new EventEmitter<boolean>();
  @Output() cancelled = new EventEmitter<void>();
  
  confirm(): void {
    this.confirmed.emit(true);
  }
  
  dismiss(): void {
    this.cancelled.emit();
  }
}
