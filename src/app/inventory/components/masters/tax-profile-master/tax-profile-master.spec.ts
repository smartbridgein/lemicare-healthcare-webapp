import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaxProfileMaster } from './tax-profile-master';

describe('TaxProfileMaster', () => {
  let component: TaxProfileMaster;
  let fixture: ComponentFixture<TaxProfileMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaxProfileMaster]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaxProfileMaster);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
