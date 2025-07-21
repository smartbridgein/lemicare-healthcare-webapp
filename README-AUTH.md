# CosmicDoc Authentication System

This document explains the role-based authentication system built for the CosmicDoc healthcare application.

## System Overview

The authentication system consists of two main parts:

1. **Angular Frontend** with Firebase Authentication
   - Role-based component display and access control
   - User authentication state management
   - Route guards based on user roles
   
2. **Spring Boot Backend API**
   - Firebase Authentication integration
   - Firestore database for user profiles with roles
   - JWT token management for secure API access

## User Roles

The system supports the following roles:

- **Patient**: Regular users who can book appointments and view health records
- **Doctor**: Healthcare providers who can manage patient appointments and medical records
- **Staff**: Administrative staff who handle scheduling and operations
- **Admin**: System administrators with full access to all features

## How to Use Role-Based Components in Angular

### 1. Display Components Based on User Role

You can conditionally show/hide components based on the user's role:

```html
<!-- Example: Dashboard.component.html -->
<div class="dashboard-container">
  <!-- Visible to all authenticated users -->
  <app-dashboard-header></app-dashboard-header>
  
  <!-- Doctor-specific components -->
  <div *ngIf="authService.hasRole(UserRole.DOCTOR)">
    <app-patient-list></app-patient-list>
    <app-appointment-scheduler></app-appointment-scheduler>
  </div>
  
  <!-- Admin-specific components -->
  <div *ngIf="authService.hasRole(UserRole.ADMIN)">
    <app-user-management></app-user-management>
    <app-system-settings></app-system-settings>
  </div>
  
  <!-- Staff-specific components -->
  <div *ngIf="authService.hasRole(UserRole.STAFF)">
    <app-administrative-tools></app-administrative-tools>
  </div>
  
  <!-- Patient-specific components -->
  <div *ngIf="authService.hasRole(UserRole.PATIENT)">
    <app-my-appointments></app-my-appointments>
    <app-medical-records></app-medical-records>
  </div>
</div>
```

### 2. Protect Routes with Role Guards

Add role guards to your routes:

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { UserRole } from './auth/shared/firebase-auth.service';
import { RoleGuardService } from './auth/shared/role-guard.service';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  
  // Auth routes (accessible to everyone)
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  
  // Patient routes
  {
    path: 'patient',
    loadChildren: () => import('./patient/patient.routes').then(m => m.PATIENT_ROUTES),
    canActivate: [RoleGuardService],
    data: { roles: [UserRole.PATIENT] }
  },
  
  // Doctor routes
  {
    path: 'doctor',
    loadChildren: () => import('./doctor/doctor.routes').then(m => m.DOCTOR_ROUTES),
    canActivate: [RoleGuardService],
    data: { roles: [UserRole.DOCTOR] }
  },
  
  // Staff routes
  {
    path: 'staff',
    loadChildren: () => import('./staff/staff.routes').then(m => m.STAFF_ROUTES),
    canActivate: [RoleGuardService],
    data: { roles: [UserRole.STAFF] }
  },
  
  // Admin routes
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
    canActivate: [RoleGuardService],
    data: { roles: [UserRole.ADMIN] }
  },
  
  // Dashboard with role-based content
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [RoleGuardService],
    data: { roles: [UserRole.PATIENT, UserRole.DOCTOR, UserRole.STAFF, UserRole.ADMIN] }
  }
];
```

### 3. Use the Authentication Service in Components

```typescript
// Example component using the authentication service
import { Component, OnInit } from '@angular/core';
import { FirebaseAuthService, UserRole } from '../auth/shared/firebase-auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  UserRole = UserRole; // Expose enum to template
  
  constructor(public authService: FirebaseAuthService) { }
  
  ngOnInit() {
    // Redirect user based on their role or load role-specific data
    if (this.authService.currentUser) {
      this.loadDashboardData();
    }
  }
  
  loadDashboardData() {
    switch (this.authService.userRole) {
      case UserRole.DOCTOR:
        this.loadDoctorData();
        break;
      case UserRole.ADMIN:
        this.loadAdminData();
        break;
      case UserRole.STAFF:
        this.loadStaffData();
        break;
      case UserRole.PATIENT:
      default:
        this.loadPatientData();
        break;
    }
  }
  
  // Role-specific data loaders
  loadDoctorData() { /* Load doctor dashboard data */ }
  loadAdminData() { /* Load admin dashboard data */ }
  loadStaffData() { /* Load staff dashboard data */ }
  loadPatientData() { /* Load patient dashboard data */ }
}
```

## Firestore Collections

The Spring Boot backend API manages the following Firestore collections:

### Users Collection

```
/users/{userId}
  - displayName: string
  - email: string
  - phoneNumber: string
  - role: string (PATIENT, DOCTOR, STAFF, ADMIN)
  - emailVerified: boolean
  - photoURL: string (optional)
  - createdAt: timestamp
  - lastLogin: timestamp
```

### Doctors Collection

```
/doctors/{doctorId}
  - userId: string (reference to users collection)
  - specialty: string
  - qualification: string
  - experience: number
  - availability: array
  - patients: array
```

### Patients Collection

```
/patients/{patientId}
  - userId: string (reference to users collection)
  - medicalHistory: array
  - appointments: array
  - medications: array
```

### Staff Collection

```
/staff/{staffId}
  - userId: string (reference to users collection)
  - department: string
  - position: string
  - permissions: array
```

## Backend Integration

To connect the Angular frontend with the Spring Boot backend:

1. Update the environment.ts file:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081',
  firebase: {
    projectId: 'cosmicdoc-app-firebase',
    // other Firebase config from the Firebase console
  }
};
```

2. Use the authentication service for API calls:

```typescript
// Example service to fetch patient records
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FirebaseAuthService } from '../auth/shared/firebase-auth.service';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PatientRecordService {
  private apiUrl = `${environment.apiUrl}/api/patients`;

  constructor(
    private http: HttpClient,
    private authService: FirebaseAuthService
  ) {}

  getPatientRecords(patientId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${patientId}/records`);
    // The auth interceptor will automatically add the auth token
  }
}
```

## Security Considerations

1. The JWT token is automatically added to API requests via the HTTP interceptor
2. Role checks are performed both on the client and server side
3. Firebase Rules should be set up to restrict Firestore access based on user roles
4. API endpoints are protected by role-based authorization
