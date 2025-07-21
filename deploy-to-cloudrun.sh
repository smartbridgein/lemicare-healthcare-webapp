#!/bin/bash
set -e

# Configuration
PROJECT_ID="pivotal-store-459018-n4"  # Your GCP project ID
REGION="us-central1"
SERVICE_NAME="cosmicdoc-frontend"
COMMIT_SHA=$(date +%s)  # Using timestamp as commit hash

# Print current status
echo "🚀 Deploying $SERVICE_NAME to Google Cloud Run..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"

# Ensure gcloud is configured with the correct project
echo "Configuring gcloud for project $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs (in case they're not enabled)
echo "Ensuring required APIs are enabled..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com

# Build and deploy using Cloud Build
echo "Submitting build to Cloud Build..."
gcloud builds submit --config=cloudbuild.yaml . --substitutions=_REGION=$REGION,COMMIT_SHA=$COMMIT_SHA

echo "✅ Deployment submitted to Cloud Build!"
echo "You can monitor the build progress in the Google Cloud Console:"
echo "https://console.cloud.google.com/cloud-build/builds?project=$PROJECT_ID"
echo ""
echo "Once the build completes, your application will be available at:"
echo "https://$SERVICE_NAME-<hash>-uc.a.run.app"
