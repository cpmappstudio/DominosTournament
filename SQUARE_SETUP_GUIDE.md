# Square Payment Configuration

## Steps to get your Square credentials:

### 1. Create Square Developer Account
1. Go to https://developer.squareup.com/
2. Create an account or sign in
3. Go to "My Applications" in the dashboard

### 2. Create a New Application
1. Click "New Application"
2. Give your application a name (e.g., "Domino Tournament")
3. Select application type: "Web Application"

### 3. Get Sandbox Credentials
1. In your application dashboard, go to "Sandbox"
2. Copy the following values:
   - **Application ID**: Starts with `sandbox-sq0idb-`
   - **Location ID**: A code like `LXXXXXXXXXX`
   - **Access Token**: For the backend (don't put in .env)

### 4. Configure Environment Variables
Edit the `.env.local` file with your real values:

```bash
# Square Payment Configuration
VITE_SQUARE_APPLICATION_ID=sandbox-sq0idb-your_application_id_here
VITE_SQUARE_LOCATION_ID=your_location_id_here
VITE_SQUARE_ENVIRONMENT=sandbox
```

### 5. Configure Access Token for Firebase Functions
1. In Square Dashboard, copy the "Sandbox Access Token"
2. Go to Firebase Console > Functions > Configuration
3. Add the environment variable:
   ```
   firebase functions:config:set square.access_token="your_access_token_here"
   firebase functions:config:set square.environment="sandbox"
   ```

### 6. For Production (later)
1. In Square Dashboard, go to "Production"
2. Complete your business information
3. Get production credentials
4. Change `VITE_SQUARE_ENVIRONMENT=production`

## Troubleshooting:

### 401 Unauthorized Error
- Verify that the Application ID is correct
- Make sure the Location ID corresponds to your account
- Check that the Access Token in Firebase Functions is valid

### Disabled Buttons
- Verify that credentials are in the correct file (.env.local)
- Restart the development server after changing variables
- Open DevTools and check Console for errors

### Apple Pay / Google Pay Failures
- This is normal in local development (localhost)
- They will work on an HTTPS domain in production
- For testing, use only Credit Card in development

## Useful Commands:

```bash
# Restart server after .env changes
npm run dev

# View Firebase Functions configuration
firebase functions:config:get

# Deploy functions with new configuration
firebase deploy --only functions
```
