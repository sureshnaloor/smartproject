# Step-by-Step Deployment Guide

This guide will walk you through deploying your full-stack application with the frontend on AWS Amplify and the backend on AWS Elastic Beanstalk.

## Prerequisites

1. AWS account with appropriate permissions
2. AWS CLI installed and configured (`aws configure`)
3. Elastic Beanstalk CLI installed (`pip install awsebcli`)
4. Node.js and npm installed
5. Git installed

## Part 1: Prepare Your Application

### Step 1: Update your package.json with new build scripts

Run the provided script to update your package.json:

```bash
node update-scripts.js
```

This adds the following scripts:
- `build:client`: Builds only the frontend
- `build:server`: Builds only the backend
- `prepare:eb`: Prepares the backend for Elastic Beanstalk
- `deploy:amplify`: Prepares the frontend for Amplify

### Step 2: Update frontend API client to use environment variables

Create or update your API client to read the backend URL from environment variables:

```bash
mkdir -p client/src/lib
cp update-api-client.md client/src/lib/
```

Follow the instructions in `update-api-client.md` to implement the changes.

### Step 3: Add CORS middleware to your backend

Copy the CORS middleware file to your server directory:

```bash
cp cors-middleware.ts server/
```

Then update your `server/index.ts` file to use this middleware:

```typescript
import { corsMiddleware } from './cors-middleware';

// Add cors middleware before other middleware
app.use(corsMiddleware);
```

### Step 4: Commit changes to your repository

```bash
git add .
git commit -m "Prepare application for AWS deployment"
git push
```

## Part 2: Deploy Backend to Elastic Beanstalk

### Step 1: Prepare backend code for Elastic Beanstalk

Run the prepare script:

```bash
npm run prepare:eb
```

This creates an `eb-backend` directory with all necessary files for Elastic Beanstalk deployment.

### Step 2: Initialize Elastic Beanstalk

```bash
cd eb-backend
eb init
```

Follow the prompts:
1. Select your region (e.g., `us-east-1`)
2. Create a new application or select an existing one
3. Select Node.js platform
4. Choose Node.js version (18.x recommended)
5. Set up SSH for your instances (recommended)

### Step 3: Create a new Elastic Beanstalk environment

```bash
eb create production-environment
```

Answer the prompts:
1. Enter environment name (e.g., `production`)
2. Enter DNS CNAME prefix (e.g., `your-app-name-api`)
3. Select load balancer type (Application is recommended)
4. Choose whether to enable Spot Fleet requests (No for simple setup)

Wait for the environment creation to complete. This may take 5-10 minutes.

### Step 4: Set environment variables

Set necessary environment variables (replace with your actual values):

```bash
eb setenv DATABASE_URL=postgres://username:password@host:port/database \
           SESSION_SECRET=your-secure-random-string \
           CORS_ORIGIN=https://your-app-domain.amplifyapp.com
```

### Step 5: Deploy your backend code

```bash
eb deploy
```

### Step 6: Verify backend deployment

Check if your backend is running correctly:

```bash
eb status
```

Make a note of your backend URL (something like `your-app-name-api.elasticbeanstalk.com`). You'll need it for configuring the frontend.

## Part 3: Deploy Frontend to AWS Amplify

### Step 1: Create a new Amplify app

1. Open the AWS Amplify Console
2. Choose "Host web app"
3. Select your Git provider (GitHub/BitBucket/GitLab)
4. Select your repository and branch
5. Configure build settings

### Step 2: Update build settings

Replace the default build settings with our frontend-only configuration:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build:client
  artifacts:
    baseDirectory: dist/client
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

### Step 3: Set environment variables

1. In the Amplify Console, go to your app
2. Navigate to "Environment variables"
3. Add a variable named `VITE_API_URL` with the Elastic Beanstalk backend URL:
   `https://your-app-name-api.elasticbeanstalk.com`
4. Save these settings

### Step 4: Deploy frontend

Click "Save and deploy" to start the deployment process.

### Step 5: Verify frontend deployment

Once deployment is complete, click on the URL provided by Amplify to verify that your frontend is working.

## Part 4: Connect Frontend to Backend

### Step 1: Test API connection

1. Open the frontend URL in your browser
2. Open the browser's developer tools
3. Check the Network tab to verify that API requests are made to the correct backend URL
4. Verify that responses are received correctly

### Step 2: Debug CORS issues (if any)

If you see CORS errors:

1. Verify that the CORS configuration in your backend allows requests from your Amplify app domain
2. Check that your API requests include the right headers
3. Update the backend CORS settings if needed:

```bash
eb setenv CORS_ORIGIN=https://your-actual-amplify-domain.amplifyapp.com
eb deploy
```

## Part 5: Add Custom Domain (Optional)

### For Amplify Frontend:

1. In the Amplify Console, go to "Domain management"
2. Click "Add domain"
3. Enter your domain name
4. Follow the instructions to set up DNS records

### For Elastic Beanstalk Backend:

1. Set up a custom domain using Amazon Route 53
2. Create a new record that points to your Elastic Beanstalk environment
3. Update your Amplify environment variable `VITE_API_URL` with the new domain

## Part 6: Set Up Monitoring and Alerts (Optional)

### For Elastic Beanstalk:

1. In the EB Console, go to your environment
2. Navigate to "Monitoring"
3. Set up CloudWatch alarms for metrics like CPU utilization, request count, etc.

### For Amplify:

1. Set up notifications for build failures
2. Configure CloudWatch alarms for availability monitoring

## Troubleshooting

### Common Issues with Elastic Beanstalk:

1. **Deployment Failures:**
   - Check the deployment logs: `eb logs`
   - Verify that your package.json scripts are correct
   - Ensure that all dependencies are listed in package.json

2. **Connection Issues:**
   - Verify that security groups allow incoming traffic on port 80/443
   - Check that CORS is configured correctly
   - Verify that the database connection string is correct

### Common Issues with Amplify:

1. **Build Failures:**
   - Check the build logs in the Amplify Console
   - Verify that your build commands are correct
   - Make sure all dependencies are installed

2. **API Connection Issues:**
   - Check that the `VITE_API_URL` environment variable is set correctly
   - Verify that your API client code is using the environment variable
   - Check for CORS errors in the browser console

## Conclusion

You've now deployed your full-stack application with:
- Frontend on AWS Amplify
- Backend on AWS Elastic Beanstalk

This architecture allows you to:
- Scale frontend and backend independently
- Use the best deployment service for each part of your app
- Keep your code organized and maintainable 