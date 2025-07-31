import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MedicineMaster } from './medicine-master';

describe('MedicineMaster', () => {
  let component: MedicineMaster;
  let fixture: ComponentFixture<MedicineMaster>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicineMaster]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MedicineMaster);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
