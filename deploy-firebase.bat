@echo off
REM Firebase Deployment Script for Windows
REM This script deploys Firestore indexes and rules

echo 🚀 Starting Firebase deployment...

REM Check if Firebase CLI is installed
firebase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Firebase CLI is not installed. Please install it first:
    echo    npm install -g firebase-tools
    exit /b 1
)

REM Check if user is logged in to Firebase
firebase projects:list >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ You are not logged in to Firebase. Please login first:
    echo    firebase login
    exit /b 1
)

REM Deploy Firestore rules
echo 📋 Deploying Firestore security rules...
firebase deploy --only firestore:rules
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy Firestore rules
    exit /b 1
)
echo ✅ Firestore rules deployed successfully!

REM Deploy Firestore indexes
echo 🔍 Deploying Firestore indexes...
firebase deploy --only firestore:indexes
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy Firestore indexes
    exit /b 1
)
echo ✅ Firestore indexes deployed successfully!

echo.
echo 🎉 Firebase deployment completed successfully!
echo.
echo 📝 Next steps:
echo    1. Monitor index creation in Firebase Console
echo    2. Test your application with the new indexes
echo    3. Update your environment variables before deployment
echo.
