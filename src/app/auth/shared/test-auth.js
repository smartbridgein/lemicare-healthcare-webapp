// Simple utility to test authentication directly
// Copy and paste this into the browser console when on the login page

function testAuthWithConsole() {
  console.log('Testing direct authentication to backend...');
  
  const credentials = {
    email: 'admin@cosmicmed.com',
    password: 'Test123!'
  };
  
  console.log('Sending credentials:', credentials);
  
  fetch('http://localhost:8081/api/public/auth/signin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials)
  })
  .then(response => {
    console.log('Response status:', response.status);
    return response.text().then(text => {
      try {
        return text ? JSON.parse(text) : {};
      } catch (error) {
        console.error('Error parsing JSON:', error);
        console.log('Raw response:', text);
        return { rawResponse: text };
      }
    });
  })
  .then(data => {
    console.log('Authentication response:', data);
  })
  .catch(error => {
    console.error('Authentication error:', error);
  });
}

// Call the function
testAuthWithConsole();
