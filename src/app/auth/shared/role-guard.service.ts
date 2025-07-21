import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { FirebaseAuthService, UserRole } from './firebase-auth.service';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RoleGuardService {
  constructor(
    private authService: FirebaseAuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    // Get the roles from route data
    const requiredRoles: UserRole[] = route.data['roles'] || [];
    
    // Check if the user is authenticated
    if (!this.authService.isAuthenticated) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
      return of(false);
    }

    // If no specific roles are required, just being authenticated is enough
    if (requiredRoles.length === 0) {
      return of(true);
    }

    // Check if user has the required role
    const hasRole = this.authService.isInRole(requiredRoles);
    
    if (!hasRole) {
      // Redirect to appropriate page based on their actual role
      if (this.authService.userRole) {
        this.router.navigate([`/${this.authService.userRole.toLowerCase()}`]);
      } else {
        this.router.navigate(['/auth/unauthorized']);
      }
      return of(false);
    }

    return of(true);
  }
}
