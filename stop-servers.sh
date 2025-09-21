#!/bin/bash

echo "🛑 Stopping Screener Web App servers..."

# Kill by port
echo "Stopping backend servers..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "No process on port 3001"
lsof -ti:3443 | xargs kill -9 2>/dev/null || echo "No process on port 3443"

echo "Stopping frontend server..."
lsof -ti:5174 | xargs kill -9 2>/dev/null || echo "No process on port 5174"

echo "✅ All servers stopped!"
