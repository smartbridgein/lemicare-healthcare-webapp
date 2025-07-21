#!/bin/bash
# Deployment script for healthcare-app to Cloud Run

# Set your Google Cloud project ID
PROJECT_ID="pivotal-store-459018-n4"

# Set the service name
SERVICE_NAME="healthcare-app"

# Set the region
REGION="us-central1"

# Configure Google Cloud project
echo "Configuring Google Cloud project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Build the container image using Cloud Build
echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$SERVICE_NAME

# Deploy the container image to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "Deployment complete. Please note the service URL output above."
