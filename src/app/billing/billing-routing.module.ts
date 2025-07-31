import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InvoiceFormComponent } from './invoice-form/invoice-form.component';

const routes: Routes = [
  { 
    path: 'create', 
    component: InvoiceFormComponent 
  },
  { 
    path: 'edit/:id', 
    component: InvoiceFormComponent 
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BillingRoutingModule { }
