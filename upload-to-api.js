const fs = require('fs');
const path = require('path');

// Configuration - Update these values according to your setup
const API_BASE_URL = 'http://localhost:8084/api'; // Change to your backend URL
const PATIENTS_FILE = 'patients_ready_for_upload.json';
const BATCH_SIZE = 10; // Number of patients to upload in parallel
const DELAY_BETWEEN_BATCHES = 1000; // Delay in milliseconds between batches

// Authentication - Add your auth token here if required
const AUTH_TOKEN = ''; // Add Bearer token if authentication is required
const AUTH_HEADERS = AUTH_TOKEN ? { 'Authorization': `Bearer ${AUTH_TOKEN}` } : {};

// You'll need to install node-fetch: npm install node-fetch@2
// Using version 2 for CommonJS compatibility
let fetch;

async function initializeFetch() {
  try {
    fetch = (await import('node-fetch')).default;
  } catch (error) {
    console.error('node-fetch is required. Please install it with: npm install node-fetch@2');
    process.exit(1);
  }
}

// Gender detection based on Indian name patterns
function detectGenderFromName(fullName) {
  if (!fullName) return 'MALE'; // Default fallback
  
  const name = fullName.toLowerCase().trim();
  
  // Common female name endings in Indian languages
  const femaleEndings = [
    'a', 'i', 'ya', 'ka', 'na', 'ta', 'la', 'ma', 'ra', 'sa', 'va', 'wa',
    'ani', 'ari', 'avi', 'ini', 'ika', 'ita', 'iya', 'aja', 'ala', 'ana', 'apa',
    'asa', 'ata', 'ava', 'aya', 'eba', 'eda', 'ega', 'eka', 'ela', 'ema', 'ena',
    'epa', 'era', 'esa', 'eta', 'eva', 'eya', 'iba', 'ida', 'iga', 'ika', 'ila',
    'ima', 'ina', 'ipa', 'ira', 'isa', 'ita', 'iva', 'iya', 'oba', 'oda', 'oga',
    'oka', 'ola', 'oma', 'ona', 'opa', 'ora', 'osa', 'ota', 'ova', 'oya', 'uba',
    'uda', 'uga', 'uka', 'ula', 'uma', 'una', 'upa', 'ura', 'usa', 'uta', 'uva',
    'uya', 'devi', 'kumari', 'bai', 'ben', 'beevi', 'begum', 'khatun', 'bibi'
  ];
  
  // Common female name patterns
  const femalePatterns = [
    'priya', 'devi', 'kumari', 'shree', 'sri', 'lakshmi', 'saraswati', 'parvati',
    'radha', 'sita', 'gita', 'rita', 'nita', 'lata', 'maya', 'kala', 'mala',
    'valli', 'bala', 'kamala', 'padma', 'shanti', 'shakti', 'bhavani', 'durga',
    'kali', 'meera', 'geeta', 'seeta', 'reeta', 'neeta', 'leela', 'sheela',
    'heera', 'veera', 'meena', 'reena', 'seena', 'beena', 'teena', 'leena',
    'asha', 'usha', 'nisha', 'risha', 'tisha', 'kisha', 'misha', 'disha',
    'pooja', 'sooja', 'rooja', 'mooja', 'kooja', 'looja', 'hooja', 'booja',
    'rani', 'mani', 'sani', 'tani', 'kani', 'lani', 'hani', 'bani',
    'baby', 'ruby', 'judy', 'mary', 'rosy', 'daisy', 'lily', 'molly',
    'fatima', 'ayesha', 'zara', 'sara', 'noor', 'hoor', 'roop', 'soop',
    'beevi', 'banu', 'begum', 'khatun', 'bibi', 'sultana', 'shahana',
    'anjali', 'sanjali', 'manjali', 'ranjali', 'kanjali', 'tanjali'
  ];
  
  // Common male name patterns (for better accuracy)
  const malePatterns = [
    'kumar', 'raj', 'dev', 'krishna', 'ram', 'hari', 'vishnu', 'shiva',
    'ganesh', 'suresh', 'mahesh', 'naresh', 'dinesh', 'mukesh', 'rakesh',
    'ramesh', 'umesh', 'yogesh', 'lokesh', 'hitesh', 'ritesh', 'nitesh',
    'singh', 'sharma', 'gupta', 'agarwal', 'jain', 'shah', 'patel',
    'khan', 'ali', 'ahmed', 'mohammed', 'abdul', 'malik', 'hassan',
    'ravi', 'sanjay', 'vijay', 'ajay', 'jay', 'vinay', 'manoj', 'anil',
    'sunil', 'kapil', 'rahul', 'rohit', 'mohit', 'sumit', 'amit', 'lalit'
  ];
  
  // Check for explicit male patterns first
  for (const pattern of malePatterns) {
    if (name.includes(pattern)) {
      return 'MALE';
    }
  }
  
  // Check for female patterns
  for (const pattern of femalePatterns) {
    if (name.includes(pattern)) {
      return 'FEMALE';
    }
  }
  
  // Check female endings
  for (const ending of femaleEndings) {
    if (name.endsWith(ending)) {
      return 'FEMALE';
    }
  }
  
  // Default to male if no pattern matches
  return 'MALE';
}

