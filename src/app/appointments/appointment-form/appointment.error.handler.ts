import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AppointmentErrorHandler {
  
  /**
   * Checks if the error is a doctor availability error
   */
  isDoctorAvailabilityError(err: HttpErrorResponse): boolean {
    // Check for specific doctor availability error patterns
    if (err.error) {
      if (typeof err.error === 'object' && err.error.message === 'Doctor is not available at the requested time') {
        return true;
      }
      
      if (err.status === 500) {
        if (typeof err.error === 'object' && err.error.message?.includes('Doctor is not available')) {
          return true;
        }
        
        if (typeof err.error === 'string' && err.error.includes('Doctor is not available')) {
          return true;
        }
        
        // Check the error trace for doctor availability messages
        if (typeof err.error === 'object' && err.error.trace?.includes('Doctor is not available')) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Get formatted error message based on the error response
   */
  getErrorMessage(err: HttpErrorResponse): string {
    if (this.isDoctorAvailabilityError(err)) {
      return 'The selected doctor is not available at this time. Please choose another time slot or doctor.';
    }
    
    if (err.status === 400 && err.error && typeof err.error === 'object' && err.error.message?.includes('Appointment date')) {
      return 'Please select a future date for the appointment.';
    }
    
    return 'Failed to save appointment. Please try again.';
  }
}
