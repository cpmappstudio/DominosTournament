// Script temporal para probar miembros inactivos
// Este script debe ejecutarse en la consola del navegador

(async function testInactiveMember() {
  console.log("Testing inactive member functionality...");
  
  // Importar Firebase
  const { getFirestore, collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
  const { auth } = await import('./src/firebase');
  
  const db = getFirestore();
  const currentUser = auth.currentUser;
  
  if (!currentUser) {
    console.log("Please log in first");
    return;
  }
  
  console.log("Current user:", currentUser.uid);
  
  // Find user's memberships
  const membershipQuery = query(
    collection(db, "leagueMemberships"),
    where("userId", "==", currentUser.uid),
    where("status", "==", "active")
  );
  
  const membershipSnapshot = await getDocs(membershipQuery);
  
  if (membershipSnapshot.empty) {
    console.log("No active memberships found");
    return;
  }
  
  // Set first membership to inactive for testing
  const membershipDoc = membershipSnapshot.docs[0];
  const membershipData = membershipDoc.data();
  
  console.log("Setting membership to inactive for league:", membershipData.leagueId);
  
  await updateDoc(membershipDoc.ref, {
    status: "inactive",
    updatedAt: new Date()
  });
  
  console.log("Membership set to inactive. Refresh the page to see changes.");
})();
