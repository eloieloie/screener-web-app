# Environment Variables for Zerodha KiteConnect

## 🚨 **Important: CORS Limitation**

**The Zerodha KiteConnect API cannot be called directly from the browser** due to CORS (Cross-Origin Resource Sharing) security restrictions. This is a browser security feature, not a bug.

### Current Status:
- ✅ **Authentication Flow**: Works (redirect to Zerodha is client-side)
- ❌ **API Calls**: Blocked by browser CORS policy
- ✅ **Demo Mode**: Using simulated data for development

### Production Solution:
You need a **backend server** to handle Zerodha API calls. Here's the proper architecture:

```
Frontend (Browser) ←→ Your Backend Server ←→ Zerodha API
```

## Required Environment Variables

Create a `.env` file in the root of your project with the following variables:

```env
# Zerodha KiteConnect API Configuration
VITE_KITE_API_KEY=your_api_key_here
VITE_KITE_API_SECRET=your_api_secret_here

# Optional: Custom redirect URL
VITE_KITE_REDIRECT_URL=http://localhost:5174
```

## How to get Zerodha API Keys

1. **Create a Zerodha Account**: You need an active Zerodha trading account
2. **Developer Console**: Go to https://developers.zerodha.com/
3. **Create App**: Click "Create new app" and fill in the details:
   - App name: Your app name
   - App type: Connect
   - Redirect URL: http://localhost:5174 (for development)
4. **Get API Keys**: After creating the app, you'll get:
   - **API Key**: Use this for `VITE_KITE_API_KEY`
   - **API Secret**: Use this for `VITE_KITE_API_SECRET`

## Authentication Flow

1. **Login URL Generation**: The app generates a login URL using your API key
2. **User Redirect**: User is redirected to Zerodha login page
3. **Authorization**: User logs in and authorizes your app
4. **Callback**: Zerodha redirects back with a `request_token`
5. **Token Exchange**: Your app exchanges the `request_token` + `api_secret` for an `access_token`
6. **API Access**: Use the `access_token` for all subsequent API calls

## Security Notes

- **Never expose API Secret**: The API secret should never be sent to the client
- **Session Management**: Access tokens expire daily at 6 AM
- **Environment Files**: Add `.env` to your `.gitignore` to prevent committing secrets
- **Production**: Use secure environment variable management in production

## Example .env file

```env
VITE_KITE_API_KEY=n4m3qtd7p6yin03v
VITE_KITE_API_SECRET=your_actual_secret_here
VITE_KITE_REDIRECT_URL=http://localhost:5174
```

## Production Backend Setup (Required)

To use real Zerodha data, you need to create a backend server. Here's a simple Node.js/Express example:

```javascript
// backend/server.js
const express = require('express');
const { KiteConnect } = require('kiteconnect');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const kc = new KiteConnect({ api_key: process.env.KITE_API_KEY });

// Handle authentication
app.post('/api/auth', async (req, res) => {
  try {
    const { request_token } = req.body;
    const response = await kc.generateSession(request_token, process.env.KITE_API_SECRET);
    kc.setAccessToken(response.access_token);
    res.json({ success: true, access_token: response.access_token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Proxy stock quotes
app.post('/api/stock-quote', async (req, res) => {
  try {
    const { symbol } = req.body;
    const quote = await kc.getQuote([`NSE:${symbol}`]);
    res.json(quote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Backend server running on port 3001');
});
```

Then update your frontend to call your backend instead of Zerodha directly.

## Testing the Integration

1. Set up your `.env` file with real API keys from Zerodha
2. Start the development server: `npm run dev`
3. Click "Login to Zerodha Kite" in the authentication status widget
4. Complete the OAuth flow
5. You should see "Connected to Zerodha Kite" status
6. Stock data will now fetch from live Zerodha API instead of showing errors

## Troubleshooting

- **"API key not found"**: Check your `.env` file and restart the dev server
- **"Invalid API secret"**: Ensure you're using the correct secret from Zerodha developer console
- **"Redirect URL mismatch"**: Make sure the redirect URL in Zerodha app matches your local URL
- **"Request token expired"**: Request tokens are valid for only a few minutes, complete the flow quickly