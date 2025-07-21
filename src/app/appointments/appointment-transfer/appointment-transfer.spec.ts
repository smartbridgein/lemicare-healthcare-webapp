import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppointmentTransfer } from './appointment-transfer';

describe('AppointmentTransfer', () => {
  let component: AppointmentTransfer;
  let fixture: ComponentFixture<AppointmentTransfer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentTransfer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppointmentTransfer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
