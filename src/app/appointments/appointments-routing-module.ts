import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AppointmentListComponent } from './appointment-list/appointment-list';
import { AppointmentDetailComponent } from './appointment-detail/appointment-detail';
import { AppointmentFormComponent } from './appointment-form/appointment-form';
import { AppointmentTransferComponent } from './appointment-transfer/appointment-transfer';

const routes: Routes = [
  { path: '', component: AppointmentListComponent },
  { path: 'new', component: AppointmentFormComponent },
  { path: ':id', component: AppointmentDetailComponent },
  { path: ':id/edit', component: AppointmentFormComponent },
  { path: ':id/transfer', component: AppointmentTransferComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AppointmentsRoutingModule { }
