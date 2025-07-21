import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppointmentsRoutingModule } from './appointments-routing-module';

// Components
import { AppointmentListComponent } from './appointment-list/appointment-list';
import { AppointmentDetailComponent } from './appointment-detail/appointment-detail';
import { AppointmentFormComponent } from './appointment-form/appointment-form';
import { AppointmentTransferComponent } from './appointment-transfer/appointment-transfer';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    AppointmentsRoutingModule,
    AppointmentListComponent,
    AppointmentDetailComponent,
    AppointmentFormComponent,
    AppointmentTransferComponent
  ]
})
export class AppointmentsModule { }