// Transform patient data to match backend API requirements
function transformPatientForAPI(patient) {
  // Combine first, middle, last names into single name field
  const nameParts = [patient.firstName, patient.middleName, patient.lastName]
    .filter(part => part && part.trim() !== '')
    .map(part => part.trim());
  const fullName = nameParts.join(' ');
  
  // Generate a valid date of birth if missing
  let dateOfBirth = patient.dateOfBirth;
  if (!dateOfBirth || dateOfBirth === '') {
    // Default to a reasonable age (30 years old) if no DOB provided
    const defaultAge = 30;
    const birthYear = new Date().getFullYear() - defaultAge;
    dateOfBirth = `${birthYear}-01-01`;
  }
  
  // Format emergency contact number (must be 10-15 digits)
  let emergencyContactNumber = patient.emergencyContactNumber || '';
  if (emergencyContactNumber === '' || emergencyContactNumber.length < 10) {
    emergencyContactNumber = null; // Set to null if not valid
  }
  
  // Detect gender from name if not properly set
  let gender = patient.gender;
  if (gender === 'Other' || !gender || gender.trim() === '') {
    gender = detectGenderFromName(fullName);
  } else {
    gender = gender.toUpperCase();
  }
  
  // Use actual registration date from Excel files or default to today
  let registrationDate = patient.registrationDate;
  if (!registrationDate || registrationDate === '') {
    registrationDate = new Date().toISOString().split('T')[0]; // Default to today if missing
  }
  
  // Ensure registration date is in correct format for backend LocalDate parsing
  // Convert from YYYY-MM-DD string to ensure proper format
  if (typeof registrationDate === 'string' && registrationDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Already in correct format, keep as is
  } else {
    // Fallback to today's date if format is invalid
    registrationDate = new Date().toISOString().split('T')[0];
  }
  
  // Transform to backend API format
  const apiPatient = {
    name: fullName,
    phoneNumber: patient.mobileNumber,
    email: patient.email || null,
    dateOfBirth: dateOfBirth,
    gender: gender,
    address: patient.address !== 'Not provided' ? patient.address : null,
    city: patient.city !== 'Not provided' ? patient.city : null,
    state: patient.state !== 'Not provided' ? patient.state : null,
    pinCode: patient.pinCode !== '000000' ? patient.pinCode : null,
    emergencyContactName: patient.emergencyContactName || null,
    emergencyContactNumber: emergencyContactNumber,
    registrationDate: registrationDate
  };
  
  return apiPatient;
}

