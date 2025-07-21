// Cloud environment configuration pointing to Cloud Run services
export const environment = {
  production: true,
  apiUrlInventory: 'https://inventory-service-145837205370.asia-south1.run.app', // Inventory service
  apiUrl: 'https://opd-management-service-145837205370.asia-south1.run.app',
  billingApiUrl: 'https://opd-management-service-145837205370.asia-south1.run.app',
  authApiUrl: 'https://auth-service-145837205370.asia-south1.run.app',
  opdApiUrl: 'https://opd-management-service-145837205370.asia-south1.run.app', // OPD management service
  version: '1.0.0',
  firebase: {
    // Using same Firebase configuration as development
    apiKey: "AIzaSyCNy_JhG3vHVOP_3lZ6QtR62ZtSHXbPA-A",
    authDomain: "cosmicdoc.firebaseapp.com",
    projectId: "cosmicdoc",
    storageBucket: "cosmicdoc.appspot.com",
    messagingSenderId: "107654411252805635500",
    appId: "1:107654411252805635500:web:8f621e7d45a52af2c8b15e"
  }
};
