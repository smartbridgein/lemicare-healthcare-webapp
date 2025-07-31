import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-already-booked-modal',
  templateUrl: './already-booked-modal.html',
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class AlreadyBookedModalComponent {
  @Input() visible: boolean = false;
  @Input() doctorName: string = '';
  @Input() appointmentTime: string = '';
  @Output() close = new EventEmitter<string>();
  
  closeModal(action: string = ''): void {
    this.close.emit(action);
  }
}
