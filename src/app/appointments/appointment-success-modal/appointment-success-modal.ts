import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-appointment-success-modal',
  templateUrl: './appointment-success-modal.html',
  styleUrls: ['./appointment-success-modal.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class AppointmentSuccessModalComponent {
  @Input() patientName: string = '';
  @Input() appointmentTime: string = '';
  @Input() appointmentDate: string = '';
  @Input() doctorName: string = '';
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<string>();
  
  closeModal(action: string = ''): void {
    this.close.emit(action);
  }
}
