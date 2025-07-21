import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FirebaseAuthService, UserProfile, UserRole } from '../../../auth/shared/firebase-auth.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="user-profile-container" *ngIf="userProfile">
      <div class="profile-header">
        <div class="profile-avatar">
          <img *ngIf="userProfile.photoURL" [src]="userProfile.photoURL" alt="Profile Photo">
          <div *ngIf="!userProfile.photoURL" class="avatar-placeholder">
            {{ (userProfile.displayName && userProfile.displayName.charAt(0).toUpperCase()) || 'U' }}
          </div>
        </div>
        <div class="profile-details">
          <h2>{{ userProfile.displayName }}</h2>
          <span class="role-badge" [ngClass]="'role-' + (userProfile.role ? userProfile.role.toLowerCase() : '')">
            {{ userProfile.role }}
          </span>
        </div>
      </div>
      
      <div class="profile-info">
        <div class="info-row">
          <span class="label">Email</span>
          <span class="value">{{ userProfile.email }}</span>
          <span *ngIf="userProfile.isEmailVerified" class="verified-badge">Verified</span>
          <a *ngIf="!userProfile.isEmailVerified" class="verify-link" (click)="verifyEmail()">
            Verify Email
          </a>
        </div>
        <div class="info-row">
          <span class="label">Phone</span>
          <span class="value">{{ userProfile.phoneNumber }}</span>
        </div>
        <div class="info-row">
          <span class="label">Member Since</span>
          <span class="value">{{ formatDate(userProfile.metadata && userProfile.metadata.creationTime) }}</span>
        </div>
      </div>
      
      <div class="profile-actions">
        <button class="action-button" (click)="editProfile()">Edit Profile</button>
        <button class="action-button secondary" (click)="changePassword()">Change Password</button>
      </div>
      
      <!-- Role-specific information sections -->
      <div class="role-specific-section" *ngIf="hasRole(UserRole.DOCTOR)">
        <h3>Doctor Information</h3>
        <p>Your specialties and schedule information appears here.</p>
      </div>
      
      <div class="role-specific-section" *ngIf="hasRole(UserRole.PATIENT)">
        <h3>Patient Information</h3>
        <p>Your medical history and upcoming appointments appear here.</p>
      </div>
      
      <div class="role-specific-section" *ngIf="hasRole(UserRole.STAFF)">
        <h3>Staff Information</h3>
        <p>Your department and responsibilities appear here.</p>
      </div>
      
      <div class="role-specific-section" *ngIf="hasRole(UserRole.ADMIN)">
        <h3>Admin Controls</h3>
        <p>System management tools and user administration appear here.</p>
      </div>
    </div>
  `,
  styles: [`
    .user-profile-container {
      font-family: 'Roboto', sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .profile-header {
      display: flex;
      align-items: center;
      margin-bottom: 30px;
    }
    
    .profile-avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      margin-right: 20px;
      overflow: hidden;
      background: #f0f0f0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .profile-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-placeholder {
      font-size: 40px;
      font-weight: bold;
      color: #555;
    }
    
    .profile-details h2 {
      margin: 0 0 10px 0;
      font-size: 24px;
      color: #333;
    }
    
    .role-badge {
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 14px;
      font-weight: 500;
      color: white;
    }
    
    .role-doctor {
      background-color: #4CAF50;
    }
    
    .role-patient {
      background-color: #2196F3;
    }
    
    .role-staff {
      background-color: #FF9800;
    }
    
    .role-admin {
      background-color: #F44336;
    }
    
    .profile-info {
      margin-bottom: 30px;
    }
    
    .info-row {
      padding: 12px 0;
      border-bottom: 1px solid #eee;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
    }
    
    .info-row .label {
      width: 150px;
      font-weight: 500;
      color: #666;
    }
    
    .info-row .value {
      flex: 1;
      color: #333;
    }
    
    .verified-badge {
      background: #4CAF50;
      color: white;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 12px;
      margin-left: 10px;
    }
    
    .verify-link {
      color: #1976D2;
      cursor: pointer;
      margin-left: 10px;
      font-size: 14px;
      text-decoration: underline;
    }
    
    .profile-actions {
      display: flex;
      gap: 15px;
      margin-bottom: 30px;
    }
    
    .action-button {
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      background: #1976D2;
      color: white;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .action-button:hover {
      background: #1565C0;
    }
    
    .action-button.secondary {
      background: #f0f0f0;
      color: #333;
    }
    
    .action-button.secondary:hover {
      background: #e0e0e0;
    }
    
    .role-specific-section {
      margin-top: 30px;
      padding: 20px;
      background: #f9f9f9;
      border-left: 4px solid #1976D2;
      border-radius: 4px;
    }
    
    .role-specific-section h3 {
      margin-top: 0;
      color: #333;
    }
  `]
})
export class UserProfileComponent implements OnInit {
  userProfile: UserProfile | null = null;
  UserRole = UserRole; // Expose enum to template
  
  constructor(private authService: FirebaseAuthService) {}
  
  ngOnInit(): void {
    // Get current user profile
    this.userProfile = this.authService.currentUser;
  }
  
  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }
  
  formatDate(timestamp: string | undefined): string {
    if (!timestamp) return 'N/A';
    
    const date = new Date(parseInt(timestamp));
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
  
  editProfile(): void {
    // Navigate to edit profile page or open modal
    console.log('Edit profile clicked');
  }
  
  changePassword(): void {
    // Navigate to change password page or open modal
    console.log('Change password clicked');
  }
  
  verifyEmail(): void {
    console.log('Verify email clicked');
    // Implement email verification logic
  }
}
