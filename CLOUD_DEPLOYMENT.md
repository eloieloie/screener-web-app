# Screener Web App - Cloud Function Deployment

## Overview

Your screener web app now has **two backend deployment options**:

1. **Traditional Express Server** (`/backend` directory) - Full server with persistent processes
2. **Google Cloud Function** (`/cloud-function` directory) - Serverless, auto-scaling, pay-per-use

## 🚀 Quick Cloud Function Deployment

### Prerequisites
- Google Cloud Platform account
- Google Cloud CLI installed and authenticated
- Zerodha Kite Connect API credentials

### 1. Set Up Environment
```bash
cd cloud-function
cp .env.yaml.example .env.yaml
# Edit .env.yaml with your actual credentials
```

### 2. Deploy with One Command
```bash
./deploy.sh
```

### 3. Update Frontend
Update your frontend API URL to the deployed Cloud Function URL.

## 💰 Cost Comparison

| Deployment Type | Cost Structure | Best For |
|----------------|----------------|----------|
| **Express Server** | $5-50/month fixed | High traffic, always-on |
| **Cloud Function** | $0-10/month usage-based | Low-medium traffic, cost optimization |

## 🔧 Advanced Deployment Options

### Custom Configuration
```bash
# Deploy to specific region with custom memory
./deploy.sh --region=asia-south1 --memory=1GiB --max-instances=5

# Deploy Gen1 function
./deploy.sh --gen1

# Skip post-deployment testing
./deploy.sh --skip-test
```

### Manual Deployment
```bash
# Install dependencies
npm install

# Deploy with gcloud CLI
gcloud functions deploy screener-api \
  --gen2 \
  --runtime=nodejs18 \
  --region=us-central1 \
  --source=. \
  --entry-point=screenerApi \
  --trigger=http \
  --allow-unauthenticated \
  --env-vars-file=.env.yaml
```

## 🏗️ Architecture

```
Frontend (React) → Cloud Function → Zerodha API
                ↓
            Firebase (metadata only)
```

### Benefits of Cloud Function Deployment:
- ✅ **Auto-scaling**: Handles traffic spikes automatically
- ✅ **Cost-effective**: Pay only for actual usage
- ✅ **Managed infrastructure**: No server maintenance
- ✅ **Global deployment**: Multi-region support
- ✅ **Built-in monitoring**: Logs and metrics included

## 📊 Monitoring and Maintenance

### View Logs
```bash
# Real-time logs
gcloud functions logs tail screener-api --region=us-central1 --gen2

# Historical logs
gcloud functions logs read screener-api --region=us-central1 --gen2 --limit=100
```

### Monitor Performance
- Visit Google Cloud Console → Cloud Functions
- Check metrics: invocations, duration, errors, memory usage

### Update Function
```bash
# Make code changes, then redeploy
./deploy.sh
```

## 🔐 Security Features

- Rate limiting (100 requests per 15 minutes)
- CORS protection for your frontend domain
- Session-based authentication
- Input validation and sanitization
- Environment variable encryption

## 🛠️ Troubleshooting

### Common Issues:
1. **Authentication errors**: Check Zerodha API credentials in `.env.yaml`
2. **CORS errors**: Verify `FRONTEND_URL` matches your domain exactly
3. **Cold starts**: First request may take 2-3 seconds (normal for serverless)

### Debug Commands:
```bash
# Test locally
npm start

# Test deployed function
curl https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/screener-api/health

# Check function status
gcloud functions describe screener-api --region=us-central1 --gen2
```

## 📈 Scaling Considerations

### Traffic Levels:
- **Light usage** (< 100 requests/day): ~$0/month (free tier)
- **Medium usage** (1000 requests/day): ~$2-5/month
- **Heavy usage** (10000+ requests/day): Consider Express server

### Performance Optimization:
- Memory allocation: Start with 512MiB, increase if needed
- Timeout: 60 seconds should handle most stock API calls
- Max instances: 10 prevents runaway costs while allowing scaling

## 🔄 Migration Path

If you want to switch between deployment types:

### From Express Server to Cloud Function:
1. Deploy Cloud Function using this guide
2. Update frontend API URL
3. Test all functionality
4. Shutdown Express server when confident

### From Cloud Function to Express Server:
1. Copy environment variables to `/backend/.env`
2. Deploy Express server (see `/backend/README.md`)
3. Update frontend API URL
4. Delete Cloud Function when ready

## 📞 Support

- **Cloud Function Issues**: Check deployment logs and Google Cloud documentation
- **Zerodha API Issues**: Verify credentials and check Kite Connect documentation
- **Frontend Integration**: Ensure API URL is updated correctly

---

**Recommendation**: Start with Cloud Function deployment for cost-effectiveness and ease of management. You can always migrate to a traditional server later if needed.