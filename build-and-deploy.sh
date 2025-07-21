#!/bin/bash
# Complete build and deploy script for healthcare-app UI application

PROJECT_ID="pivotal-store-459018-n4"
REGION="us-central1"
SERVICE_NAME="healthcare-app"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME:latest"

echo "=== Building $SERVICE_NAME using Cloud configuration ==="
# Install dependencies and build the Angular application
npm install
npm run build -- --configuration=cloud

# Check if the build was successful
if [ $? -ne 0 ] || [ ! -d "dist" ]; then
  echo "Angular build failed or dist folder not found. Aborting deployment."
  exit 1
fi

echo "=== Building $SERVICE_NAME container ==="
# Create a simple Dockerfile for the UI application if it doesn't exist
if [ ! -f "Dockerfile" ]; then
  echo "Creating Dockerfile for Angular application..."
  cat > Dockerfile << EOF
FROM nginx:alpine

# Copy built Angular app to nginx html directory
COPY dist/healthcare-app/browser /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
EOF
fi

# Create nginx.conf if it doesn't exist
if [ ! -f "nginx.conf" ]; then
  echo "Creating nginx configuration..."
  cat > nginx.conf << EOF
server {
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Handle Angular routing by redirecting to index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache control for static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
EOF
fi

# Submit the build to Cloud Build
gcloud builds submit --tag=$IMAGE \
  --project=$PROJECT_ID \
  --timeout=30m .

# Check if the build was successful
if [ $? -ne 0 ]; then
  echo "Container build failed. Aborting deployment."
  exit 1
fi

echo "=== Deploying $SERVICE_NAME to Cloud Run ==="
# Deploy the service to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE \
  --platform=managed \
  --region=$REGION \
  --allow-unauthenticated \
  --port=8080 \
  --project=$PROJECT_ID

echo "=== Deployment Complete ==="
echo "You can access the application at: https://$SERVICE_NAME-1078740886343.us-central1.run.app"
