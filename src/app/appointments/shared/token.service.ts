import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Appointment } from './appointment.model';
import { map, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TokenService {
  private apiUrl = `${environment.opdApiUrl}/api/appointments/token`;
  
  // Observable for current token
  private currentTokenSubject = new BehaviorSubject<Appointment | null>(null);
  currentToken$ = this.currentTokenSubject.asObservable();
  
  // Observable for waiting count
  private waitingCountSubject = new BehaviorSubject<number>(0);
  waitingCount$ = this.waitingCountSubject.asObservable();

  constructor(private http: HttpClient) { }

  /**
   * Get the current active token for a doctor
   */
  getCurrentToken(doctorId: string): Observable<Appointment | null> {
    return this.http.get<Appointment>(`${this.apiUrl}/current/${doctorId}`)
      .pipe(
        tap(token => {
          console.log('Current token data received:', token);
          this.currentTokenSubject.next(token);
        }),
        // Handle 204 No Content responses
        map(token => token || null),
        catchError(error => {
          console.error('Error fetching current token:', error);
          // Check if this is a doctor not found error
          if (error.status === 404 && error.error && error.error.message && 
              error.error.message.includes('Doctor not found')) {
            console.warn(`Doctor with ID ${doctorId} not found in the system. Unable to fetch token information.`);
          }
          return of(null);
        })
      );
  }

  /**
   * Get waiting token count
   */
  getWaitingTokenCount(doctorId: string): Observable<number> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/waiting-count/${doctorId}`)
      .pipe(
        map(response => {
          console.log('Waiting count response:', response);
          return typeof response === 'object' && response !== null && 'count' in response ? response.count : (typeof response === 'number' ? response : 0);
        }),
        tap(count => this.waitingCountSubject.next(count)),
        catchError(error => {
          console.error('Error fetching waiting count:', error);
          return of(0);
        })
      );
  }

  /**
   * Complete the current token and move to next
   */
  completeCurrentToken(doctorId: string): Observable<Appointment | null> {
    return this.http.post<Appointment>(`${this.apiUrl}/complete/${doctorId}`, {})
      .pipe(
        tap(token => {
          this.currentTokenSubject.next(token);
          // Update waiting count
          this.getWaitingTokenCount(doctorId).subscribe();
        }),
        // Handle 204 No Content responses
        map(token => token || null)
      );
  }

  /**
   * Skip current token and move to next
   */
  skipCurrentToken(doctorId: string): Observable<Appointment | null> {
    return this.http.post<Appointment>(`${this.apiUrl}/skip/${doctorId}`, {})
      .pipe(
        tap(token => {
          this.currentTokenSubject.next(token);
          // Update waiting count
          this.getWaitingTokenCount(doctorId).subscribe();
        }),
        // Handle 204 No Content responses
        map(token => token || null)
      );
  }

  /**
   * Update token status directly
   */
  updateTokenStatus(appointmentId: string, status: string): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.apiUrl}/${appointmentId}/status/${status}`, {});
  }

  /**
   * Refresh all token data for a doctor
   */
  refreshTokenData(doctorId: string): void {
    this.getCurrentToken(doctorId).subscribe();
    this.getWaitingTokenCount(doctorId).subscribe();
  }
}
