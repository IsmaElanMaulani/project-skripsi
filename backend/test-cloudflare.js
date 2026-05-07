require('dotenv').config();
const axios = require('axios');
const mysql = require('mysql2/promise');

async function testCloudflare() {
  try {
    console.log('=== CLOUDFLARE API TEST ===\n');

    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || 'root',
      database: process.env.MYSQL_DATABASE || 'project-skripsi'
    });

    console.log('✓ Connected to database');

    // Get settings from database
    const [tokenRows] = await connection.query('SELECT value FROM settings WHERE key_name = ?', ['cloudflare_api_token']);
    const [emailRows] = await connection.query('SELECT value FROM settings WHERE key_name = ?', ['cloudflare_email']);
    const [accountRows] = await connection.query('SELECT value FROM settings WHERE key_name = ?', ['cloudflare_account_id']);

    let apiToken = tokenRows[0]?.value || process.env.CLOUDFLARE_API_TOKEN;
    let email = emailRows[0]?.value || process.env.CLOUDFLARE_EMAIL;
    let accountId = accountRows[0]?.value || process.env.CLOUDFLARE_ACCOUNT_ID;

    console.log('\n📋 Configuration:');
    console.log('API Token/Key:', apiToken ? `${apiToken.substring(0, 20)}...` : 'NOT SET');
    console.log('Email:', email || 'NOT SET (will use Bearer token)');
    console.log('Account ID:', accountId || 'NOT SET');
    console.log('');

    if (!apiToken) {
      console.log('❌ API Token/Key not configured!');
      console.log('\n📖 Setup instructions:');
      console.log('1. Go to Settings page in the app');
      console.log('2. Fill in Cloudflare API Token or Global API Key');
      console.log('3. If using Global API Key, also fill in Email');
      console.log('4. Fill in Account ID (required for multi-zone)');
      await connection.end();
      process.exit(1);
    }

    // Build headers based on authentication method
    const headers = email && apiToken ? {
      'X-Auth-Email': email,
      'X-Auth-Key': apiToken,
      'Content-Type': 'application/json',
    } : {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };

    console.log('Authentication Method:', email ? '🔑 Global API Key + Email' : '🎫 Bearer Token');
    console.log('');

    // Test 1: Verify token (only for Bearer token)
    if (!email) {
      console.log('Test 1: Verify Token...');
      try {
        const res = await axios.get('https://api.cloudflare.com/client/v4/user/tokens/verify', {
          headers,
          timeout: 10000,
        });
        if (res.data.success) {
          console.log('✅ Token valid');
          console.log('   Status:', res.data.result.status);
        } else {
          console.log('❌ Token invalid:', res.data.errors);
          await connection.end();
          process.exit(1);
        }
      } catch (e) {
        console.error('❌ Token verification failed:', e.response?.data?.errors?.[0]?.message || e.message);
        console.log('\n💡 Tip: If using Global API Key, make sure to set CLOUDFLARE_EMAIL');
        await connection.end();
        process.exit(1);
      }
    } else {
      console.log('Test 1: Skipped (using Global API Key authentication)');
    }

    // Test 2: Fetch all zones
    console.log('\nTest 2: Fetch Zones...');
    let allZones = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) {
      try {
        const params = { page, per_page: 50 };
        if (accountId) {
          params['account.id'] = accountId;
        }

        const zonesResponse = await axios.get(
          'https://api.cloudflare.com/client/v4/zones',
          { headers, params, timeout: 15000 }
        );

        if (!zonesResponse.data.success) {
          console.log('❌ Failed to fetch zones:', zonesResponse.data.errors);
          await connection.end();
          process.exit(1);
        }

        const zones = zonesResponse.data.result || [];
        allZones = allZones.concat(zones);
        
        const totalPages = zonesResponse.data.result_info?.total_pages || 1;
        hasMore = page < totalPages;
        page++;

      } catch (e) {
        console.error('❌ Error fetching zones:', e.response?.data?.errors?.[0]?.message || e.message);
        if (e.response?.status === 403) {
          console.log('\n💡 Error 403: Permission denied');
          console.log('   - Make sure API Token has "Zone:Read" permission');
          console.log('   - Or use Global API Key + Email');
        }
        await connection.end();
        process.exit(1);
      }
    }

    console.log(`✅ Found ${allZones.length} zones total:`);
    allZones.slice(0, 10).forEach((zone, i) => {
      console.log(`   ${i + 1}. ${zone.name} (ID: ${zone.id.substring(0, 16)}...)`);
    });
    if (allZones.length > 10) {
      console.log(`   ... and ${allZones.length - 10} more zones`);
    }

    if (allZones.length === 0) {
      console.log('\n⚠️  No zones found.');
      if (!accountId) {
        console.log('💡 Tip: Set CLOUDFLARE_ACCOUNT_ID to filter zones by account');
      }
      await connection.end();
      process.exit(0);
    }

    // Test 3: Fetch security events from first 3 zones
    console.log('\nTest 3: Fetch Security Events...');
    const testZones = allZones.slice(0, 3);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days
    let totalEvents = 0;

    for (const zone of testZones) {
      console.log(`\n   Testing zone: ${zone.name}`);
      try {
        const eventsResponse = await axios.get(
          `https://api.cloudflare.com/client/v4/zones/${zone.id}/security/events`,
          {
            headers,
            params: { since, per_page: 10 },
            timeout: 15000,
          }
        );

        if (eventsResponse.data.success) {
          const events = eventsResponse.data.result || [];
          totalEvents += events.length;
          console.log(`   ✅ Found ${events.length} security events`);
          
          if (events.length > 0) {
            const sample = events[0];
            console.log(`      Sample: ${sample.clientIP || 'N/A'} - ${sample.action || 'N/A'} (${sample.occurredAt || 'N/A'})`);
          }
        } else {
          console.log(`   ❌ Failed:`, eventsResponse.data.errors?.[0]?.message || 'Unknown error');
        }

      } catch (e) {
        console.error(`   ❌ Error:`, e.response?.data?.errors?.[0]?.message || e.message);
        if (e.response?.status === 403) {
          console.log('   💡 Permission denied - API Token needs "Analytics:Read" or "Logs:Read" permission');
        } else if (e.response?.status === 404 || e.response?.status === 400) {
          console.log('   💡 Security Events API may require Cloudflare Enterprise/Business plan');
          console.log('   💡 Or the endpoint is not available for this zone');
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n📊 Total events found: ${totalEvents} (from ${testZones.length} zones tested)`);

    if (totalEvents === 0) {
      console.log('\n⚠️  No security events found in the last 7 days.');
      console.log('💡 This is normal if:');
      console.log('   - Your sites have no traffic');
      console.log('   - No security threats detected');
      console.log('   - Firewall rules not triggered');
      console.log('   - Security Events API requires Enterprise/Business plan');
    }

    await connection.end();
    console.log('\n=== TEST COMPLETE ===');
    console.log('\n✅ Cloudflare API is working!');
    console.log('💾 Make sure to save these credentials in Settings page too!');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testCloudflare();
