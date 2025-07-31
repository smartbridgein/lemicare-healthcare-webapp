import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ErrorToastService {
  /**
   * Checks if the error is related to doctor unavailability
   */
  isDoctorAvailabilityError(error: HttpErrorResponse): boolean {
    if (!error) return false;
    
    // Check all possible places where the doctor availability message might be
    if (error.error) {
      // Direct message match
      if (typeof error.error === 'object' && error.error.message === 'Doctor is not available at the requested time') {
        return true;
      }
      
      // Check for string contains in message
      if (typeof error.error === 'object' && error.error.message && 
          typeof error.error.message === 'string' && 
          error.error.message.includes('Doctor is not available')) {
        return true;
      }
      
      // Check error string directly
      if (typeof error.error === 'string' && error.error.includes('Doctor is not available')) {
        return true;
      }
      
      // Check in trace
      if (typeof error.error === 'object' && error.error.trace && 
          typeof error.error.trace === 'string' &&
          error.error.trace.includes('Doctor is not available')) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Gets a user-friendly error message based on the error response
   */
  getErrorMessage(error: HttpErrorResponse): string {
    if (this.isDoctorAvailabilityError(error)) {
      return 'The selected doctor is not available at this time. Please choose another time slot or doctor.';
    }
    
    if (error.status === 400 && error.error && 
        typeof error.error === 'object' && 
        error.error.message && 
        typeof error.error.message === 'string' && 
        error.error.message.includes('Appointment date')) {
      return 'Please select a future date for the appointment.';
    }
    
    return 'An error occurred while processing your request. Please try again later.';
  }
}
