// Script para obtener información de IDs para testing
// Ejecuta este script en la consola del navegador (F12) cuando estés loggeado

console.log("=== INFORMATION FOR TESTING ===");

// Get current user ID
if (window.auth?.currentUser) {
  console.log("Current User ID:", window.auth.currentUser.uid);
  console.log("Current User Email:", window.auth.currentUser.email);
} else {
  console.log("❌ No user logged in");
}

// Get league IDs from current page
const currentURL = window.location.href;
console.log("Current URL:", currentURL);

// Extract league ID if on league page
const leagueIdMatch = currentURL.match(/\/leagues\/([a-zA-Z0-9]+)/);
if (leagueIdMatch) {
  console.log("League ID from URL:", leagueIdMatch[1]);
}

// Get league IDs from localStorage or try to query Firestore
console.log("\n=== AVAILABLE LEAGUE IDs ===");
console.log("Go to any league page to get its ID from the URL");
console.log("Or go to /leagues and click 'View Details' on any league");

console.log("\n=== QUICK COPY-PASTE VALUES ===");
if (window.auth?.currentUser) {
  console.log(`User ID: ${window.auth.currentUser.uid}`);
  if (leagueIdMatch) {
    console.log(`League ID: ${leagueIdMatch[1]}`);
  }
}

console.log("\n=== HOW TO USE ===");
console.log("1. Copy the User ID and League ID above");
console.log("2. Go to /test/membership-admin");
console.log("3. Paste the IDs and select 'inactive' status");
console.log("4. Click 'Change Membership Status'");
console.log("5. Go back to /leagues to see the inactive status");
