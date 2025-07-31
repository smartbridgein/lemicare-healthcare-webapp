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

// Utility functions
function cleanString(value) {
  return value ? value.toString().trim() : '';
}

function formatMobileNumber(value) {
  if (!value) return '';
  
  const mobile = value.toString().replace(/\D/g, '');
  if (mobile.length === 10) return mobile;
  if (mobile.length === 11 && mobile.startsWith('0')) return mobile.substring(1);
  if (mobile.length === 12 && mobile.startsWith('91')) return mobile.substring(2);
  if (mobile.length === 13 && mobile.startsWith('+91')) return mobile.substring(3);
  
  return mobile.length >= 10 ? mobile.substring(mobile.length - 10) : mobile;
}

function parsePatientName(fullName) {
  if (!fullName) return { firstName: '', middleName: '', lastName: '' };
  
  const nameParts = fullName.toString().trim().split(' ').filter(part => part.length > 0);
  
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], middleName: '', lastName: 'Patient' };
  } else if (nameParts.length === 2) {
    return { firstName: nameParts[0], middleName: '', lastName: nameParts[1] };
  } else {
    return {
      firstName: nameParts[0],
      middleName: nameParts.slice(1, -1).join(' '),
      lastName: nameParts[nameParts.length - 1]
    };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  try {
    // Handle DD/MM/YYYY format from Excel
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        // Assuming DD/MM/YYYY format
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    
    // Handle Excel date serial numbers
    if (typeof dateStr === 'number') {
      const date = XLSX.SSF.parse_date_code(dateStr);
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    
    // Try to parse as regular date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn(`Could not parse date: ${dateStr}`);
  }
  
  return new Date().toISOString().split('T')[0];
}

function mapExcelRecordToPatient(record, source) {
  try {
    // Extract patient name and parse it
    const patientName = record['Patient Name '] || record['Patient Name'] || '';
    const { firstName, middleName, lastName } = parsePatientName(patientName);
    
    // Extract and format mobile number
    const mobileNumber = formatMobileNumber(record['Contact No'] || record['Contact'] || '');
    
    // Extract registration date
    const registrationDate = formatDate(record['Date'] || '');
    
    // Validate required fields
    if (!firstName || !lastName || !mobileNumber || mobileNumber.length !== 10) {
      console.warn(`Skipping invalid record from ${source}: ${patientName} - ${mobileNumber}`);
      return null;
    }
    
    // Create patient object matching the Patient model
    const patient = {
      firstName: firstName,
      middleName: middleName || '',
      lastName: lastName,
      dateOfBirth: '', // Not available in Excel data
      age: 0, // Will be calculated if DOB is available
      gender: 'Other', // Not available in Excel data
      mobileNumber: mobileNumber,
      email: '', // Not available in Excel data
      address: 'Not provided', // Not available in Excel data
      city: 'Not provided', // Not available in Excel data
      state: 'Not provided', // Not available in Excel data
      pinCode: '000000', // Not available in Excel data
      registrationDate: registrationDate,
      emergencyContactName: '', // Not available in Excel data
      emergencyContactNumber: '', // Not available in Excel data
      
      // Additional metadata for tracking
      _source: source,
      _originalPatientId: record['Patient Id'] || '',
      _originalBillNo: record['Bill No. '] || record['Bill No'] || '',
      _billType: record['Bill Type. '] || record['Bill Type'] || 'Sales Invoice'
    };
    
    return patient;
  } catch (error) {
    console.error(`Error mapping record from ${source}:`, error, record);
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
    
    // Convert to JSON using first row as headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`Found ${jsonData.length} records in ${path.basename(filePath)}`);
    
    if (jsonData.length === 0) {
      console.warn('No data found in file');
      return [];
    }
    
    // Show sample of headers
    const sampleRecord = jsonData[0];
    console.log('Headers found:', Object.keys(sampleRecord));
    console.log('Sample record:', sampleRecord);
    
    const patients = [];
    
    for (let i = 0; i < jsonData.length; i++) {
      const record = jsonData[i];
      
      // Skip empty rows
      const hasData = Object.values(record).some(value => 
        value && value.toString().trim() !== ''
      );
      
      if (!hasData) continue;
      
      const patient = mapExcelRecordToPatient(record, path.basename(filePath));
      if (patient) {
        patients.push(patient);
      }
    }
    
    console.log(`Successfully parsed ${patients.length} valid patients from ${path.basename(filePath)}`);
    return patients;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

async function createPatient(patient) {
  // For testing, we'll just log the patient data
  // Uncomment the HTTP request code below to actually send to API
  
  console.log(`Creating patient: ${patient.firstName} ${patient.lastName} (${patient.mobileNumber})`);
  
  // Remove metadata fields before sending to API
  const cleanPatient = { ...patient };
  delete cleanPatient._source;
  delete cleanPatient._originalPatientId;
  delete cleanPatient._originalBillNo;
  delete cleanPatient._billType;
  
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
      body: JSON.stringify(cleanPatient)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
  */
  
  // Simulate success for testing
  return cleanPatient;
}

async function bulkUploadPatients(patients) {
  const result = {
    total: patients.length,
    successful: 0,
    failed: 0,
    errors: [],
    duplicates: 0,
    skipped: 0
  };

  console.log(`\nStarting bulk upload of ${patients.length} patients...`);
  
  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i];
    const progress = Math.round(((i + 1) / patients.length) * 100);
    
    process.stdout.write(`\r[${progress}%] Processing ${i + 1}/${patients.length}: ${patient.firstName} ${patient.lastName}`);
    
    try {
      await createPatient(patient);
      result.successful++;
    } catch (error) {
      result.failed++;
      const errorMsg = error.message || 'Unknown error';
      
      if (error.status === 409 || errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
        result.duplicates++;
        result.errors.push(`Duplicate: ${patient.firstName} ${patient.lastName} (${patient.mobileNumber})`);
      } else {
        result.errors.push(`Failed: ${patient.firstName} ${patient.lastName} - ${errorMsg}`);
      }
    }
    
    // Add small delay to prevent overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('\n'); // New line after progress
  return result;
}

function removeDuplicates(patients) {
  console.log('\nRemoving duplicates based on mobile number...');
  
  const uniquePatients = [];
  const seenMobiles = new Map();
  const duplicates = [];
  
  for (const patient of patients) {
    const mobile = patient.mobileNumber;
    
    if (seenMobiles.has(mobile)) {
      const existing = seenMobiles.get(mobile);
      duplicates.push({
        duplicate: patient,
        original: existing
      });
    } else {
      seenMobiles.set(mobile, patient);
      uniquePatients.push(patient);
    }
  }
  
  console.log(`Original records: ${patients.length}`);
  console.log(`Unique records: ${uniquePatients.length}`);
  console.log(`Duplicates found: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log('\nSample duplicates:');
    duplicates.slice(0, 5).forEach(dup => {
      console.log(`  ${dup.duplicate.firstName} ${dup.duplicate.lastName} (${dup.duplicate.mobileNumber}) from ${dup.duplicate._source}`);
      console.log(`    vs ${dup.original.firstName} ${dup.original.lastName} from ${dup.original._source}`);
    });
  }
  
  return uniquePatients;
}

async function main() {
  console.log('=== Patient Bulk Upload Script ===');
  console.log('Processing Excel files and uploading to Firestore via API...\n');
  
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
  
  // Remove duplicates
  const uniquePatients = removeDuplicates(allPatients);
  
  // Save extracted data for review
  const outputFile = 'patients_ready_for_upload.json';
  fs.writeFileSync(outputFile, JSON.stringify(uniquePatients, null, 2));
  console.log(`\nPatient data saved to ${outputFile} for review.`);
  
  // Show statistics by source
  console.log('\n=== Statistics by Source ===');
  const sourceStats = {};
  uniquePatients.forEach(patient => {
    const source = patient._source;
    sourceStats[source] = (sourceStats[source] || 0) + 1;
  });
  
  Object.entries(sourceStats).forEach(([source, count]) => {
    console.log(`${source}: ${count} patients`);
  });
  
  // Ask for confirmation before uploading
  console.log('\n=== Ready to Upload ===');
  console.log(`${uniquePatients.length} unique patients ready for upload.`);
  console.log('\nTo proceed with the actual upload:');
  console.log('1. Review the patients_ready_for_upload.json file');
  console.log('2. Uncomment the HTTP request code in the createPatient function');
  console.log('3. Update the API_BASE_URL if needed');
  console.log('4. Run the script again');
  
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
    console.log('\nErrors (first 10):');
    result.errors.slice(0, 10).forEach(error => console.log(`- ${error}`));
    
    if (result.errors.length > 10) {
      console.log(`... and ${result.errors.length - 10} more errors`);
    }
  }
  
  // Save detailed results
  fs.writeFileSync('upload_results.json', JSON.stringify({
    summary: {
      total: result.total,
      successful: result.successful,
      failed: result.failed,
      duplicates: result.duplicates
    },
    errors: result.errors,
    timestamp: new Date().toISOString()
  }, null, 2));
  
  console.log('\nDetailed results saved to upload_results.json');
  */
  
  console.log('\n=== Script completed ===');
}

// Run the script
main().catch(console.error);
