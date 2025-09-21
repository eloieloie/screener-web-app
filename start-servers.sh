#!/bin/bash

# Screener Web App Startup Script
# This script starts both backend and frontend servers with SSL support

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_HTTP_PORT=3001
BACKEND_HTTPS_PORT=3443
FRONTEND_PORT=5174
BACKEND_DIR="server"
LOG_DIR="logs"

# Create logs directory
mkdir -p $LOG_DIR

echo -e "${BLUE}🚀 Starting Screener Web App...${NC}"
echo "================================================"

# Step 1: Stop any existing servers
echo -e "\n${BLUE}📋 Step 1: Stopping existing servers${NC}"
if [ -f "stop-servers.sh" ]; then
    echo -e "${YELLOW}� Running stop-servers.sh...${NC}"
    ./stop-servers.sh
else
    echo -e "${YELLOW}⚠️  stop-servers.sh not found, manually cleaning ports...${NC}"
    lsof -ti:$BACKEND_HTTP_PORT | xargs kill -9 2>/dev/null || echo "Port $BACKEND_HTTP_PORT is free"
    lsof -ti:$BACKEND_HTTPS_PORT | xargs kill -9 2>/dev/null || echo "Port $BACKEND_HTTPS_PORT is free"
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || echo "Port $FRONTEND_PORT is free"
fi

sleep 2  # Give processes time to fully stop
# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if curl -k -s --max-time 3 "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ $service_name failed to start within $max_attempts seconds${NC}"
    return 1
}

# Function to test API endpoint
test_endpoint() {
    local url=$1
    local endpoint_name=$2
    local expected_content=$3
    
    echo -e "${YELLOW}🔍 Testing $endpoint_name...${NC}"
    
    response=$(curl -k -s --max-time 10 "$url" 2>/dev/null || echo "FAILED")
    
    if [[ "$response" == "FAILED" ]]; then
        echo -e "${RED}❌ $endpoint_name: Connection failed${NC}"
        return 1
    elif [[ "$response" == *"$expected_content"* ]]; then
        echo -e "${GREEN}✅ $endpoint_name: Working${NC}"
        echo -e "${BLUE}   Response: ${response:0:100}...${NC}"
        return 0
    else
        echo -e "${RED}❌ $endpoint_name: Unexpected response${NC}"
        echo -e "${BLUE}   Response: ${response:0:100}...${NC}"
        return 1
    fi
}

# Step 2: Start Backend Server
echo -e "\n${BLUE}📋 Step 2: Starting Backend Server${NC}"
echo -e "${YELLOW}🔧 Starting HTTPS backend server...${NC}"

cd $BACKEND_DIR
nohup node https-server.js > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}🚀 Backend server started (PID: $BACKEND_PID)${NC}"

# Step 3: Wait for Backend to be ready
echo -e "\n${BLUE}📋 Step 3: Waiting for Backend Services${NC}"
wait_for_service "http://localhost:$BACKEND_HTTP_PORT/health" "Backend HTTP"
wait_for_service "https://localhost:$BACKEND_HTTPS_PORT/health" "Backend HTTPS"

# Step 4: Start Frontend Server
echo -e "\n${BLUE}📋 Step 4: Starting Frontend Server${NC}"
echo -e "${YELLOW}🔧 Starting HTTPS frontend server...${NC}"

nohup npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

echo -e "${GREEN}🚀 Frontend server started (PID: $FRONTEND_PID)${NC}"

# Step 5: Wait for Frontend to be ready
echo -e "\n${BLUE}📋 Step 5: Waiting for Frontend Service${NC}"
wait_for_service "https://localhost:$FRONTEND_PORT/" "Frontend HTTPS"

# Step 6: Test Local APIs
echo -e "\n${BLUE}📋 Step 6: Testing Local APIs${NC}"
test_endpoint "http://localhost:$BACKEND_HTTP_PORT/health" "Backend HTTP Health" "status"
test_endpoint "https://localhost:$BACKEND_HTTPS_PORT/health" "Backend HTTPS Health" "status"
test_endpoint "http://localhost:$BACKEND_HTTP_PORT/auth/status" "Backend Auth Status" "authenticated"
test_endpoint "https://localhost:$BACKEND_HTTPS_PORT/auth/status" "Backend HTTPS Auth Status" "authenticated"

# Step 7: Test External Domain APIs (if reachable)
echo -e "\n${BLUE}📋 Step 7: Testing External Domain APIs${NC}"

# Check if external domain is reachable
if ping -c 1 mac.eloi.in >/dev/null 2>&1; then
    echo -e "${GREEN}🌐 External domain mac.eloi.in is reachable${NC}"
    
    test_endpoint "https://mac.eloi.in:$BACKEND_HTTPS_PORT/health" "External HTTPS Backend" "status"
    test_endpoint "http://mac.eloi.in:$BACKEND_HTTP_PORT/health" "External HTTP Backend" "status"
    
    # Test frontend if port 443 is forwarded
    if test_endpoint "https://mac.eloi.in/" "External Frontend" "<!DOCTYPE html" 2>/dev/null; then
        echo -e "${GREEN}✅ External frontend is accessible${NC}"
    else
        echo -e "${YELLOW}⚠️  External frontend not accessible (check port 443 forwarding)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  External domain mac.eloi.in not reachable (normal for local testing)${NC}"
fi

# Step 8: Display Service Status
echo -e "\n${BLUE}📋 Step 8: Service Status Summary${NC}"
echo "================================================"
echo -e "${GREEN}✅ Backend HTTP:  http://localhost:$BACKEND_HTTP_PORT${NC}"
echo -e "${GREEN}✅ Backend HTTPS: https://localhost:$BACKEND_HTTPS_PORT${NC}"
echo -e "${GREEN}✅ Frontend HTTPS: https://localhost:$FRONTEND_PORT${NC}"
echo ""
echo -e "${BLUE}🌐 External URLs (requires port forwarding):${NC}"
echo -e "${YELLOW}   Frontend:      https://mac.eloi.in/${NC}"
echo -e "${YELLOW}   Backend HTTPS: https://mac.eloi.in:$BACKEND_HTTPS_PORT/${NC}"
echo -e "${YELLOW}   Backend HTTP:  http://mac.eloi.in:$BACKEND_HTTP_PORT/${NC}"
echo ""
echo -e "${BLUE}📊 Process IDs:${NC}"
echo -e "${YELLOW}   Backend PID:  $BACKEND_PID${NC}"
echo -e "${YELLOW}   Frontend PID: $FRONTEND_PID${NC}"
echo ""
echo -e "${BLUE}📁 Log Files:${NC}"
echo -e "${YELLOW}   Backend:  logs/backend.log${NC}"
echo -e "${YELLOW}   Frontend: logs/frontend.log${NC}"
echo ""
echo -e "${GREEN}🎉 All services started successfully!${NC}"
echo -e "${BLUE}💡 To stop services: ./stop-servers.sh${NC}"
echo "================================================"