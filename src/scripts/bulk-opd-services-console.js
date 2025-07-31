// Browser Console Script for Bulk OPD Services Insertion
// Run this in the browser console while on the service-master page

const OPD_SERVICES = [
  { name: 'advance exo', rate: 75000 },
  { name: 'ADVANCE EXO EXOSOMES', rate: 15000 },
  { name: 'AQ', rate: 10000 },
  { name: 'BLACK PEEL', rate: 3000 },
  { name: 'BOTOX', rate: 30000 },
  { name: 'CARBON LASER PEEL', rate: 7000 },
  { name: 'CO2 LASER', rate: 3000 },
  { name: 'CONSULTATION', rate: 700 },
  { name: 'DRESSING', rate: 300 },
  { name: 'DRS', rate: 10000 },
  { name: 'EAR LOBE REPAIR (PER EAR)', rate: 3000 },
  { name: 'EXCIMER', rate: 700 },
  { name: 'EXCISION', rate: 3000 },
  { name: 'EXCISION BIOPSY', rate: 5000 },
  { name: 'EYE LID SURGERY', rate: 9000 },
  { name: 'EZACNE', rate: 45 },
  { name: 'FACE WASH', rate: 320 },
  { name: 'FERRULAC PEEL', rate: 4000 },
  { name: 'FERULAC BOOSTER PEEL', rate: 5000 },
  { name: 'FILLERS', rate: 25000 },
  { name: 'fractinal co2 laser', rate: 8000 },
  { name: 'GFC', rate: 7000 },
  { name: 'GLUTA WHITENING PEEL', rate: 4000 },
  { name: 'GLYCOLIC', rate: 3000 },
  { name: 'HIFU FACE', rate: 10000 },
  { name: 'HIFU DOUBLE CHIN', rate: 7000 },
  { name: 'HYDRA FACIAL', rate: 12000 },
  { name: 'HYDRA FACIEAL', rate: 5000 },
  { name: 'HYDRA FACIEAL (Premium)', rate: 7000 }, // Renamed to avoid duplicate
  { name: 'ILS', rate: 1000 },
  { name: 'ils injection', rate: 2000 },
  { name: 'INJECTION LIPOLYSIS', rate: 15000 },
  { name: 'IV GLUATHIONE', rate: 6000 },
  { name: 'IV GLUTA', rate: 40000 },
  { name: 'LHR', rate: 7000 },
  { name: 'LHR CHIN', rate: 3000 },
  { name: 'LHR UPPERLIP', rate: 3000 },
  { name: 'LIDOCAINE', rate: 112 },
  { name: 'LIP FLIP', rate: 9000 },
  { name: 'MANDELIC T PEEL', rate: 4000 },
  { name: 'Medi Facial', rate: 15000 },
  { name: 'MEDIFACIAL', rate: 8000 },
  { name: 'melanostop peel', rate: 5000 },
  { name: 'MICRONEEDLING', rate: 5000 },
  { name: 'MNRF', rate: 7000 },
  { name: 'NAIL SURGERY (PER NAIL)', rate: 7000 },
  { name: 'NMF PEEL', rate: 4000 },
  { name: 'PROCEDURE', rate: 6000 },
  { name: 'PRP', rate: 5000 },
  { name: 'PUMPKIN PEEL', rate: 4000 },
  { name: 'PUNCH BIOPSY', rate: 6000 },
  { name: 'RAPLITE FACE WASH', rate: 450 },
  { name: 'RF', rate: 3000 },
  { name: 'SESGLYCOPEEL', rate: 4000 },
  { name: 'SKIN HYDRATION BOOSTER', rate: 20000 },
  { name: 'TATTO REMOVAL', rate: 8000 },
  { name: 'THREAD LIFTING', rate: 45000 },
  { name: 'TRIPLE COMBO', rate: 2000 },
  { name: 'TRUFACE FACE WASH', rate: 320 },
  { name: 'YELLOW PEEL', rate: 5000 }
];

// Function to get API URL from environment
function getApiUrl() {
  // Try to get from Angular environment if available
  if (typeof window !== 'undefined' && window.ng && window.ng.getComponent) {
    try {
      const component = window.ng.getComponent(document.querySelector('app-service-master'));
      if (component && component.http) {
        return component.http.defaults?.baseURL || 'http://localhost:8080';
      }
    } catch (e) {
      console.log('Could not get API URL from component, using default');
    }
  }
  
  // Fallback to common API URLs
  return window.location.origin.includes('localhost') 
    ? 'http://localhost:8080' 
    : window.location.origin;
}

// Function to make HTTP POST request
async function postService(serviceData) {
  const apiUrl = getApiUrl();
  const response = await fetch(`${apiUrl}/api/services`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add any auth headers if needed
    },
    body: JSON.stringify(serviceData)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Main bulk insertion function
async function bulkInsertOpdServices() {
  console.log(`🚀 Starting bulk insertion of ${OPD_SERVICES.length} OPD services...`);
  console.log('API URL:', getApiUrl());
  
  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  for (let i = 0; i < OPD_SERVICES.length; i++) {
    const service = OPD_SERVICES[i];
    
    const serviceData = {
      name: service.name,
      description: `OPD Service - ${service.name}`,
      group: 'OPD',
      rate: service.rate,
      active: true
    };

    try {
      console.log(`📝 Inserting service ${i + 1}/${OPD_SERVICES.length}: ${service.name} (₹${service.rate})`);
      
      const response = await postService(serviceData);
      
      if (response && response.success) {
        successCount++;
        console.log(`✅ Successfully inserted: ${service.name}`);
      } else {
        failureCount++;
        console.error(`❌ Failed to insert: ${service.name}`, response);
        failures.push({ service, error: response });
      }
      
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      failureCount++;
      console.error(`❌ Error inserting: ${service.name}`, error);
      failures.push({ service, error: error.message });
    }
  }

  // Summary
  console.log('\n=== 📊 BULK INSERTION SUMMARY ===');
  console.log(`Total services: ${OPD_SERVICES.length}`);
  console.log(`✅ Successfully inserted: ${successCount}`);
  console.log(`❌ Failed insertions: ${failureCount}`);
  
  if (failures.length > 0) {
    console.log('\n=== ❌ FAILED INSERTIONS ===');
    failures.forEach((failure, index) => {
      console.log(`${index + 1}. ${failure.service.name} (₹${failure.service.rate})`);
      console.log(`   Error:`, failure.error);
    });
  }
  
  console.log('\n=== 🎉 BULK INSERTION COMPLETED ===');
  
  // Refresh the page to see the new services
  if (successCount > 0) {
    console.log('🔄 Refreshing page to show new services...');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
}

// Auto-run the bulk insertion
console.log('🎯 Bulk OPD Services Insertion Script Loaded');
console.log('📋 Services to insert:', OPD_SERVICES.length);
console.log('🚀 Starting insertion in 3 seconds...');
console.log('⚠️  Make sure you are on the service-master page and logged in!');

setTimeout(() => {
  bulkInsertOpdServices().catch(error => {
    console.error('💥 Bulk insertion failed:', error);
  });
}, 3000);
