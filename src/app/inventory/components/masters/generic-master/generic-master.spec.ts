import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericMaster } from './generic-master';

describe('GenericMaster', () => {
  let component: GenericMaster;
  let fixture: ComponentFixture<GenericMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenericMaster]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GenericMaster);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
