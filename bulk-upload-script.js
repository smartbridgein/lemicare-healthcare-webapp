const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:8080/api'; // Adjust based on your backend URL
const EXCEL_FILES = [
  '/Volumes/Extreme SSD/mack-backup/hanan-clinic-app/cosmicdoc-apps/healthcare-app/May Patient Report.xls',
  '/Volumes/Extreme SSD/mack-backup/hanan-clinic-app/cosmicdoc-apps/healthcare-app/June Patient Report.xls',
  '/Volumes/Extreme SSD/mack-backup/hanan-clinic-app/cosmicdoc-apps/healthcare-app/July Patient Report.xls'
];

// Field mapping for Excel columns to Patient model
const fieldMappings = {
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
  'Reg Date': 'registrationDate'
};

// Utility functions
function cleanString(value) {
  return value ? value.toString().trim() : '';
}

function formatDate(value) {
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

function normalizeGender(value) {
  if (!value) return 'Other';
  
  const gender = value.toString().toLowerCase().trim();
  if (gender.startsWith('m') || gender === 'male') return 'Male';
  if (gender.startsWith('f') || gender === 'female') return 'Female';
  return 'Other';
}

function formatMobileNumber(value) {
  if (!value) return '';
  
  const mobile = value.toString().replace(/\D/g, '');
  if (mobile.length === 10) return mobile;
  if (mobile.length === 11 && mobile.startsWith('0')) return mobile.substring(1);
  if (mobile.length === 12 && mobile.startsWith('91')) return mobile.substring(2);
  if (mobile.length === 13 && mobile.startsWith('+91')) return mobile.substring(3);
  
  return mobile.length >= 10 ? mobile.substring(-10) : mobile;
}

function formatPinCode(value) {
  if (!value) return '000000';
  
  const pinCode = value.toString().replace(/\D/g, '');
  return pinCode.length === 6 ? pinCode : '000000';
}

function calculateAge(dateOfBirth) {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

function getMappedFieldName(header) {
  // Direct mapping
  if (fieldMappings[header]) {
    return fieldMappings[header];
  }
  
  // Case-insensitive mapping
  const lowerHeader = header.toLowerCase();
  for (const [key, value] of Object.entries(fieldMappings)) {
    if (key.toLowerCase() === lowerHeader) {
      return value;
    }
  }
  
  return null;
}

function isEmptyRow(row) {
  return !row || row.every(cell => !cell || cell.toString().trim() === '');
}

function mapRowToPatient(headers, row, rowNumber) {
  try {
    const mappedData = {};
    
    // Map Excel columns to patient fields
    headers.forEach((header, index) => {
      const value = row[index];
      if (value !== undefined && value !== null && value !== '') {
        const mappedField = getMappedFieldName(header.toString().trim());
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
    const patient = {
      firstName: cleanString(mappedData['firstName']),
      middleName: mappedData['middleName'] ? cleanString(mappedData['middleName']) : '',
      lastName: cleanString(mappedData['lastName']),
      dateOfBirth: formatDate(mappedData['dateOfBirth']),
      gender: normalizeGender(mappedData['gender']),
      mobileNumber: formatMobileNumber(mappedData['mobileNumber']),
      email: mappedData['email'] ? cleanString(mappedData['email']) : '',
      address: mappedData['address'] ? cleanString(mappedData['address']) : 'Not provided',
      city: mappedData['city'] ? cleanString(mappedData['city']) : 'Not provided',
      state: mappedData['state'] ? cleanString(mappedData['state']) : 'Not provided',
      pinCode: mappedData['pinCode'] ? formatPinCode(mappedData['pinCode']) : '000000',
      registrationDate: mappedData['registrationDate'] ? formatDate(mappedData['registrationDate']) : new Date().toISOString().split('T')[0],
      emergencyContactName: mappedData['emergencyContactName'] ? cleanString(mappedData['emergencyContactName']) : '',
      emergencyContactNumber: mappedData['emergencyContactNumber'] ? formatMobileNumber(mappedData['emergencyContactNumber']) : ''
    };

    // Calculate age if date of birth is provided
    if (patient.dateOfBirth) {
      patient.age = calculateAge(patient.dateOfBirth);
    }

    return patient;
  } catch (error) {
    console.error(`Error mapping row ${rowNumber}:`, error);
    return null;
  }
}

function parseExcelFile(filePath) {
  console.log(`\nProcessing file: ${path.basename(filePath)}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }

  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      console.error('Excel file must contain at least a header row and one data row.');
      return [];
    }

    const headers = jsonData[0];
    const dataRows = jsonData.slice(1);
    
    console.log(`Found ${headers.length} columns and ${dataRows.length} data rows`);
    console.log('Headers:', headers);
    
    const patients = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (isEmptyRow(row)) continue;
      
      const patient = mapRowToPatient(headers, row, i + 2); // +2 for 1-based indexing and header
      if (patient) {
        patients.push(patient);
      }
    }
    
    console.log(`Successfully parsed ${patients.length} patients from ${path.basename(filePath)}`);
    return patients;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

async function createPatient(patient) {
  // For now, we'll just log the patient data
  // You can uncomment the HTTP request code below to actually send to API
  
  console.log('Patient to be created:', {
    name: `${patient.firstName} ${patient.middleName} ${patient.lastName}`.trim(),
    mobile: patient.mobileNumber,
    email: patient.email,
    city: patient.city,
    age: patient.age
  });
  
  // Uncomment below to actually send HTTP requests to your API
  /*
  const fetch = require('node-fetch');
  
  try {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization headers if needed
        // 'Authorization': 'Bearer YOUR_TOKEN'
      },
      body: JSON.stringify(patient)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
  */
  
  // Simulate success for testing
  return patient;
}

async function bulkUploadPatients(patients) {
  const result = {
    total: patients.length,
    successful: 0,
    failed: 0,
    errors: [],
    duplicates: 0
  };

  console.log(`\nStarting bulk upload of ${patients.length} patients...`);
  
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    const progress = Math.round(((i + 1) / patients.length) * 100);
    
    console.log(`[${progress}%] Processing patient ${i + 1}/${patients.length}: ${patient.firstName} ${patient.lastName}`);
    
    try {
      await createPatient(patient);
      result.successful++;
    } catch (error) {
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

  return result;
}

async function main() {
  console.log('=== Patient Bulk Upload Script ===');
  console.log(`Processing ${EXCEL_FILES.length} Excel files...`);
  
  let allPatients = [];
  
  // Process each Excel file
  for (const filePath of EXCEL_FILES) {
    const patients = parseExcelFile(filePath);
    allPatients = allPatients.concat(patients);
  }
  
  console.log(`\nTotal patients extracted: ${allPatients.length}`);
  
  if (allPatients.length === 0) {
    console.log('No patients found to upload.');
    return;
  }
  
  // Remove duplicates based on mobile number
  const uniquePatients = [];
  const seenMobiles = new Set();
  
  for (const patient of allPatients) {
    if (!seenMobiles.has(patient.mobileNumber)) {
      seenMobiles.add(patient.mobileNumber);
      uniquePatients.push(patient);
    } else {
      console.log(`Duplicate mobile number found: ${patient.mobileNumber} for ${patient.firstName} ${patient.lastName}`);
    }
  }
  
  console.log(`Unique patients after deduplication: ${uniquePatients.length}`);
  
  // Save to JSON file for review
  const outputFile = 'extracted_patients.json';
  fs.writeFileSync(outputFile, JSON.stringify(uniquePatients, null, 2));
  console.log(`\nPatient data saved to ${outputFile} for review.`);
  
  // Uncomment below to actually upload to API
  /*
  console.log('\nStarting upload to API...');
  const result = await bulkUploadPatients(uniquePatients);
  
  console.log('\n=== Upload Results ===');
  console.log(`Total: ${result.total}`);
  console.log(`Successful: ${result.successful}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Duplicates: ${result.duplicates}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(error => console.log(`- ${error}`));
  }
  */
  
  console.log('\n=== Script completed ===');
  console.log('Review the extracted_patients.json file and uncomment the upload section to proceed with actual upload.');
}

// Run the script
main().catch(console.error);
