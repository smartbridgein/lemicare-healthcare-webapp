import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MedicineMasterComponent } from './medicine-master/medicine-master.component';
import { SupplierMasterComponent } from './supplier-master/supplier-master.component';
import { TaxProfileMasterComponent } from './tax-profile-master/tax-profile-master';
import { ServiceMasterComponent } from './service-master/service-master';
import { SupplierOverviewComponent } from '../../components/supplier-overview/supplier-overview.component';

const routes: Routes = [
  { path: '', redirectTo: 'medicine', pathMatch: 'full' },
  { path: 'medicine', component: MedicineMasterComponent },
  { path: 'supplier', component: SupplierMasterComponent },
  { path: 'supplier/overview/:id', component: SupplierOverviewComponent },
  { path: 'tax-profile', component: TaxProfileMasterComponent },
  { path: 'service', component: ServiceMasterComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MastersRoutingModule { }
