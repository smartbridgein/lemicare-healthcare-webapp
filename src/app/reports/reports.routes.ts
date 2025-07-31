import { Routes } from '@angular/router';
import { ReportsComponent } from './reports.component';
import { AuthGuard } from '../auth/shared/auth.guard';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    component: ReportsComponent,
    canActivate: [AuthGuard],
    title: 'Reports - Hanan Clinic'
  }
];
