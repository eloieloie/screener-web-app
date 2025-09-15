# Indian Stock Market API Alternatives

Based on analysis of GitHub repositories `maanavshah/stock-market-india` and `hi-imcodeman/stock-nse-india`, here are better alternatives to Yahoo Finance for Indian stock data.

## Current Issues with Yahoo Finance
- **CORS Policy Restrictions**: Browser blocks direct API calls
- **Unreliable CORS Proxies**: Public proxies can be slow/unreliable
- **Rate Limiting**: Yahoo Finance has strict rate limits

## Recommended Alternatives

### 1. NSE India Official API (BEST OPTION)
**Repository**: `hi-imcodeman/stock-nse-india`

```typescript
// Example implementation
const NSE_BASE_URL = 'https://www.nseindia.com';

class NSEIndia {
  private cookies = '';
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  
  async getEquityData(symbol: string) {
    const url = `${NSE_BASE_URL}/api/quote-equity?symbol=${symbol.toUpperCase()}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': '*/*',
        'Referer': 'https://www.nseindia.com/',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    return response.json();
  }
  
  async getHistoricalData(symbol: string, fromDate: string, toDate: string) {
    const url = `${NSE_BASE_URL}/api/historical/cm/equity?symbol=${symbol}&from=${fromDate}&to=${toDate}`;
    // Similar implementation
  }
}
```

**Advantages:**
- Official NSE data source
- Real-time quotes
- Historical data support
- No API key required
- Comprehensive data fields

**Challenges:**
- Requires cookie management
- May need server-side proxy due to CORS

### 2. BSE + NSE Scraping API
**Repository**: `maanavshah/stock-market-india`

```typescript
// BSE API endpoints
const BSE_QUOTE_URL = 'https://www.bseindia.com/stock-share-price/SiteCache/EQHeaderData.aspx';
const NSE_QUOTE_URL = 'https://www1.nseindia.com/live_market/dynaContent/live_watch/get_quote/GetQuote.jsp';

async function getBSEQuote(securityCode: string) {
  const response = await fetch(`${BSE_QUOTE_URL}?text=${securityCode}`, {
    headers: {
      'Referer': 'https://www.bseindia.com/'
    }
  });
  // Parse CSV response
}
```

**Advantages:**
- Multiple exchange support (NSE + BSE)
- Detailed market data
- Server-side implementation

**Challenges:**
- Requires server-side proxy
- Web scraping approach (less stable)

### 3. Third-Party APIs

#### Alpha Vantage (Free Tier)
```typescript
const ALPHA_VANTAGE_KEY = 'your_api_key';
const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}.NS&apikey=${ALPHA_VANTAGE_KEY}`;
```

#### Finnhub (Free Tier)
```typescript
const FINNHUB_KEY = 'your_api_key';
const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}.NS&token=${FINNHUB_KEY}`;
```

## Implementation Recommendations

### Option 1: Hybrid Approach (Recommended)
1. **Primary**: Use NSE Official API through server proxy
2. **Fallback**: Yahoo Finance with CORS proxy
3. **Backup**: Mock data for development

### Option 2: Server-Side Proxy
Create your own proxy server to handle CORS:

```javascript
// Express.js proxy server
app.get('/api/nse/:symbol', async (req, res) => {
  const { symbol } = req.params;
  try {
    const nseData = await fetchFromNSE(symbol);
    res.json(nseData);
  } catch (error) {
    const yahooData = await fetchFromYahoo(symbol);
    res.json(yahooData);
  }
});
```

### Option 3: Use Existing NPM Package
```bash
npm install stock-nse-india
```

```typescript
import { NseIndia } from 'stock-nse-india';

const nseIndia = new NseIndia();
const stockData = await nseIndia.getEquityDetails('RELIANCE');
```

## Data Mapping

### NSE API Response Structure
```typescript
interface NSEEquityData {
  info: {
    symbol: string;
    companyName: string;
    industry: string;
    activeSeries: string[];
    identifier: string;
  };
  metadata: {
    lastUpdateTime: string;
    series: string;
    listingDate: string;
  };
  securityInfo: {
    boardStatus: string;
    tradingStatus: string;
  };
  priceInfo: {
    lastPrice: number;
    change: number;
    pChange: number;
    previousClose: number;
    open: number;
    close: number;
    vwap: number;
    lowerCP: number;
    upperCP: number;
  };
}
```

## Next Steps

1. **Immediate**: Keep current Yahoo Finance implementation with improved CORS handling
2. **Short-term**: Implement NSE API as primary data source
3. **Long-term**: Build comprehensive server-side proxy with multiple data sources

## Security Considerations

- Use environment variables for API keys
- Implement rate limiting
- Add request caching to reduce API calls
- Monitor API usage and quotas

## Testing Strategy

1. Test with popular Indian stocks: RELIANCE, TCS, INFY, HDFCBANK
2. Compare data accuracy across different APIs
3. Measure response times and reliability
4. Test fallback mechanisms

Would you like me to implement any of these alternatives for your app?