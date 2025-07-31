import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BulkOpdServiceInserter {
  
  private opdServices = [
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
    { name: 'HYDRA FACIEAL', rate: 7000 }, // Note: Duplicate name with different rate
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

  constructor(private http: HttpClient) {}

  async insertAllOpdServices(): Promise<void> {
    console.log(`Starting bulk insertion of ${this.opdServices.length} OPD services...`);
    
    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{service: any, error: any}> = [];

    for (let i = 0; i < this.opdServices.length; i++) {
      const service = this.opdServices[i];
      
      const serviceData = {
        name: service.name,
        description: `OPD Service - ${service.name}`,
        group: 'OPD',
        rate: service.rate,
        active: true
      };

      try {
        console.log(`Inserting service ${i + 1}/${this.opdServices.length}: ${service.name} (₹${service.rate})`);
        
        const response = await this.http.post<any>(`${environment.apiUrl}/api/services`, serviceData).toPromise();
        
        if (response && response.success) {
          successCount++;
          console.log(`✅ Successfully inserted: ${service.name}`);
        } else {
          failureCount++;
          console.error(`❌ Failed to insert: ${service.name}`, response);
          failures.push({ service, error: response });
        }
        
        // Add a small delay to avoid overwhelming the server
        await this.delay(100);
        
      } catch (error) {
        failureCount++;
        console.error(`❌ Error inserting: ${service.name}`, error);
        failures.push({ service, error });
      }
    }

    // Summary
    console.log('\n=== BULK INSERTION SUMMARY ===');
    console.log(`Total services: ${this.opdServices.length}`);
    console.log(`✅ Successfully inserted: ${successCount}`);
    console.log(`❌ Failed insertions: ${failureCount}`);
    
    if (failures.length > 0) {
      console.log('\n=== FAILED INSERTIONS ===');
      failures.forEach((failure, index) => {
        console.log(`${index + 1}. ${failure.service.name} (₹${failure.service.rate})`);
        console.log(`   Error:`, failure.error);
      });
    }
    
    console.log('\n=== BULK INSERTION COMPLETED ===');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Standalone function to run the bulk insertion
export async function runBulkOpdServiceInsertion(http: HttpClient): Promise<void> {
  const inserter = new BulkOpdServiceInserter(http);
  await inserter.insertAllOpdServices();
}
