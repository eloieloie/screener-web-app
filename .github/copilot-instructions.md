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

## Development Server Management

### Quick Start/Stop Scripts
For convenience, use the provided scripts to manage the entire application:

- **Start Application**: `./start-servers.sh` - Automatically starts both backend and frontend servers
- **Stop Application**: `./stop-servers.sh` - Stops all running servers and cleans up processes

### Stopping the Application
- **Frontend**: Press `Ctrl+C` in the terminal running `npm run dev`
- **Backend**: Press `Ctrl+C` in the terminal running `npm start` in the server directory
- **Force kill if needed**: Use `lsof -ti:5174 | xargs kill -9` for frontend or `lsof -ti:3443 | xargs kill -9` for backend

### Port Management
- Frontend: `localhost:5174` (Vite default)
- Backend: `localhost:3443` (HTTPS required for KiteConnect OAuth)
- If ports are occupied, kill existing processes before restarting

### Development Workflow
1. Ensure backend server is running for API functionality
2. Start frontend server for UI development
3. Both servers support hot-reload for efficient development
4. Authentication requires HTTPS backend server to be active