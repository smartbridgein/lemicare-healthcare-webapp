# Healthcare App

A modern Angular application for healthcare services with authentication, patient management, and cloud deployment capabilities.

## Features

- User authentication (login, signup, forgot password)
- Dashboard for healthcare professionals
- Responsive design for all devices
- Google Cloud Run deployment configuration

## Deployment

This application is configured for deployment on Google Cloud Run. The repository includes:

- Multi-stage Dockerfile for optimized container builds
- nginx configuration for serving the Angular application
- Cloud Build configuration for CI/CD
- Deployment script for Google Cloud Run

## Development

To run the application locally:

```bash
npm install
npm start
```

Navigate to `http://localhost:4200/` to view the application.

## Deployment to Google Cloud Run

Use the included `deploy-to-cloudrun.sh` script to deploy the application to Google Cloud Run:

```bash
chmod +x deploy-to-cloudrun.sh
./deploy-to-cloudrun.sh
```
