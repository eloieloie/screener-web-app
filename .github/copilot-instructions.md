# GitHub Copilot Instructions

## Project Guidelines

### Stock Data Management
- **NEVER generate demo stock data or mock stock prices**
- Always use real API calls to financial data providers (Zerodha KiteConnect, Alpha Vantage, etc.)
- If API is not available, display appropriate error messages or loading states
- Avoid hardcoded stock symbols, prices, or market data
- Use proper error handling when APIs are unavailable

### Data Sources
- Primary: Zerodha KiteConnect API for Indian stock market data
- Secondary: Other legitimate financial data APIs
- Never create fake market data for testing purposes

### Authentication
- Always implement proper OAuth flows for financial APIs
- Use environment variables for API keys and secrets
- Handle authentication errors gracefully
- Provide clear user feedback for authentication states

### Development Best Practices
- Use TypeScript for type safety
- Implement proper error boundaries
- Follow React best practices for state management
- Use consistent Bootstrap styling
- Maintain separation between UI and business logic

### What to Avoid
- Generating arrays of fake stock data
- Creating mock price movements
- Hardcoding financial instrument details
- Simulating market conditions
- Creating placeholder trading data

### Error Handling
- Display meaningful error messages for API failures
- Provide fallback UI states for loading/error conditions
- Log errors appropriately for debugging
- Never fail silently when financial data is unavailable