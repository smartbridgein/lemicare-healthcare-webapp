#!/bin/bash
# Cloud Run deployment script for healthcare-app with explicit Dockerfile
# Target project: lemicare-prod

# Define variables
PROJECT_ID="lemicare-prod"
SERVICE_NAME="healthcare-app"
REGION="asia-south1"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

# Authentication step
echo "=== STEP 0: Authenticating with Google Cloud ===" 
echo "Please authenticate with your Google Cloud account..."

# Run interactive gcloud auth login
gcloud auth login

# Set the project
echo "Setting project to ${PROJECT_ID}..."
gcloud config set project ${PROJECT_ID}

# Configure Docker to use gcloud credentials helper for GCR
echo "Configuring Docker authentication for Google Container Registry..."
gcloud auth configure-docker

# Verify authentication
echo "Verifying authentication..."
gcloud auth list
gcloud config list project

# Check if user has access to the project
echo "Checking project access..."
if ! gcloud projects describe ${PROJECT_ID} &> /dev/null; then
  echo "ERROR: You don't have access to project ${PROJECT_ID}. Please check your permissions or authenticate with a different account."
  echo "Try running 'gcloud auth login' manually to switch accounts."
  exit 1
fi

echo "=== STEP 1: Building Angular app with cloud configuration ===" 
# Install dependencies if needed
npm install --legacy-peer-deps

npm run build -- --configuration=cloud

# Check if Angular build was successful
if [ $? -ne 0 ] || [ ! -d "dist" ]; then
  echo "=== Angular build failed ===" 
  exit 1
fi

echo "=== STEP 2: Creating necessary files for Docker build ===" 
# Create a deployment directory
DEPLOYMENT_DIR="healthcare-app-deployment"
rm -rf "${DEPLOYMENT_DIR}" 2>/dev/null
mkdir -p "${DEPLOYMENT_DIR}"

# Copy the built app to the deployment directory - BROWSER SUBFOLDER IS IMPORTANT!
cp -r ./dist/healthcare-app/browser/* "${DEPLOYMENT_DIR}/"

# Create Nginx configuration file with correct paths
cat > "${DEPLOYMENT_DIR}/nginx.conf" << 'EOF'
server {
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Important for Angular routing
    location / {
        try_files $uri $uri/ /index.html =404;
    }
}
EOF

# Create a Dockerfile optimized for Cloud Run
cat > "${DEPLOYMENT_DIR}/Dockerfile" << 'EOF'
FROM nginx:alpine

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy the built app
COPY . /usr/share/nginx/html

# Copy nginx config and replace the default conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run expects the container to listen on 8080
EXPOSE 8080

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
EOF

echo "=== STEP 3: Building and pushing Docker image ===" 
# Build the Docker image using Cloud Build
(cd "${DEPLOYMENT_DIR}" && gcloud builds submit --tag="${IMAGE}" --project="${PROJECT_ID}")

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "=== STEP 4: Deploying to Cloud Run ===" 
  gcloud run deploy "${SERVICE_NAME}" \
    --image="${IMAGE}" \
    --platform=managed \
    --region="${REGION}" \
    --allow-unauthenticated \
    --project="${PROJECT_ID}"
  
  if [ $? -eq 0 ]; then
    echo "=== Deployment completed successfully! ===" 
    echo "Your Cloud Run service is now available. Check the URL in the output above."
  else
    echo "=== Deployment to Cloud Run failed ===" 
    exit 1
  fi
else
  echo "=== Docker image build failed ===" 
  exit 1
fi
