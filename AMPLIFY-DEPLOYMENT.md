# Deploying Vite + Express.js Application to AWS Amplify

This guide provides step-by-step instructions for deploying your Vite frontend + Express.js backend application to AWS Amplify.

## Prerequisites

- An AWS account
- AWS CLI installed and configured (optional for manual deployments)
- Your code pushed to a GitHub, GitLab, or Bitbucket repository
- Node.js and npm installed locally for testing

## Step 1: Prepare Your Application Files

Ensure you have the following files in your repository:

1. **amplify.yml** - The main Amplify configuration file
2. **amplify-fullstack.yml** - Detailed build instructions
3. **amplify-build.js** - Helper script for deployment preparation
4. **package.json** - With the additional build:amplify script

## Step 2: Deploy to AWS Amplify

### Option A: Deploy via AWS Amplify Console (Recommended)

1. **Login to AWS Console**
   - Go to the AWS Management Console and navigate to AWS Amplify

2. **Create a new Amplify app**
   - Click "New app" → "Host web app"
   - Choose your GitHub/GitLab/Bitbucket repository and connect to Amplify
   - Authorize AWS Amplify to access your repository

3. **Configure build settings**
   - When prompted, click "Edit" on the auto-detected settings
   - Replace the build specification with the contents of your `amplify.yml` file:
   ```yaml
   version: 1
   applications:
     - appRoot: .
       backend:
         phases:
           preBuild:
             commands:
               - npm ci
           build:
             commands:
               - npm run build
       frontend:
         phases:
           preBuild:
             commands:
               - npm ci
           build:
             commands:
               - npm run build
         artifacts:
           baseDirectory: dist
           files:
             - '**/*'
         cache:
           paths:
             - node_modules/**/*
       buildSpec: amplify-fullstack.yml
   ```

4. **Configure environment variables (if needed)**
   - Click on "Environment variables" in the left sidebar
   - Add any required environment variables for your application
   - Make sure to include:
     - `NODE_ENV`: `production`
     - Any database connection strings
     - API keys
     - Other configuration variables

5. **Deploy the application**
   - Click "Save and deploy"
   - Amplify will build and deploy your application

### Option B: Deploy via AWS CLI

1. **Initialize the Amplify app**

   ```bash
   aws amplify create-app --name "YourAppName" --repository "https://github.com/yourusername/yourrepo" --access-token YOUR_ACCESS_TOKEN
   ```

2. **Create a branch**

   ```bash
   aws amplify create-branch --app-id YOUR_APP_ID --branch-name main
   ```

3. **Start the deployment**

   ```bash
   aws amplify start-job --app-id YOUR_APP_ID --branch-name main --job-type RELEASE
   ```

## Step 3: Verify the Deployment

- Once deployment is complete, click the URL provided by Amplify
- Verify that your frontend loads correctly
- Test API endpoints to confirm backend functionality

## Step 4: Configure Custom Domain (Optional)

1. In the Amplify Console, go to "Domain management"
2. Click "Add domain"
3. Enter your domain name and follow the verification steps
4. Configure the DNS records as instructed

## Troubleshooting Common Issues

### Blank Page After Deployment

- Check browser console for errors
- Verify that environment variables are set correctly
- Ensure all dependencies are correctly installed

### API Endpoints Not Working

- Check CORS configuration in your Express app
- Verify that the backend is deployed and running
- Check API endpoint paths

### Build Failures

- Review build logs in AWS Amplify Console
- Check for missing dependencies or build script issues
- Ensure Node.js version compatibility

### Cannot Access Express Backend

- Ensure your Express server is listening on the correct port 
- Verify that Amplify is correctly forwarding requests 
- Check security group settings if applicable

### Environment Variables Not Available

- Make sure to prefix client-side environment variables with `VITE_`
- Server-side variables should be added to the Amplify environment variables
- Check that the variables are being loaded correctly in your code

## Optimizing Your Deployment

### Enable HTTPS

HTTPS is enabled by default with Amplify hosted apps. Your application will be served over HTTPS automatically.

### Configure Caching

In your amplify.yml, modify cache settings:

```yaml
cache:
  paths:
    - node_modules/**/*
    - dist/**/*.js
    - dist/**/*.css
```

### Performance Monitoring

Enable CloudWatch monitoring:

1. Go to your Amplify app in the AWS Console
2. Navigate to "App settings" > "Monitoring"
3. Enable CloudWatch metrics

---

For further assistance, contact AWS support or refer to the AWS Amplify documentation. 