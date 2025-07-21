import { NgModule } from '@angular/core';
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';
import { ServiceModalComponent } from './service-modal/service-modal.component';

@NgModule({
  imports: [
    InvoiceFormComponent,
    ServiceModalComponent
  ],
  exports: [
    InvoiceFormComponent
  ]
})
export class BillingModule { }
