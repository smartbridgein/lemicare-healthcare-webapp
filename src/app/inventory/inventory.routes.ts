import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/inventory-dashboard/inventory-dashboard.component').then(c => c.InventoryDashboardComponent)
  },
  {
    path: 'medicines',
    loadComponent: () => import('./components/medicines/medicines.component').then(c => c.MedicinesComponent)
  },
  {
    path: 'purchases',
    loadComponent: () => import('./components/purchases/purchases.component').then(c => c.PurchasesComponent)
  },
  {
    path: 'purchases/view/:id',
    loadComponent: () => import('./components/purchase-view/purchase-view.component').then(c => c.PurchaseViewComponent)
  },
  {
    path: 'purchases/new',
    loadComponent: () => import('./components/purchase-form').then(c => c.PurchaseFormComponent)
  },
  {
    path: 'sales',
    loadComponent: () => import('./components/sales/sales.component').then(c => c.SalesComponent)
  },
  {
    path: 'sales/otc/new',
    loadComponent: () => import('./components/sales-otc-form/sales-otc-form.component').then(c => c.SalesOtcFormComponent)
  },
  {
    path: 'sales/otc/edit/:id',
    loadComponent: () => import('./components/sales-otc-form/sales-otc-form.component').then(c => c.SalesOtcFormComponent)
  },
  {
    path: 'sales/prescription/new',
    loadComponent: () => import('./components/sales-prescription-form/sales-prescription-form.component').then(c => c.SalesPrescriptionFormComponent)
  },
  {
    path: 'returns',
    loadComponent: () => import('./components/returns-list/returns-list.component').then(c => c.ReturnsListComponent)
  },
  {
    path: 'returns/sale/new',
    loadComponent: () => import('./components/sale-return-form/sale-return-form.component').then(c => c.SaleReturnFormComponent)
  },
  {
    path: 'returns/purchase/new',
    loadComponent: () => import('./components/purchase-return-form/purchase-return-form.component').then(c => c.PurchaseReturnFormComponent)
  },
  {
    path: 'suppliers',
    loadComponent: () => import('./components/suppliers/suppliers.component').then(c => c.SuppliersComponent)
  },
  {
    path: 'reports',
    redirectTo: 'reports/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'reports/dashboard',
    loadComponent: () => import('./components/reports-dashboard/reports-dashboard.component').then(c => c.ReportsDashboardComponent)
  },
  {
    path: 'masters',
    loadComponent: () => import('./components/masters/masters-index/masters-index').then(c => c.MastersIndexComponent),
    loadChildren: () => import('./components/masters/masters-routing-module').then(m => m.MastersRoutingModule)
  }
];
