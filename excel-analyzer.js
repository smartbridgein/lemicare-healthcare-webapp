const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Configuration
const EXCEL_FILES = [
  '/Volumes/Extreme SSD/mack-backup/hanan-clinic-app/cosmicdoc-apps/healthcare-app/May Patient Report.xls',
  '/Volumes/Extreme SSD/mack-backup/hanan-clinic-app/cosmicdoc-apps/healthcare-app/June Patient Report.xls',
  '/Volumes/Extreme SSD/mack-backup/hanan-clinic-app/cosmicdoc-apps/healthcare-app/July Patient Report.xls'
];

function analyzeExcelFile(filePath) {
  console.log(`\n=== Analyzing: ${path.basename(filePath)} ===`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }

  try {
    const workbook = XLSX.readFile(filePath);
    
    console.log(`Number of sheets: ${workbook.SheetNames.length}`);
    console.log(`Sheet names: ${workbook.SheetNames.join(', ')}`);
    
    // Analyze each sheet
    workbook.SheetNames.forEach((sheetName, index) => {
      console.log(`\n--- Sheet ${index + 1}: ${sheetName} ---`);
      
      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      
      console.log(`Range: ${worksheet['!ref'] || 'Empty'}`);
      console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);
      
      // Get first 10 rows as array of arrays
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        range: 0,
        defval: '' 
      });
      
      console.log(`Total data rows: ${jsonData.length}`);
      
      if (jsonData.length > 0) {
        console.log('\nFirst 10 rows:');
        jsonData.slice(0, 10).forEach((row, rowIndex) => {
          console.log(`Row ${rowIndex + 1}:`, row.slice(0, 10)); // Show first 10 columns
        });
        
        // Try to identify potential header row
        console.log('\nPotential headers analysis:');
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          const row = jsonData[i];
          const nonEmptyCount = row.filter(cell => cell && cell.toString().trim()).length;
          console.log(`Row ${i + 1} - Non-empty cells: ${nonEmptyCount}, Content: [${row.slice(0, 5).join(', ')}...]`);
        }
      }
      
      // Try to convert to JSON with first row as header
      if (jsonData.length > 1) {
        console.log('\nTrying first row as headers:');
        try {
          const jsonWithHeaders = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          console.log(`Records with headers: ${jsonWithHeaders.length}`);
          if (jsonWithHeaders.length > 0) {
            console.log('Sample record keys:', Object.keys(jsonWithHeaders[0]));
            console.log('Sample record:', jsonWithHeaders[0]);
          }
        } catch (error) {
          console.log('Error parsing with headers:', error.message);
        }
      }
    });
    
    return {
      file: filePath,
      sheets: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      workbook: workbook
    };
    
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error.message);
    return null;
  }
}

