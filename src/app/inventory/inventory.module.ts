import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { INVENTORY_ROUTES } from './inventory.routes';

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(INVENTORY_ROUTES)
  ],
  exports: [RouterModule]
})
export class InventoryModule { }
