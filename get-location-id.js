import pkg from 'squareup';
const { Client } = pkg;

// Configure Square client with production credentials
const client = new Client({
  accessToken: 'EAAAl2YVKAQqIAkqeZ44SG5CJ76YwrojeLa1an3K1RYC9Rh8JjMXjkbAykLWr_FJ',
  environment: 'production'
});

async function getLocations() {
  try {
    const locationsApi = client.locationsApi;
    const response = await locationsApi.listLocations();
    
    if (response.result.locations) {
      console.log('\n🏪 Your Square Production Locations:');
      console.log('=====================================');
      
      response.result.locations.forEach((location, index) => {
        console.log(`\nLocation ${index + 1}:`);
        console.log(`  ID: ${location.id}`);
        console.log(`  Name: ${location.name || 'N/A'}`);
        console.log(`  Status: ${location.status || 'N/A'}`);
        console.log(`  Address: ${location.address ? 
          `${location.address.addressLine1 || ''} ${location.address.locality || ''} ${location.address.administrativeDistrictLevel1 || ''}`.trim() 
          : 'N/A'}`);
      });
      
      // Show the primary location ID to use
      if (response.result.locations.length > 0) {
        const primaryLocation = response.result.locations[0];
        console.log('\n🎯 Use this Location ID in your .env.local:');
        console.log(`VITE_SQUARE_LOCATION_ID=${primaryLocation.id}`);
      }
    } else {
      console.log('No locations found');
    }
  } catch (error) {
    console.error('Error fetching locations:', error.message);
    if (error.result) {
      console.error('Square API Error:', error.result);
    }
  }
}

getLocations();