function extractAllPossiblePatientData(filePath) {
  console.log(`\n=== Extracting data from: ${path.basename(filePath)} ===`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }

  try {
    const workbook = XLSX.readFile(filePath);
    let allPatients = [];
    
    // Process each sheet
    workbook.SheetNames.forEach(sheetName => {
      console.log(`\nProcessing sheet: ${sheetName}`);
      
      const worksheet = workbook.Sheets[sheetName];
      
      // Try different approaches to extract data
      
      // Approach 1: Use first row as headers
      try {
        const jsonWithHeaders = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        console.log(`Approach 1 - Records found: ${jsonWithHeaders.length}`);
        
        if (jsonWithHeaders.length > 0) {
          const sampleKeys = Object.keys(jsonWithHeaders[0]);
          console.log('Headers found:', sampleKeys);
          
          // Look for patient-like data
          const patientRecords = jsonWithHeaders.filter(record => {
            // Check if record has any name-like or phone-like fields
            const values = Object.values(record);
            const hasName = values.some(val => 
              val && typeof val === 'string' && val.trim().length > 2 && 
              /^[A-Za-z\s]+$/.test(val.trim())
            );
            const hasPhone = values.some(val => 
              val && /\d{10}/.test(val.toString().replace(/\D/g, ''))
            );
            
            return hasName || hasPhone;
          });
          
          console.log(`Potential patient records: ${patientRecords.length}`);
          
          if (patientRecords.length > 0) {
            console.log('Sample patient record:', patientRecords[0]);
            allPatients = allPatients.concat(patientRecords.map(record => ({
              source: `${path.basename(filePath)} - ${sheetName}`,
              approach: 'headers',
              data: record
            })));
          }
        }
      } catch (error) {
        console.log('Approach 1 failed:', error.message);
      }
      
      // Approach 2: Raw array data
      try {
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        console.log(`Approach 2 - Raw rows: ${rawData.length}`);
        
        if (rawData.length > 0) {
          // Look for rows that might contain patient data
          const potentialDataRows = rawData.filter((row, index) => {
            if (index === 0) return false; // Skip potential header
            
            const nonEmptyCount = row.filter(cell => cell && cell.toString().trim()).length;
            if (nonEmptyCount < 2) return false; // Need at least 2 fields
            
            // Look for name-like and phone-like patterns
            const hasName = row.some(cell => 
              cell && typeof cell === 'string' && cell.trim().length > 2 && 
              /^[A-Za-z\s]+$/.test(cell.trim())
            );
            const hasPhone = row.some(cell => 
              cell && /\d{10}/.test(cell.toString().replace(/\D/g, ''))
            );
            
            return hasName || hasPhone;
          });
          
          console.log(`Potential data rows: ${potentialDataRows.length}`);
          
          if (potentialDataRows.length > 0) {
            console.log('Sample data row:', potentialDataRows[0]);
            allPatients = allPatients.concat(potentialDataRows.map((row, index) => ({
              source: `${path.basename(filePath)} - ${sheetName}`,
              approach: 'raw',
              rowIndex: index + 1,
              data: row
            })));
          }
        }
      } catch (error) {
        console.log('Approach 2 failed:', error.message);
      }
    });
    
    return allPatients;
    
  } catch (error) {
    console.error(`Error extracting from file ${filePath}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('=== Excel File Analyzer ===');
  console.log('This script will analyze the structure of your Excel files to understand the data format.\n');
  
  const analysisResults = [];
  const extractedData = [];
  
  // Analyze each file
  for (const filePath of EXCEL_FILES) {
    const analysis = analyzeExcelFile(filePath);
    if (analysis) {
      analysisResults.push(analysis);
    }
    
    const extracted = extractAllPossiblePatientData(filePath);
    extractedData.push(...extracted);
  }
  
  // Summary
  console.log('\n=== ANALYSIS SUMMARY ===');
  analysisResults.forEach(result => {
    console.log(`${path.basename(result.file)}: ${result.sheets} sheet(s) - ${result.sheetNames.join(', ')}`);
  });
  
  console.log(`\nTotal potential patient records found: ${extractedData.length}`);
  
  if (extractedData.length > 0) {
    // Save extracted data for review
    const outputFile = 'extracted_raw_data.json';
    fs.writeFileSync(outputFile, JSON.stringify(extractedData, null, 2));
    console.log(`\nRaw extracted data saved to ${outputFile}`);
    
    // Show sample of what was found
    console.log('\n=== SAMPLE EXTRACTED DATA ===');
    extractedData.slice(0, 5).forEach((item, index) => {
      console.log(`\nSample ${index + 1}:`);
      console.log(`Source: ${item.source}`);
      console.log(`Approach: ${item.approach}`);
      console.log(`Data:`, item.data);
    });
    
    // Try to identify common patterns
    console.log('\n=== PATTERN ANALYSIS ===');
    const headerApproachData = extractedData.filter(item => item.approach === 'headers');
    if (headerApproachData.length > 0) {
      const allKeys = new Set();
      headerApproachData.forEach(item => {
        Object.keys(item.data).forEach(key => allKeys.add(key));
      });
      console.log('All unique column headers found:', Array.from(allKeys));
    }
    
    const rawApproachData = extractedData.filter(item => item.approach === 'raw');
    if (rawApproachData.length > 0) {
      console.log('Sample raw data structures:');
      rawApproachData.slice(0, 3).forEach((item, index) => {
        console.log(`Raw sample ${index + 1}:`, item.data);
      });
    }
  }
  
  console.log('\n=== RECOMMENDATIONS ===');
  if (extractedData.length === 0) {
    console.log('No patient data was found. Possible issues:');
    console.log('1. Files might be empty or corrupted');
    console.log('2. Data might be in a different format than expected');
    console.log('3. Files might contain only summary/report data, not individual patient records');
    console.log('\nPlease check the file contents manually and verify they contain patient data.');
  } else {
    console.log('Patient data was found! Next steps:');
    console.log('1. Review the extracted_raw_data.json file');
    console.log('2. Identify the correct column mappings');
    console.log('3. Update the bulk upload script with the correct field mappings');
    console.log('4. Run the updated script to import the data');
  }
}

// Run the analyzer
main().catch(console.error);
