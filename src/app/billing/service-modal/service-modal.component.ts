import { Component, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-service-modal',
  templateUrl: './service-modal.component.html',
  styleUrls: ['./service-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class ServiceModalComponent implements OnInit {
  serviceForm!: FormGroup;
  
  // Group options
  groupOptions = ['OPD', 'CONSULTATION', 'MNRF', 'PACKAGES'];
  
  @Output() close = new EventEmitter<any>();
  @Output() save = new EventEmitter<any>();
  
  constructor(private fb: FormBuilder) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm(): void {
    this.serviceForm = this.fb.group({
      group: ['OPD', Validators.required],
      serviceName: ['', Validators.required],
      description: [''],
      rate: ['', [Validators.required, Validators.min(0)]]
    });
  }

  addService(): void {
    if (this.serviceForm.valid) {
      const newService = this.serviceForm.value;
      this.save.emit(newService);
    } else {
      this.serviceForm.markAllAsTouched();
    }
  }

  dismiss(): void {
    this.close.emit();
  }
}
