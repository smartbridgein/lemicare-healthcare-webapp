#!/bin/bash
# Quick deployment script focusing only on healthcare-app

PROJECT_ID="pivotal-store-459018-n4"
REGION="us-central1"
SERVICE_NAME="healthcare-app"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "=== Building $SERVICE_NAME container ==="
# Submit the build to Cloud Build
gcloud builds submit --tag=$IMAGE \
  --project=$PROJECT_ID \
  --timeout=30m .

echo "=== Deploying $SERVICE_NAME to Cloud Run ==="
# Deploy the service to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --project=$PROJECT_ID
