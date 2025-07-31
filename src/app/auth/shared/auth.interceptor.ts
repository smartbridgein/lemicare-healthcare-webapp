import {
  HttpEvent,
  HttpRequest,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpErrorResponse
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { FirebaseAuthService } from './firebase-auth.service';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  // Try to use Firebase auth service first, fallback to legacy auth service
  const firebaseAuthService = inject(FirebaseAuthService);
  const legacyAuthService = inject(AuthService);
  const router = inject(Router);
  
  // Skip interceptor for login/register/public endpoints
  const isAuthEndpoint = req.url.includes('/auth/signin') || 
                        req.url.includes('/auth/login') || 
                        req.url.includes('/auth/register') || 
                        req.url.includes('/auth/request-otp');
  
  if (isAuthEndpoint) {
    return next(req);
  }
  
  // Get the auth token, preferring Firebase auth if available
  const authToken = firebaseAuthService.authToken || legacyAuthService.getToken();

  // Add auth token to request if available
  if (authToken) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${authToken}`)
    });

    // Send the request with auth header
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Handle 401 Unauthorized responses by logging out and redirecting to login
        if (error.status === 401 || error.status === 403) {
          console.log('Session expired or unauthorized access, redirecting to login');
          
          // Try to use Firebase auth service first, fallback to legacy auth service
          if (firebaseAuthService.isAuthenticated) {
            firebaseAuthService.signOut().subscribe({
              next: () => {
                router.navigate(['/auth/login']);
              },
              error: () => {
                // Force clear auth data even if API call fails
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_profile');
                router.navigate(['/auth/login']);
              }
            });
          } else {
            legacyAuthService.logout().subscribe({
              next: () => {
                router.navigate(['/auth/login']);
              },
              error: () => {
                // Force clear auth data even if API call fails
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_profile');
                router.navigate(['/auth/login']);
              }
            });
          }
        }
        return throwError(() => error);
      })
    );
  }
  
  // If no auth token is present and we're requesting a protected resource,
  // redirect to login page
  if (!isAuthEndpoint) {
    router.navigate(['/auth/login']);
    return throwError(() => new Error('Authentication required. Please login.'));
  }
  
  // Pass through request without modification if no auth token
  return next(req);
};
