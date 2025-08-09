import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

/**
 * Cloud Function that runs daily to check for expired memberships
 * and automatically set them to inactive status
 */
export const checkExpiredMemberships = onSchedule(
  {
    schedule: "0 2 * * *", // Run daily at 2 AM UTC
    timeZone: "UTC",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async (event) => {
    logger.info("Starting expired membership check...");
    
    const db = getFirestore();
    const now = Timestamp.now();
    const processedCount = { expired: 0, errors: 0 };

    try {
      // Get all premium leagues (leagues that require payment)
      const premiumLeaguesQuery = db.collection("leagues")
        .where("settings.pricing.paymentRequired", "==", true);
      
      const premiumLeaguesSnap = await premiumLeaguesQuery.get();
      
      if (premiumLeaguesSnap.empty) {
        logger.info("No premium leagues found");
        return;
      }

      // Process each premium league
      for (const leagueDoc of premiumLeaguesSnap.docs) {
        const leagueId = leagueDoc.id;
        const leagueData = leagueDoc.data();
        
        logger.info(`Checking league: ${leagueData.name} (${leagueId})`);

        try {
          // Get active members of this league
          const membersQuery = db.collection("leagueMemberships")
            .where("leagueId", "==", leagueId)
            .where("status", "==", "active");
          
          const membersSnap = await membersQuery.get();

          for (const memberDoc of membersSnap.docs) {
            const memberData = memberDoc.data();
            const memberId = memberDoc.id;
            
            // Check if member has expired membership
            if (memberData.membershipExpiresAt && 
                memberData.membershipExpiresAt.toMillis() < now.toMillis()) {
              
              logger.info(`Expiring membership for user ${memberData.userId} in league ${leagueId}`);

              // Update member status to inactive
              await db.collection("leagueMemberships").doc(memberId).update({
                status: "inactive",
                paymentStatus: "expired",
                updatedAt: FieldValue.serverTimestamp(),
                expiredAt: FieldValue.serverTimestamp(),
              });

              // Create a notification/log entry
              await db.collection("membershipEvents").add({
                userId: memberData.userId,
                leagueId: leagueId,
                eventType: "auto_expired",
                status: "inactive",
                reason: "Payment expired",
                createdAt: FieldValue.serverTimestamp(),
                previousStatus: "active",
                processedBy: "system",
              });

              processedCount.expired++;
            }
          }
        } catch (error) {
          logger.error(`Error processing league ${leagueId}:`, error);
          processedCount.errors++;
        }
      }

      logger.info(`Expired membership check completed. Expired: ${processedCount.expired}, Errors: ${processedCount.errors}`);
      
    } catch (error) {
      logger.error("Error in expired membership check:", error);
      throw error;
    }
  }
);

/**
 * Manual function to check and update expired memberships
 * Can be called by administrators
 */
export const manualCheckExpiredMemberships = onCall(
  {
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async (request) => {
    // Verify admin permissions (you can customize this check)
    if (!request.auth || !request.auth.token.admin) {
      throw new HttpsError("permission-denied", "Only administrators can run this function");
    }

    const db = getFirestore();
    const now = Timestamp.now();
    const results = {
      processed: 0,
      expired: 0,
      errors: 0,
      leagues: [] as any[]
    };

    try {
      // Get all premium leagues
      const premiumLeaguesQuery = db.collection("leagues")
        .where("settings.pricing.paymentRequired", "==", true);
      
      const premiumLeaguesSnap = await premiumLeaguesQuery.get();

      for (const leagueDoc of premiumLeaguesSnap.docs) {
        const leagueId = leagueDoc.id;
        const leagueData = leagueDoc.data();
        const leagueResult = {
          id: leagueId,
          name: leagueData.name,
          expired: 0,
          errors: 0
        };

        try {
          // Get active members
          const membersQuery = db.collection("leagueMemberships")
            .where("leagueId", "==", leagueId)
            .where("status", "==", "active");
          
          const membersSnap = await membersQuery.get();

          for (const memberDoc of membersSnap.docs) {
            const memberData = memberDoc.data();
            const memberId = memberDoc.id;
            results.processed++;

            // Check expiration
            if (memberData.membershipExpiresAt && 
                memberData.membershipExpiresAt.toMillis() < now.toMillis()) {
              
              // Update to inactive
              await db.collection("leagueMemberships").doc(memberId).update({
                status: "inactive",
                paymentStatus: "expired",
                updatedAt: FieldValue.serverTimestamp(),
                expiredAt: FieldValue.serverTimestamp(),
              });

              // Log event
              await db.collection("membershipEvents").add({
                userId: memberData.userId,
                leagueId: leagueId,
                eventType: "manual_expired",
                status: "inactive",
                reason: "Manual payment check - expired",
                createdAt: FieldValue.serverTimestamp(),
                previousStatus: "active",
                processedBy: request.auth.uid,
              });

              leagueResult.expired++;
              results.expired++;
            }
          }
        } catch (error) {
          logger.error(`Error processing league ${leagueId}:`, error);
          leagueResult.errors++;
          results.errors++;
        }

        results.leagues.push(leagueResult);
      }

      return {
        success: true,
        results,
        timestamp: now.toDate().toISOString()
      };

    } catch (error) {
      logger.error("Error in manual expired membership check:", error);
      throw new HttpsError("internal", "Failed to check expired memberships");
    }
  }
);

/**
 * Function to extend a member's subscription when they make a payment
 */
export const extendMembershipAfterPayment = onCall(
  {
    memory: "256MiB",
  },
  async (request) => {
    const { userId, leagueId, paymentId, months = 1 } = request.data;

    if (!userId || !leagueId || !paymentId) {
      throw new HttpsError("invalid-argument", "Missing required parameters");
    }

    const db = getFirestore();
    const now = Timestamp.now();

    try {
      // Find the membership
      const membershipQuery = db.collection("leagueMemberships")
        .where("userId", "==", userId)
        .where("leagueId", "==", leagueId)
        .limit(1);

      const membershipSnap = await membershipQuery.get();
      
      if (membershipSnap.empty) {
        throw new HttpsError("not-found", "Membership not found");
      }

      const membershipDoc = membershipSnap.docs[0];
      const membershipData = membershipDoc.data();

      // Calculate new expiration date
      const currentExpiration = membershipData.membershipExpiresAt || now;
      const startDate = currentExpiration.toMillis() > now.toMillis() 
        ? currentExpiration 
        : now;
      
      const newExpiration = new Timestamp(
        startDate.seconds + (months * 30 * 24 * 60 * 60), // Add months (30 days each)
        startDate.nanoseconds
      );

      // Update membership
      await membershipDoc.ref.update({
        membershipExpiresAt: newExpiration,
        paymentStatus: "active",
        status: "active", // Reactivate if was inactive
        updatedAt: FieldValue.serverTimestamp(),
        lastPaymentId: paymentId,
        reactivatedAt: membershipData.status === "inactive" ? FieldValue.serverTimestamp() : null,
      });

      // Log the extension
      await db.collection("membershipEvents").add({
        userId: userId,
        leagueId: leagueId,
        eventType: "payment_received",
        status: "active",
        reason: `Payment received - extended ${months} month(s)`,
        paymentId: paymentId,
        createdAt: FieldValue.serverTimestamp(),
        previousStatus: membershipData.status,
        newExpirationDate: newExpiration,
        processedBy: "system",
      });

      logger.info(`Extended membership for user ${userId} in league ${leagueId} until ${newExpiration.toDate()}`);

      return {
        success: true,
        newExpirationDate: newExpiration.toDate().toISOString(),
        reactivated: membershipData.status === "inactive"
      };

    } catch (error) {
      logger.error("Error extending membership:", error);
      throw new HttpsError("internal", "Failed to extend membership");
    }
  }
);

/**
 * Cloud Function to reactivate an inactive membership after successful payment
 * Called when a member pays to reactivate their expired membership
 */
export const reactivateMembership = onCall(
  { region: "us-central1" },
  async (request) => {
    const { leagueId, userId } = request.data;

    if (!leagueId || !userId) {
      throw new HttpsError("invalid-argument", "League ID and User ID are required");
    }

    try {
      const db = getFirestore();
      
      // Find the inactive membership
      const membershipSnapshot = await db
        .collection("leagueMemberships")
        .where("leagueId", "==", leagueId)
        .where("userId", "==", userId)
        .where("status", "==", "inactive")
        .get();
      
      if (membershipSnapshot.empty) {
        throw new HttpsError("not-found", "No inactive membership found for this user in this league");
      }

      const membershipDoc = membershipSnapshot.docs[0];

      // Calculate new expiration date (30 days from now)
      const newExpirationDate = new Date();
      newExpirationDate.setDate(newExpirationDate.getDate() + 30);

      // Reactivate the membership
      await membershipDoc.ref.update({
        status: "active",
        membershipExpiresAt: Timestamp.fromDate(newExpirationDate),
        reactivatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      // Log the reactivation
      await db.collection("membershipEvents").add({
        leagueId,
        userId,
        membershipId: membershipDoc.id,
        eventType: "reactivated",
        previousStatus: "inactive",
        newStatus: "active",
        expirationDate: Timestamp.fromDate(newExpirationDate),
        timestamp: FieldValue.serverTimestamp(),
        reason: "payment_reactivation"
      });

      logger.info(`Membership reactivated for user ${userId} in league ${leagueId}`);

      return {
        success: true,
        message: "Membership reactivated successfully",
        expirationDate: newExpirationDate.toISOString()
      };

    } catch (error) {
      logger.error("Error reactivating membership:", error);
      throw new HttpsError("internal", "Failed to reactivate membership");
    }
  }
);
