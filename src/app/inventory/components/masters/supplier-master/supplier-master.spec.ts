import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupplierMaster } from './supplier-master';

describe('SupplierMaster', () => {
  let component: SupplierMaster;
  let fixture: ComponentFixture<SupplierMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupplierMaster]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupplierMaster);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
