#!/bin/bash

# Backend Server Startup Script
# This script helps you quickly start the backend server with proper checks

echo "🚀 Starting Screener Backend Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the backend directory"
    echo "📁 Use: cd backend && ./start.sh"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
        echo "🔧 Please edit .env file with your Zerodha API credentials before continuing"
        echo "📝 Required: KITE_API_KEY and KITE_API_SECRET"
        exit 1
    else
        echo "❌ .env.example file not found"
        exit 1
    fi
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

# Check if required environment variables are set
if ! grep -q "KITE_API_KEY=" .env || ! grep -q "KITE_API_SECRET=" .env; then
    echo "❌ Missing required environment variables in .env"
    echo "🔧 Please set KITE_API_KEY and KITE_API_SECRET in .env file"
    exit 1
fi

# Check if the environment variables have actual values (not placeholder text)
if grep -q "your_api_key_from_zerodha_console" .env || grep -q "your_api_secret_from_zerodha_console" .env; then
    echo "❌ Please replace placeholder values in .env with actual Zerodha API credentials"
    echo "🔧 Edit .env file and set real KITE_API_KEY and KITE_API_SECRET values"
    exit 1
fi

# Start the server
echo "✅ All checks passed. Starting backend server..."
echo "🌐 Backend will be available at: http://localhost:${PORT:-3001}"
echo "📊 Health check: http://localhost:${PORT:-3001}/health"
echo "📖 API docs: http://localhost:${PORT:-3001}/"
echo ""
echo "🔄 To stop the server, press Ctrl+C"
echo ""

# Start with development mode by default
if [ "$NODE_ENV" = "production" ]; then
    npm start
else
    npm run dev
fi