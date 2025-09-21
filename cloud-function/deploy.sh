#!/bin/bash

# Google Cloud Function Deployment Script
# This script deploys the Screener API as a Google Cloud Function

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud CLI (gcloud) is not installed"
        print_status "Install it from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "All requirements met"
}

# Check if authenticated with Google Cloud
check_auth() {
    print_status "Checking Google Cloud authentication..."
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 &> /dev/null; then
        print_error "Not authenticated with Google Cloud"
        print_status "Please run: gcloud auth login"
        exit 1
    fi
    
    local project=$(gcloud config get-value project 2>/dev/null)
    if [ -z "$project" ]; then
        print_error "No Google Cloud project set"
        print_status "Please run: gcloud config set project YOUR_PROJECT_ID"
        exit 1
    fi
    
    print_success "Authenticated with project: $project"
}

# Check if environment file exists
check_env_file() {
    print_status "Checking environment configuration..."
    
    if [ ! -f ".env.yaml" ]; then
        if [ -f ".env.yaml.example" ]; then
            print_warning "Environment file not found. Creating from example..."
            cp .env.yaml.example .env.yaml
            print_error "Please edit .env.yaml with your actual credentials before deploying"
            exit 1
        else
            print_error "Environment file .env.yaml not found"
            exit 1
        fi
    fi
    
    # Check if environment file has placeholder values
    if grep -q "your_.*_here" .env.yaml; then
        print_error "Environment file contains placeholder values"
        print_status "Please edit .env.yaml with your actual credentials"
        exit 1
    fi
    
    print_success "Environment configuration found"
}

# Enable required APIs
enable_apis() {
    print_status "Enabling required Google Cloud APIs..."
    
    gcloud services enable cloudfunctions.googleapis.com --quiet
    gcloud services enable cloudbuild.googleapis.com --quiet
    
    print_success "APIs enabled"
}

# Install dependencies
install_deps() {
    print_status "Installing dependencies..."
    npm install --production
    print_success "Dependencies installed"
}

# Deploy function
deploy_function() {
    local generation=${1:-"gen2"}
    local region=${2:-"us-central1"}
    local memory=${3:-"512MiB"}
    local timeout=${4:-"60s"}
    local max_instances=${5:-"10"}
    
    print_status "Deploying Cloud Function (Generation: $generation)..."
    
    if [ "$generation" = "gen2" ]; then
        gcloud functions deploy screener-api \
            --gen2 \
            --runtime=nodejs18 \
            --region=$region \
            --source=. \
            --entry-point=screenerApi \
            --trigger-http \
            --allow-unauthenticated \
            --memory=$memory \
            --timeout=$timeout \
            --max-instances=$max_instances \
            --env-vars-file=.env.yaml \
            --quiet
    else
        gcloud functions deploy screener-api \
            --runtime=nodejs18 \
            --region=$region \
            --source=. \
            --entry-point=screenerApi \
            --trigger-http \
            --allow-unauthenticated \
            --memory=$memory \
            --timeout=$timeout \
            --max-instances=$max_instances \
            --env-vars-file=.env.yaml \
            --quiet
    fi
    
    print_success "Function deployed successfully"
}

# Get function info
get_function_info() {
    local generation=${1:-"gen2"}
    local region=${2:-"us-central1"}
    
    print_status "Getting function information..."
    
    if [ "$generation" = "gen2" ]; then
        local url=$(gcloud functions describe screener-api --region=$region --gen2 --format="value(serviceConfig.uri)" 2>/dev/null)
    else
        local url=$(gcloud functions describe screener-api --region=$region --format="value(httpsTrigger.url)" 2>/dev/null)
    fi
    
    if [ -n "$url" ]; then
        print_success "Function URL: $url"
        echo ""
        print_status "Test the function:"
        echo "curl $url/health"
        echo ""
        print_status "Update your frontend API URL to:"
        echo "$url"
    else
        print_warning "Could not retrieve function URL"
    fi
}

# Test function
test_function() {
    local generation=${1:-"gen2"}
    local region=${2:-"us-central1"}
    
    print_status "Testing deployed function..."
    
    if [ "$generation" = "gen2" ]; then
        local url=$(gcloud functions describe screener-api --region=$region --gen2 --format="value(serviceConfig.uri)" 2>/dev/null)
    else
        local url=$(gcloud functions describe screener-api --region=$region --format="value(httpsTrigger.url)" 2>/dev/null)
    fi
    
    if [ -n "$url" ]; then
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$url/health")
        if [ "$response" = "200" ]; then
            print_success "Function is responding correctly"
        else
            print_warning "Function responded with status code: $response"
        fi
    else
        print_warning "Could not retrieve function URL for testing"
    fi
}

# Main deployment function
main() {
    local generation="gen2"
    local region="us-central1"
    local memory="512MiB"
    local timeout="60s"
    local max_instances="10"
    local skip_test=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --gen1)
                generation="gen1"
                shift
                ;;
            --gen2)
                generation="gen2"
                shift
                ;;
            --region)
                region="$2"
                shift 2
                ;;
            --memory)
                memory="$2"
                shift 2
                ;;
            --timeout)
                timeout="$2"
                shift 2
                ;;
            --max-instances)
                max_instances="$2"
                shift 2
                ;;
            --skip-test)
                skip_test=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --gen1              Deploy as Gen1 Cloud Function"
                echo "  --gen2              Deploy as Gen2 Cloud Function (default)"
                echo "  --region REGION     Deployment region (default: us-central1)"
                echo "  --memory MEMORY     Memory allocation (default: 512MiB)"
                echo "  --timeout TIMEOUT   Timeout (default: 60s)"
                echo "  --max-instances N   Max instances (default: 10)"
                echo "  --skip-test         Skip post-deployment testing"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    echo "🚀 Google Cloud Function Deployment Script"
    echo "=========================================="
    echo ""
    
    check_requirements
    check_auth
    check_env_file
    enable_apis
    install_deps
    deploy_function "$generation" "$region" "$memory" "$timeout" "$max_instances"
    get_function_info "$generation" "$region"
    
    if [ "$skip_test" = false ]; then
        test_function "$generation" "$region"
    fi
    
    echo ""
    print_success "Deployment completed successfully! 🎉"
    echo ""
    print_status "Next steps:"
    echo "1. Update your frontend API URL"
    echo "2. Test the authentication flow"
    echo "3. Monitor function logs with: gcloud functions logs tail screener-api --region=$region $([ "$generation" = "gen2" ] && echo "--gen2")"
}

# Run main function with all arguments
main "$@"