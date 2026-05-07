const axios = require('axios');

async function test() {
  const email = 'akun.intention2@gmail.com';
  const apiKey = 'bc2c87e4f2882c6680326182824172270';
  
  console.log('Testing Cloudflare API with Global API Key...\n');
  
  try {
    const response = await axios.get('https://api.cloudflare.com/client/v4/zones', {
      headers: {
        'X-Auth-Email': email,
        'X-Auth-Key': apiKey,
        'Content-Type': 'application/json'
      },
      params: {
        per_page: 5
      },
      timeout: 10000
    });
    
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Zones found:', response.data.result.length);
    console.log('\nZones:');
    response.data.result.forEach((zone, i) => {
      console.log(`  ${i + 1}. ${zone.name} (${zone.id})`);
    });
    
  } catch (error) {
    console.log('❌ Error!');
    console.log('Status:', error.response?.status);
    console.log('Message:', error.response?.data?.errors?.[0]?.message || error.message);
    console.log('\nFull error:', JSON.stringify(error.response?.data, null, 2));
  }
}

test();
