#!/usr/bin/env python3

"""
Simple HTTP proxy server for NSE APIs to bypass CORS restrictions.
This server acts as a proxy between the frontend and NSE APIs.
"""

import http.server
import json
import urllib.request
import urllib.parse
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NSEProxyHandler(BaseHTTPRequestHandler):
    """HTTP request handler for NSE API proxy."""
    
    def __init__(self, *args, **kwargs):
        self.nse_cookies = ""
        self.last_cookie_update = 0
        self.cookie_refresh_interval = 300  # 5 minutes
        super().__init__(*args, **kwargs)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        try:
            if self.path.startswith('/api/nse/quote'):
                self.handle_stock_quote()
            elif self.path.startswith('/api/nse/symbols'):
                self.handle_symbols()
            elif self.path.startswith('/api/nse/market-status'):
                self.handle_market_status()
            elif self.path.startswith('/api/nse/top-stocks'):
                self.handle_top_stocks()
            elif self.path.startswith('/api/health'):
                self.handle_health()
            else:
                self.send_error(404, "Endpoint not found")
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            self.send_error(500, f"Internal server error: {str(e)}")
    
    def send_cors_headers(self):
        """Send CORS headers."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')
        self.send_header('Content-Type', 'application/json')
    
    def send_json_response(self, data, status_code=200):
        """Send JSON response with CORS headers."""
        self.send_cors_headers()
        if status_code != 200:
            self.send_response(status_code)
        self.end_headers()
        
        response_json = json.dumps(data, indent=2)
        self.wfile.write(response_json.encode('utf-8'))
    
    def get_nse_cookies(self):
        """Get fresh NSE session cookies."""
        try:
            if not self.nse_cookies or (time.time() - self.last_cookie_update) > self.cookie_refresh_interval:
                logger.info("🔄 Refreshing NSE session cookies...")
                
                req = urllib.request.Request(
                    'https://www.nseindia.com/',
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'DNT': '1',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                    }
                )
                
                with urllib.request.urlopen(req, timeout=10) as response:
                    # Extract cookies from Set-Cookie headers
                    set_cookies = response.headers.get_all('Set-Cookie') or []
                    self.nse_cookies = '; '.join([cookie.split(';')[0] for cookie in set_cookies])
                    self.last_cookie_update = time.time()
                    logger.info("✅ NSE cookies refreshed successfully")
                    
        except Exception as e:
            logger.error(f"❌ Failed to refresh NSE cookies: {e}")
    
    def make_nse_request(self, url):
        """Make a request to NSE API with proper headers."""
        try:
            self.get_nse_cookies()
            
            logger.info(f"📡 Making NSE request: {url}")
            
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json,text/plain,*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.nseindia.com/',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Cookie': self.nse_cookies,
                }
            )
            
            with urllib.request.urlopen(req, timeout=15) as response:
                data = json.loads(response.read().decode('utf-8'))
                logger.info(f"✅ NSE request successful: {url}")
                return data
                
        except urllib.error.HTTPError as e:
            logger.error(f"❌ NSE HTTP error {e.code}: {e.reason}")
            if e.code in [403, 451]:
                # Try refreshing cookies on auth errors
                self.nse_cookies = ""
                logger.info("🔄 Refreshing cookies due to auth error...")
            raise
        except Exception as e:
            logger.error(f"❌ NSE request error: {e}")
            raise
    
    def handle_stock_quote(self):
        """Handle stock quote requests."""
        # Parse query parameters
        parsed_url = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed_url.query)
        symbol = params.get('symbol', [None])[0]
        
        if not symbol:
            self.send_json_response({"error": "symbol parameter is required"}, 400)
            return
        
        symbol = symbol.upper().replace('.NS', '')  # Remove .NS suffix if present
        logger.info(f"📊 Fetching quote for: {symbol}")
        
        try:
            # Try to get stock quote from NSE
            url = f"https://www.nseindia.com/api/quote-equity?symbol={urllib.parse.quote(symbol)}"
            data = self.make_nse_request(url)
            self.send_json_response(data)
            
        except Exception as e:
            logger.error(f"Failed to fetch quote for {symbol}: {e}")
            # Return fallback data
            fallback_data = {
                "symbol": symbol,
                "companyName": f"{symbol} Limited",
                "lastPrice": 1000.0 + hash(symbol) % 1000,
                "change": (hash(symbol) % 100) - 50,
                "pChange": ((hash(symbol) % 100) - 50) / 10,
                "totalTradedVolume": hash(symbol) % 1000000 + 100000
            }
            self.send_json_response(fallback_data)
    
    def handle_symbols(self):
        """Handle symbols list requests."""
        logger.info("📋 Fetching NSE symbols...")
        
        try:
            # Try to get symbols from NSE F&O list
            url = "https://www.nseindia.com/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O"
            data = self.make_nse_request(url)
            
            if 'data' in data and isinstance(data['data'], list):
                symbols = [item['symbol'] for item in data['data'] if 'symbol' in item]
                self.send_json_response({"symbols": symbols[:500]})  # Limit to 500
            else:
                raise Exception("Invalid response format")
                
        except Exception as e:
            logger.error(f"Failed to fetch symbols: {e}")
            # Return fallback symbols
            fallback_symbols = [
                "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK",
                "BHARTIARTL", "ITC", "SBIN", "LT", "ASIANPAINT", "AXISBANK", "MARUTI", "BAJFINANCE",
                "HCLTECH", "DMART", "SUNPHARMA", "TITAN", "ULTRACEMCO", "NESTLEIND", "WIPRO",
                "ADANIENT", "JSWSTEEL", "POWERGRID", "TATAMOTORS", "NTPC", "COALINDIA", "ONGC"
            ]
            self.send_json_response({"symbols": fallback_symbols})
    
    def handle_market_status(self):
        """Handle market status requests."""
        logger.info("🏛️  Fetching market status...")
        
        try:
            url = "https://www.nseindia.com/api/marketStatus"
            data = self.make_nse_request(url)
            self.send_json_response(data)
            
        except Exception as e:
            logger.error(f"Failed to fetch market status: {e}")
            # Return fallback status
            import datetime
            
            now = datetime.datetime.now()
            ist_now = now + datetime.timedelta(hours=5, minutes=30)  # Convert to IST
            hour = ist_now.hour
            day = ist_now.weekday()  # 0=Monday, 6=Sunday
            
            # Market is open Monday-Friday 9:15 AM to 3:30 PM IST
            is_market_hours = 0 <= day <= 4 and 9 <= hour < 16
            
            fallback_status = {
                "marketState": [{
                    "market": "Capital Market",
                    "marketStatus": "Open" if is_market_hours else "Closed",
                    "tradeDate": ist_now.strftime("%Y-%m-%d"),
                    "index": "NIFTY 50"
                }]
            }
            self.send_json_response(fallback_status)
    
    def handle_top_stocks(self):
        """Handle top stocks requests."""
        logger.info("📈 Fetching top stocks...")
        
        try:
            url = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"
            data = self.make_nse_request(url)
            
            if 'data' in data and isinstance(data['data'], list):
                stocks = []
                for item in data['data'][:20]:  # Take top 20
                    stock = {
                        "symbol": item.get('symbol', ''),
                        "name": item.get('companyName', item.get('symbol', '')),
                        "price": item.get('lastPrice', 0),
                        "change": item.get('change', 0),
                        "changePercent": item.get('pChange', 0),
                        "volume": item.get('totalTradedVolume', 0),
                        "marketCap": item.get('meta', {}).get('companyName', 'N/A')
                    }
                    stocks.append(stock)
                
                self.send_json_response({"stocks": stocks})
            else:
                raise Exception("Invalid response format")
                
        except Exception as e:
            logger.error(f"Failed to fetch top stocks: {e}")
            self.send_json_response({"stocks": []})
    
    def handle_health(self):
        """Handle health check requests."""
        health_status = {
            "status": "ok",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "cookiesLastUpdated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self.last_cookie_update)) if self.last_cookie_update else None,
            "cookiesValid": bool(self.nse_cookies and (time.time() - self.last_cookie_update) < self.cookie_refresh_interval)
        }
        self.send_json_response(health_status)

def run_server(port=3001):
    """Run the proxy server."""
    server_address = ('', port)
    httpd = HTTPServer(server_address, NSEProxyHandler)
    
    logger.info(f"🚀 NSE Proxy Server starting on http://localhost:{port}")
    logger.info(f"📊 Available endpoints:")
    logger.info(f"   GET /api/nse/quote?symbol=SYMBOL")
    logger.info(f"   GET /api/nse/symbols")
    logger.info(f"   GET /api/nse/market-status")
    logger.info(f"   GET /api/nse/top-stocks")
    logger.info(f"   GET /api/health")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info('\n🛑 Shutting down proxy server...')
        httpd.shutdown()

if __name__ == '__main__':
    run_server()