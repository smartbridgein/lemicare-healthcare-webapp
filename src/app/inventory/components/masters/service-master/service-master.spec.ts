import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

import { ServiceMasterComponent } from './service-master';

describe('ServiceMasterComponent', () => {
  let component: ServiceMasterComponent;
  let fixture: ComponentFixture<ServiceMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        ReactiveFormsModule,
        NgbModalModule,
        ServiceMasterComponent
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ServiceMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
