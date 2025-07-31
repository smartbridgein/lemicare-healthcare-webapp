import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PatientService } from '../shared/patient.service';
import { Patient } from '../shared/patient.model';
import * as XLSX from 'xlsx';

interface BulkUploadResult {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
  duplicates: number;
}

interface ExcelPatientData {
  [key: string]: any;
}

@Component({
  selector: 'app-bulk-upload',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './bulk-upload.component.html',
  styleUrls: ['./bulk-upload.component.scss']
})
export class BulkUploadComponent implements OnInit {
  uploadForm!: FormGroup;
  isUploading: boolean = false;
  uploadResult: BulkUploadResult | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  selectedFile: File | null = null;
  previewData: any[] = [];
  showPreview: boolean = false;
  uploadProgress: number = 0;
  currentProcessing: string = '';

  // Field mapping for Excel columns to Patient model
  fieldMappings: { [key: string]: string } = {
    'Patient Name': 'fullName',
    'Name': 'fullName',
    'First Name': 'firstName',
    'Middle Name': 'middleName',
    'Last Name': 'lastName',
    'Date of Birth': 'dateOfBirth',
    'DOB': 'dateOfBirth',
    'Birth Date': 'dateOfBirth',
    'Gender': 'gender',
    'Sex': 'gender',
    'Mobile': 'mobileNumber',
    'Mobile Number': 'mobileNumber',
    'Phone': 'mobileNumber',
    'Phone Number': 'mobileNumber',
    'Contact': 'mobileNumber',
    'Contact No': 'mobileNumber',
    'Email': 'email',
    'Email ID': 'email',
    'Address': 'address',
    'Full Address': 'address',
    'City': 'city',
    'State': 'state',
    'Pin Code': 'pinCode',
    'Pincode': 'pinCode',
    'ZIP': 'pinCode',
    'Emergency Contact Name': 'emergencyContactName',
    'Emergency Contact': 'emergencyContactName',
    'Emergency Contact Number': 'emergencyContactNumber',
    'Emergency Phone': 'emergencyContactNumber',
    'Registration Date': 'registrationDate',
    'Reg Date': 'registrationDate',
    'Date': 'registrationDate'
  };

  constructor(
    private fb: FormBuilder,
    private patientService: PatientService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.uploadForm = this.fb.group({
      file: ['', [Validators.required]],
      skipDuplicates: [true],
      validateData: [true]
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadForm.patchValue({ file: file.name });
      this.previewFile(file);
    }
  }

  private previewFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Take first 5 rows for preview
        this.previewData = jsonData.slice(0, 6);
        this.showPreview = true;
        this.errorMessage = null;
      } catch (error) {
        this.errorMessage = 'Error reading Excel file. Please ensure it\'s a valid Excel file.';
        console.error('Error reading file:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async onSubmit(): Promise<void> {
    if (this.uploadForm.invalid || !this.selectedFile) {
      this.errorMessage = 'Please select a valid Excel file.';
      return;
    }

    this.isUploading = true;
    this.errorMessage = null;
    this.successMessage = null;
    this.uploadProgress = 0;
    this.currentProcessing = 'Reading Excel file...';

    try {
      const patients = await this.parseExcelFile(this.selectedFile);
      await this.bulkUploadPatients(patients);
    } catch (error) {
      this.errorMessage = 'Error processing file: ' + (error as Error).message;
      console.error('Bulk upload error:', error);
    } finally {
      this.isUploading = false;
      this.currentProcessing = '';
    }
  }

  private async parseExcelFile(file: File): Promise<Patient[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            throw new Error('Excel file must contain at least a header row and one data row.');
          }

          const headers = jsonData[0];
          const dataRows = jsonData.slice(1);
          
          const patients: Patient[] = [];
          
          for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (this.isEmptyRow(row)) continue;
            
            const patient = this.mapRowToPatient(headers, row, i + 2); // +2 for 1-based indexing and header
            if (patient) {
              patients.push(patient);
            }
          }
          
