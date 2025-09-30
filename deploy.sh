#!/bin/bash

# Cooperative Banking Backend Deployment Script

set -e

echo "🚀 Starting Cooperative Banking Backend Deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Environment setup
ENVIRONMENT=${1:-development}

if [ "$ENVIRONMENT" = "production" ]; then
    echo "🏭 Deploying to PRODUCTION environment..."
    COMPOSE_FILE="docker-compose.prod.yml"
    ENV_FILE="config.production.env"
else
    echo "🔧 Deploying to DEVELOPMENT environment..."
    COMPOSE_FILE="docker-compose.yml"
    ENV_FILE="config.env"
fi

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file $ENV_FILE not found!"
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs uploads/kyc uploads/temp backups

# Set proper permissions
echo "🔐 Setting proper permissions..."
chmod 755 logs uploads backups
chmod 644 $ENV_FILE

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f $COMPOSE_FILE down

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f $COMPOSE_FILE up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Health check
echo "🏥 Performing health check..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    echo "📋 Container logs:"
    docker-compose -f $COMPOSE_FILE logs api
    exit 1
fi

# Show running containers
echo "📊 Running containers:"
docker-compose -f $COMPOSE_FILE ps

echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Service URLs:"
echo "  API: http://localhost:5000"
echo "  MongoDB Express: http://localhost:8081"
echo "  Redis Commander: http://localhost:8082"
echo ""
echo "📖 To view logs: docker-compose -f $COMPOSE_FILE logs -f"
echo "🛑 To stop: docker-compose -f $COMPOSE_FILE down"
