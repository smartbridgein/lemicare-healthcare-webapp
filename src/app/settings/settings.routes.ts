import { Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { AuthGuard } from '../auth/shared/auth.guard';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsComponent,
    canActivate: [AuthGuard],
    title: 'Settings - Hanan Clinic'
  }
];