          resolve(patients);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsArrayBuffer(file);
    });
  }

  private isEmptyRow(row: any[]): boolean {
    return !row || row.every(cell => !cell || cell.toString().trim() === '');
  }

  private mapRowToPatient(headers: string[], row: any[], rowNumber: number): Patient | null {
    try {
      const mappedData: ExcelPatientData = {};
      
      // Map Excel columns to patient fields
      headers.forEach((header, index) => {
        const value = row[index];
        if (value !== undefined && value !== null && value !== '') {
          const mappedField = this.getMappedFieldName(header.toString().trim());
          if (mappedField) {
            mappedData[mappedField] = value;
          }
        }
      });

      // Handle full name splitting if firstName/lastName not provided separately
      if (mappedData['fullName'] && !mappedData['firstName']) {
        const nameParts = mappedData['fullName'].toString().trim().split(' ');
        mappedData['firstName'] = nameParts[0] || '';
        if (nameParts.length > 2) {
          mappedData['middleName'] = nameParts.slice(1, -1).join(' ');
          mappedData['lastName'] = nameParts[nameParts.length - 1];
        } else if (nameParts.length === 2) {
          mappedData['lastName'] = nameParts[1];
        }
      }

      // Validate required fields
      if (!mappedData['firstName'] || !mappedData['lastName'] || !mappedData['mobileNumber']) {
        console.warn(`Row ${rowNumber}: Missing required fields (firstName, lastName, or mobileNumber)`);
        return null;
      }

      // Format and validate data
      const patient: Patient = {
        firstName: this.cleanString(mappedData['firstName']),
        middleName: mappedData['middleName'] ? this.cleanString(mappedData['middleName']) : '',
        lastName: this.cleanString(mappedData['lastName']),
        dateOfBirth: this.formatDate(mappedData['dateOfBirth']),
        gender: this.normalizeGender(mappedData['gender']),
        mobileNumber: this.formatMobileNumber(mappedData['mobileNumber']),
        email: mappedData['email'] ? this.cleanString(mappedData['email']) : '',
        address: mappedData['address'] ? this.cleanString(mappedData['address']) : 'Not provided',
        city: mappedData['city'] ? this.cleanString(mappedData['city']) : 'Not provided',
        state: mappedData['state'] ? this.cleanString(mappedData['state']) : 'Not provided',
        pinCode: mappedData['pinCode'] ? this.formatPinCode(mappedData['pinCode']) : '000000',
        registrationDate: mappedData['registrationDate'] ? this.formatDate(mappedData['registrationDate']) : new Date().toISOString().split('T')[0],
        emergencyContactName: mappedData['emergencyContactName'] ? this.cleanString(mappedData['emergencyContactName']) : '',
        emergencyContactNumber: mappedData['emergencyContactNumber'] ? this.formatMobileNumber(mappedData['emergencyContactNumber']) : ''
      };

      // Calculate age if date of birth is provided
      if (patient.dateOfBirth) {
        patient.age = this.calculateAge(patient.dateOfBirth);
      }

      return patient;
    } catch (error) {
      console.error(`Error mapping row ${rowNumber}:`, error);
      return null;
    }
  }

  private getMappedFieldName(header: string): string | null {
    // Direct mapping
    if (this.fieldMappings[header]) {
      return this.fieldMappings[header];
    }
    
    // Case-insensitive mapping
    const lowerHeader = header.toLowerCase();
    for (const [key, value] of Object.entries(this.fieldMappings)) {
      if (key.toLowerCase() === lowerHeader) {
        return value;
      }
    }
    
    return null;
  }

  private cleanString(value: any): string {
    return value ? value.toString().trim() : '';
  }

  private formatDate(value: any): string {
    if (!value) return '';
    
    try {
      // Handle Excel date serial numbers
      if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
      
      // Handle string dates
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  private normalizeGender(value: any): string {
    if (!value) return 'Other';
    
    const gender = value.toString().toLowerCase().trim();
    if (gender.startsWith('m') || gender === 'male') return 'Male';
    if (gender.startsWith('f') || gender === 'female') return 'Female';
    return 'Other';
  }

  private formatMobileNumber(value: any): string {
    if (!value) return '';
    
    const mobile = value.toString().replace(/\D/g, '');
    if (mobile.length === 10) return mobile;
    if (mobile.length === 11 && mobile.startsWith('0')) return mobile.substring(1);
    if (mobile.length === 12 && mobile.startsWith('91')) return mobile.substring(2);
    if (mobile.length === 13 && mobile.startsWith('+91')) return mobile.substring(3);
    
    return mobile.length >= 10 ? mobile.substring(-10) : mobile;
  }

  private formatPinCode(value: any): string {
    if (!value) return '000000';
    
    const pinCode = value.toString().replace(/\D/g, '');
    return pinCode.length === 6 ? pinCode : '000000';
  }

  private calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private async bulkUploadPatients(patients: Patient[]): Promise<void> {
    const result: BulkUploadResult = {
      total: patients.length,
      successful: 0,
      failed: 0,
      errors: [],
      duplicates: 0
    };

    this.currentProcessing = 'Uploading patients...';
    
    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      this.uploadProgress = Math.round(((i + 1) / patients.length) * 100);
      this.currentProcessing = `Processing patient ${i + 1} of ${patients.length}: ${patient.firstName} ${patient.lastName}`;
      
      try {
        await this.createPatient(patient);
        result.successful++;
      } catch (error: any) {
        result.failed++;
        if (error.status === 409) {
          result.duplicates++;
          result.errors.push(`Duplicate patient: ${patient.firstName} ${patient.lastName} (${patient.mobileNumber})`);
        } else {
          result.errors.push(`Failed to create ${patient.firstName} ${patient.lastName}: ${error.message || 'Unknown error'}`);
        }
      }
      
      // Add small delay to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.uploadResult = result;
    
    if (result.successful > 0) {
      this.successMessage = `Successfully uploaded ${result.successful} out of ${result.total} patients.`;
    }
    
    if (result.failed > 0) {
      this.errorMessage = `${result.failed} patients failed to upload. Check the details below.`;
    }
  }

  private createPatient(patient: Patient): Promise<Patient> {
    return new Promise((resolve, reject) => {
      this.patientService.createPatient(patient).subscribe({
        next: (createdPatient) => resolve(createdPatient),
        error: (error) => reject(error)
      });
    });
  }

  downloadTemplate(): void {
    const templateData = [
      ['First Name', 'Middle Name', 'Last Name', 'Date of Birth', 'Gender', 'Mobile Number', 'Email', 'Address', 'City', 'State', 'Pin Code', 'Emergency Contact Name', 'Emergency Contact Number'],
      ['John', 'Kumar', 'Doe', '1990-01-15', 'Male', '9876543210', 'john.doe@email.com', '123 Main Street', 'Mumbai', 'Maharashtra', '400001', 'Jane Doe', '9876543211'],
      ['Jane', '', 'Smith', '1985-05-20', 'Female', '9876543212', 'jane.smith@email.com', '456 Oak Avenue', 'Delhi', 'Delhi', '110001', 'John Smith', '9876543213']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Patient Template');
    XLSX.writeFile(workbook, 'patient_bulk_upload_template.xlsx');
  }

  resetUpload(): void {
    this.uploadForm.reset();
    this.selectedFile = null;
    this.previewData = [];
    this.showPreview = false;
    this.uploadResult = null;
    this.errorMessage = null;
    this.successMessage = null;
    this.uploadProgress = 0;
    this.currentProcessing = '';
  }

  navigateToPatients(): void {
    this.router.navigate(['/patients']);
  }
}
