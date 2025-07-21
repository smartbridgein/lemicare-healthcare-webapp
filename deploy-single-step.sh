#!/bin/bash
# Step-by-step deployment script for healthcare-app to Cloud Run

echo "=== STEP 0: Authenticating with Google Cloud ==="
# Authenticate with your Google account
gcloud auth login

# Set the project explicitly after authentication
gcloud config set project pivotal-store-459018-n4

echo "=== STEP 1: Building Angular app with Cloud Run API endpoints ==="
# Install dependencies if needed
npm install --legacy-peer-deps

# Build the Angular app with cloud configuration
npm run build -- --configuration=cloud

# Check if Angular build was successful
if [ $? -ne 0 ] || [ ! -d "dist" ]; then
  echo "=== Angular build failed, not proceeding with deployment ==="
  exit 1
fi

echo "=== STEP 2: Building container image ==="
# Use Cloud Build with detailed logging
gcloud builds submit --tag=gcr.io/pivotal-store-459018-n4/healthcare-app:latest \
  --project=pivotal-store-459018-n4 \
  --verbosity=info .

# Only proceed if the build was successful
if [ $? -eq 0 ]; then
  echo "=== STEP 3: Deploying to Cloud Run ==="
  gcloud run deploy healthcare-app \
    --image gcr.io/pivotal-store-459018-n4/healthcare-app:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --project=pivotal-store-459018-n4
else
  echo "=== Build failed, not proceeding with deployment ==="
  exit 1
fi
