import { Routes } from '@angular/router';
import { PatientListComponent } from './patient-list/patient-list.component';
import { PatientRegistrationComponent } from './patient-registration/patient-registration.component';
import { PatientMedicalHistoryComponent } from './patient-medical-history/patient-medical-history.component';
import { PatientVisitHistoryComponent } from './patient-visit-history/patient-visit-history.component';

export const PATIENTS_ROUTES: Routes = [
  {
    path: '',
    component: PatientListComponent
  },
  {
    path: 'registration',
    component: PatientRegistrationComponent
  },
  {
    path: 'registration/:id',
    component: PatientRegistrationComponent
  },
  {
    path: 'medical-history/:id',
    component: PatientMedicalHistoryComponent
  },
  {
    path: 'visit-history/:id',
    component: PatientVisitHistoryComponent
  }
];
