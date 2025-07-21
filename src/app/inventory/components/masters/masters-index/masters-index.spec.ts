import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MastersIndex } from './masters-index';

describe('MastersIndex', () => {
  let component: MastersIndex;
  let fixture: ComponentFixture<MastersIndex>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MastersIndex]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MastersIndex);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
