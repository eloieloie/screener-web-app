// Test file for the new DirectNSEAPI
import DirectNSEAPI from './directNseAPI';

async function testDirectNSEAPI() {
  console.log('Testing DirectNSEAPI...');
  
  const api = new DirectNSEAPI();
  
  try {
    // Test 1: Get stock symbols
    console.log('\n1. Testing getAllStockSymbols...');
    const symbols = await api.getAllStockSymbols();
    console.log(`Retrieved ${symbols.length} symbols`);
    console.log('First 10 symbols:', symbols.slice(0, 10));
    
    // Test 2: Get equity details
    if (symbols.length > 0) {
      console.log('\n2. Testing getEquityDetails...');
      const testSymbol = symbols[0];
      const details = await api.getEquityDetails(testSymbol);
      console.log(`Details for ${testSymbol}:`, details);
    }
    
    // Test 3: Get top stocks
    console.log('\n3. Testing getTopStocks...');
    const topStocks = await api.getTopStocks(10);
    console.log('Top 10 stocks:', topStocks);
    
    // Test 4: Get market status
    console.log('\n4. Testing getMarketStatus...');
    const marketStatus = await api.getMarketStatus();
    console.log('Market status:', marketStatus);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Only run tests in development
if (import.meta.env.DEV) {
  // Uncomment the line below to run tests
  // testDirectNSEAPI();
}

export default testDirectNSEAPI;