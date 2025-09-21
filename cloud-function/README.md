# Google Cloud Function Deployment Guide

## Overview
This directory contains a serverless version of the Screener Backend API using Google Cloud Functions. It provides the same functionality as the Express server but with automatic scaling, pay-per-use pricing, and managed infrastructure.

## Prerequisites

1. **Google Cloud Platform Account**
   - Create a GCP project
   - Enable the Cloud Functions API
   - Enable the Cloud Build API (for automated deployment)

2. **Google Cloud CLI**
   ```bash
   # Install gcloud CLI
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   
   # Initialize and authenticate
   gcloud init
   gcloud auth login
   ```

3. **Zerodha API Credentials**
   - API Key from Zerodha Kite Connect
   - API Secret from Zerodha Kite Connect

## Quick Deployment

### Method 1: Direct Deployment (Recommended)

1. **Set up environment variables**
   ```bash
   cd cloud-function
   cp .env.yaml.example .env.yaml
   ```

2. **Edit `.env.yaml` with your credentials**
   ```yaml
   KITE_API_KEY: "your_actual_api_key"
   KITE_API_SECRET: "your_actual_api_secret"
   FRONTEND_URL: "https://your-frontend-domain.com"
   SESSION_SECRET: "your_secure_random_string"
   NODE_ENV: "production"
   ```

3. **Deploy to Google Cloud Functions**
   ```bash
   # Set your project ID
   gcloud config set project YOUR_PROJECT_ID
   
   # Deploy Gen2 Cloud Function (recommended)
   npm run deploy:gen2
   
   # Or deploy Gen1 Cloud Function
   npm run deploy:gen1
   ```

4. **Get the function URL**
   ```bash
   gcloud functions describe screener-api --region=us-central1 --gen2
   ```

### Method 2: Cloud Build Deployment

1. **Set up Cloud Build**
   ```bash
   # Enable Cloud Build API
   gcloud services enable cloudbuild.googleapis.com
   
   # Submit build
   gcloud builds submit --config=cloudbuild.yaml
   ```

## Configuration Options

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `KITE_API_KEY` | Yes | Zerodha Kite Connect API Key | `your_api_key` |
| `KITE_API_SECRET` | Yes | Zerodha Kite Connect API Secret | `your_api_secret` |
| `FRONTEND_URL` | Yes | Your frontend application URL | `https://myapp.com` |
| `SESSION_SECRET` | Yes | Secret for session encryption | `random_string_32_chars` |
| `NODE_ENV` | No | Environment mode | `production` |

### Function Configuration

- **Runtime**: Node.js 18
- **Memory**: 512 MiB (adjustable)
- **Timeout**: 60 seconds
- **Max Instances**: 10 (auto-scaling)
- **Region**: us-central1 (changeable)

## API Endpoints

Once deployed, your Cloud Function will expose these endpoints:

### Authentication
- `GET /auth/login` - Get Zerodha login URL
- `POST /auth/session` - Generate session with request token
- `GET /auth/status` - Check authentication status
- `POST /auth/logout` - Logout and destroy session

### Stock Data
- `GET /api/stocks/quote/:symbol` - Get single stock quote
- `POST /api/stocks/multiple` - Get multiple stock quotes
- `GET /api/stocks/top` - Get top stocks (Nifty 50)
- `GET /api/stocks/historical/:symbol` - Get historical data
- `GET /api/stocks/market-status` - Get market status

### Utility
- `GET /` - API information
- `GET /health` - Health check

## Frontend Integration

Update your frontend `KiteConnectAPI` service to use the Cloud Function URL:

```typescript
// src/services/KiteConnectAPI.ts
const API_BASE_URL = 'https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/screener-api';
```

## Monitoring and Logging

### View Logs
```bash
# Function logs
gcloud functions logs read screener-api --region=us-central1 --gen2

# Real-time logs
gcloud functions logs tail screener-api --region=us-central1 --gen2
```

### Monitoring Dashboard
- Visit Google Cloud Console → Cloud Functions
- Select your function for metrics and monitoring

## Cost Optimization

### Pricing Model
- **Free Tier**: 2 million invocations per month
- **After Free Tier**: $0.40 per million invocations
- **Memory/CPU**: Based on allocated resources and execution time

### Optimization Tips
1. **Memory Allocation**: Start with 512 MiB, adjust based on usage
2. **Cold Start**: Gen2 functions have faster cold starts
3. **Concurrency**: Set max instances to prevent runaway costs
4. **Caching**: Use memory store for session caching

## Security Considerations

### Built-in Security
- Rate limiting (100 requests per 15 minutes per IP)
- CORS configuration for frontend domains
- Session-based authentication
- Input validation and sanitization

### Additional Security
```bash
# Restrict function access to specific IPs
gcloud functions add-iam-policy-binding screener-api \
  --member="user:your-email@domain.com" \
  --role="roles/cloudfunctions.invoker" \
  --region=us-central1
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   ```bash
   # Verify environment variables
   gcloud functions describe screener-api --region=us-central1 --gen2
   ```

2. **CORS Errors**
   - Check `FRONTEND_URL` in environment variables
   - Verify frontend domain matches exactly

3. **Authentication Failures**
   - Verify Zerodha API credentials
   - Check API key permissions in Kite Connect dashboard

4. **Function Not Responding**
   ```bash
   # Check function logs
   gcloud functions logs read screener-api --region=us-central1 --gen2 --limit=50
   ```

### Debugging Commands

```bash
# Test function locally (requires Functions Framework)
npm start

# Test deployed function
curl https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/screener-api/health

# Update function with new code
npm run deploy:gen2

# Delete function
gcloud functions delete screener-api --region=us-central1 --gen2
```

## Comparison: Cloud Function vs Express Server

| Feature | Cloud Function | Express Server |
|---------|----------------|----------------|
| **Cost** | Pay-per-use | Fixed monthly cost |
| **Scaling** | Automatic | Manual/limited |
| **Maintenance** | Managed | Self-managed |
| **Cold Start** | 1-2 seconds | Always warm |
| **Development** | Slightly complex | Simple |
| **Monitoring** | Built-in GCP | Custom setup |

## Migration from Express Server

If you're migrating from the Express server in `/backend`:

1. **Data Migration**: No data migration needed (stateless)
2. **Environment**: Copy environment variables to `.env.yaml`
3. **Frontend**: Update API base URL
4. **Testing**: Test all endpoints after deployment
5. **DNS**: Update DNS records if using custom domain

## Next Steps

1. **Custom Domain**: Set up Cloud Load Balancer with custom domain
2. **SSL Certificate**: Configure managed SSL certificates
3. **CI/CD**: Set up automated deployment with Cloud Build triggers
4. **Monitoring**: Configure alerting for errors and performance
5. **Backup**: Set up automated backups for configurations

## Support

For issues specific to:
- **Google Cloud Functions**: Check [GCP Documentation](https://cloud.google.com/functions/docs)
- **Zerodha API**: Check [Kite Connect Documentation](https://kite.trade/docs/connect/v3/)
- **This Implementation**: Check function logs and error messages