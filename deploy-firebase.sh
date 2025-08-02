#!/bin/bash

# Firebase Deployment Script
# This script deploys Firestore indexes and rules

echo "🚀 Starting Firebase deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ You are not logged in to Firebase. Please login first:"
    echo "   firebase login"
    exit 1
fi

# Deploy Firestore rules
echo "📋 Deploying Firestore security rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Firestore rules deployed successfully!"
else
    echo "❌ Failed to deploy Firestore rules"
    exit 1
fi

# Deploy Firestore indexes
echo "🔍 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo "✅ Firestore indexes deployed successfully!"
else
    echo "❌ Failed to deploy Firestore indexes"
    exit 1
fi

echo ""
echo "🎉 Firebase deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Monitor index creation in Firebase Console"
echo "   2. Test your application with the new indexes"
echo "   3. Update your environment variables before deployment"
echo ""
