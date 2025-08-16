const squareup = require('squareup');

console.log('Available exports:', Object.keys(squareup));

// Try different ways to create client
try {
  const client = new squareup.Client({
    accessToken: 'EAAAl2YVKAQqIAkqeZ44SG5CJ76YwrojeLa1an3K1RYC9Rh8JjMXjkbAykLWr_FJ',
    environment: 'production'
  });
  
  console.log('Client created successfully');
  
  client.locationsApi.listLocations().then(response => {
    if (response.result.locations) {
      console.log('\n🏪 Your Square Production Locations:');
      console.log('=====================================');
      
      response.result.locations.forEach((location, index) => {
        console.log(`\nLocation ${index + 1}:`);
        console.log(`  ID: ${location.id}`);
        console.log(`  Name: ${location.name || 'N/A'}`);
      });
      
      if (response.result.locations.length > 0) {
        console.log('\n🎯 Use this Location ID in your .env.local:');
        console.log(`VITE_SQUARE_LOCATION_ID=${response.result.locations[0].id}`);
      }
    }
  }).catch(error => {
    console.error('Error:', error.message);
  });
  
} catch (error) {
  console.error('Error creating client:', error.message);
}
