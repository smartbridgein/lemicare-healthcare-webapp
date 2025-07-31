import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { InventoryAlertsDashboardComponent } from './inventory-alerts-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: InventoryAlertsDashboardComponent
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class InventoryAlertsDashboardModule { }