async function createPatient(patient, retryCount = 0) {
  const maxRetries = 3;
  
  try {
    // Transform patient data to match API requirements
    const apiPatient = transformPatientForAPI(patient);
    
    // Debug logging for first few patients to verify data
    if (retryCount === 0) {
      console.log(`\n[DEBUG] Sending patient: ${apiPatient.name}`);
      console.log(`[DEBUG] Registration Date: ${apiPatient.registrationDate}`);
      console.log(`[DEBUG] Original Date: ${patient.registrationDate}`);
    }
    
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADERS
      },
      body: JSON.stringify(apiPatient),
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle specific error cases
      if (response.status === 409) {
        throw new Error(`DUPLICATE: Patient already exists`);
      } else if (response.status === 400) {
        throw new Error(`VALIDATION: ${errorText}`);
      } else if (response.status >= 500 && retryCount < maxRetries) {
        // Retry on server errors
        console.log(`Server error, retrying (${retryCount + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
        return createPatient(patient, retryCount + 1);
      } else {
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('CONNECTION: Cannot connect to API server. Please ensure the backend is running.');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('CONNECTION: API server not found. Please check the API_BASE_URL.');
    } else {
      throw error;
    }
  }
}

async function uploadBatch(patients, batchNumber, totalBatches) {
  const results = {
    successful: 0,
    failed: 0,
    errors: []
  };
  
  console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${patients.length} patients)`);
  
  const promises = patients.map(async (patient, index) => {
    try {
      await createPatient(patient);
      process.stdout.write('✓');
      results.successful++;
    } catch (error) {
      process.stdout.write('✗');
      results.failed++;
      
      const errorType = error.message.split(':')[0];
      const patientInfo = `${patient.firstName} ${patient.lastName} (${patient.mobileNumber})`;
      
      results.errors.push({
        patient: patientInfo,
        error: error.message,
        type: errorType,
        source: patient._source
      });
      
      // Log first few errors for debugging
      if (results.failed <= 3) {
        console.log(`\n[DEBUG] Error for ${patientInfo}: ${error.message}`);
      }
    }
  });
  
  await Promise.all(promises);
  console.log(''); // New line after progress indicators
  
  return results;
}

async function bulkUploadPatients(patients) {
  const totalResults = {
    total: patients.length,
    successful: 0,
    failed: 0,
    errors: [],
    duplicates: 0,
    validationErrors: 0,
    connectionErrors: 0
  };
  
  console.log(`\nStarting bulk upload of ${patients.length} patients...`);
  console.log(`Batch size: ${BATCH_SIZE}, Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
  
  // Split patients into batches
  const batches = [];
  for (let i = 0; i < patients.length; i += BATCH_SIZE) {
    batches.push(patients.slice(i, i + BATCH_SIZE));
  }
  
  console.log(`Total batches: ${batches.length}`);
  
  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchResults = await uploadBatch(batch, i + 1, batches.length);
    
    // Aggregate results
    totalResults.successful += batchResults.successful;
    totalResults.failed += batchResults.failed;
    totalResults.errors = totalResults.errors.concat(batchResults.errors);
    
    // Categorize errors
    batchResults.errors.forEach(error => {
      if (error.type === 'DUPLICATE') {
        totalResults.duplicates++;
      } else if (error.type === 'VALIDATION') {
        totalResults.validationErrors++;
      } else if (error.type === 'CONNECTION') {
        totalResults.connectionErrors++;
      }
    });
    
    console.log(`Batch ${i + 1} completed: ${batchResults.successful} successful, ${batchResults.failed} failed`);
    
    // Delay between batches (except for the last batch)
    if (i < batches.length - 1) {
      console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  return totalResults;
}

function generateReport(results) {
  const report = {
    summary: {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
      successRate: ((results.successful / results.total) * 100).toFixed(2) + '%'
    },
    errorBreakdown: {
      duplicates: results.duplicates,
      validationErrors: results.validationErrors,
      connectionErrors: results.connectionErrors,
      otherErrors: results.failed - results.duplicates - results.validationErrors - results.connectionErrors
    },
    errors: results.errors,
    timestamp: new Date().toISOString()
  };
  
  return report;
}

async function main() {
  console.log('=== Patient Bulk Upload to API ===');
  
  // Initialize fetch
  await initializeFetch();
  
  // Check if patients file exists
  if (!fs.existsSync(PATIENTS_FILE)) {
    console.error(`Error: ${PATIENTS_FILE} not found.`);
    console.log('Please run patient-bulk-upload.js first to generate the patient data.');
    process.exit(1);
  }
  
  // Load patients data
  let patients;
  try {
    const data = fs.readFileSync(PATIENTS_FILE, 'utf8');
    patients = JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${PATIENTS_FILE}:`, error.message);
    process.exit(1);
  }
  
  console.log(`Loaded ${patients.length} patients from ${PATIENTS_FILE}`);
  
  // Show configuration
  console.log(`\nConfiguration:`);
  console.log(`- API URL: ${API_BASE_URL}`);
  console.log(`- Batch size: ${BATCH_SIZE}`);
  console.log(`- Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`);
  
  // Test API connection
  console.log('\nTesting API connection...');
  try {
    const response = await fetch(`${API_BASE_URL}/patients?limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADERS
      },
      timeout: 5000
    });
    
    if (response.ok) {
      console.log('✓ API connection successful');
      const data = await response.text();
      console.log('API response preview:', data.substring(0, 200) + '...');
    } else {
      console.log(`⚠ API responded with status ${response.status}`);
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
  } catch (error) {
    console.error('✗ API connection failed:', error.message);
    console.log('Please ensure your backend server is running and the API_BASE_URL is correct.');
    
    // Ask if user wants to continue anyway
    console.log('\nDo you want to continue with the upload anyway? (This will likely fail)');
    console.log('Press Ctrl+C to cancel, or wait 10 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  // Start upload
  const startTime = Date.now();
  const results = await bulkUploadPatients(patients);
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Generate and display report
  console.log('\n=== Upload Results ===');
  console.log(`Total patients: ${results.total}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success rate: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  console.log(`Duration: ${duration} seconds`);
  
  if (results.failed > 0) {
    console.log('\n=== Error Breakdown ===');
    console.log(`Duplicates: ${results.duplicates}`);
    console.log(`Validation errors: ${results.validationErrors}`);
    console.log(`Connection errors: ${results.connectionErrors}`);
    console.log(`Other errors: ${results.failed - results.duplicates - results.validationErrors - results.connectionErrors}`);
    
    console.log('\n=== Sample Errors ===');
    results.errors.slice(0, 10).forEach((error, index) => {
      console.log(`${index + 1}. ${error.patient}: ${error.error}`);
    });
    
    if (results.errors.length > 10) {
      console.log(`... and ${results.errors.length - 10} more errors`);
    }
  }
  
  // Save detailed report
  const report = generateReport(results);
  const reportFile = `upload_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportFile}`);
  
  // Save successful patients list
  if (results.successful > 0) {
    const successfulPatients = patients.filter((patient, index) => {
      return !results.errors.some(error => error.patient.includes(patient.mobileNumber));
    });
    
    const successFile = `successful_uploads_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(successFile, JSON.stringify(successfulPatients, null, 2));
    console.log(`Successful uploads saved to: ${successFile}`);
  }
  
  console.log('\n=== Upload completed ===');
  
  if (results.failed > 0) {
    console.log('\nTo retry failed uploads:');
    console.log('1. Check the error report for issues');
    console.log('2. Fix any validation or configuration problems');
    console.log('3. Filter out successful patients and retry');
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nUpload interrupted by user. Exiting...');
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
