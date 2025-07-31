// Development environment configuration
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8084', // Inventory service
  apiUrlInventory: 'http://localhost:8082', // Inventory service
  opdApiUrl: 'http://localhost:8084', // OPD management service
  billingApiUrl: 'http://localhost:8084', // Billing service
  authApiUrl: 'http://localhost:8081',
  version: '1.0.0',
  firebase: {
    // Updated with actual Firebase configuration values
    apiKey: "AIzaSyCNy_JhG3vHVOP_3lZ6QtR62ZtSHXbPA-A",
    authDomain: "cosmicdoc.firebaseapp.com",
    projectId: "cosmicdoc",
    storageBucket: "cosmicdoc.appspot.com",
    messagingSenderId: "107654411252805635500",
    appId: "1:107654411252805635500:web:8f621e7d45a52af2c8b15e"
  }
};
