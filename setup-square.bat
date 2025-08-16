@echo off
echo 🏦 Square Payment Configuration
echo ==================================

REM Check if .env.local exists
if not exist ".env.local" (
    echo ❌ .env.local file not found
    echo 📝 Creating .env.local from .env...
    copy .env .env.local
)

echo.
echo 📋 To configure Square Payment you need:
echo 1. Application ID (starts with 'sandbox-sq0idb-')
echo 2. Location ID (code like 'LXXXXXXXXXX')
echo 3. Access Token (for Firebase Functions)

echo.
echo 🌐 Steps:
echo 1. Go to https://developer.squareup.com/
echo 2. Create an application
echo 3. Go to the 'Sandbox' section
echo 4. Copy the credentials

echo.
echo 📝 Then edit the .env.local file with your real values:
echo    VITE_SQUARE_APPLICATION_ID=your_application_id
echo    VITE_SQUARE_LOCATION_ID=your_location_id

echo.
echo 🔧 For Firebase Functions, run:
echo    firebase functions:config:set square.access_token="your_access_token"
echo    firebase functions:config:set square.environment="sandbox"
echo    firebase deploy --only functions

echo.
echo 🔄 After configuration, restart the server:
echo    npm run dev

echo.
echo 📖 For more details, check: SQUARE_SETUP_GUIDE.md

pause
