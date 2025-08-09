import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

/**
 * Cloud Function for testing - Manually set a user's membership status
 * Only for development/testing purposes
 */
export const setMembershipStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    const { leagueId, userId, status } = request.data;

    if (!leagueId || !userId || !status) {
      throw new HttpsError("invalid-argument", "League ID, User ID and status are required");
    }

    if (!["active", "inactive", "pending"].includes(status)) {
      throw new HttpsError("invalid-argument", "Status must be active, inactive, or pending");
    }

    try {
      const db = getFirestore();
      
      // Find the membership
      const membershipSnapshot = await db
        .collection("leagueMemberships")
        .where("leagueId", "==", leagueId)
        .where("userId", "==", userId)
        .get();
      
      if (membershipSnapshot.empty) {
        throw new HttpsError("not-found", "Membership not found");
      }

      const membershipDoc = membershipSnapshot.docs[0];

      // Update the membership status
      await membershipDoc.ref.update({
        status: status,
        updatedAt: FieldValue.serverTimestamp(),
        ...(status === "inactive" && {
          inactivatedAt: FieldValue.serverTimestamp(),
          membershipExpiresAt: FieldValue.serverTimestamp(), // Set as expired
        }),
        ...(status === "active" && {
          reactivatedAt: FieldValue.serverTimestamp(),
          membershipExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        })
      });

      // Log the change
      await db.collection("membershipEvents").add({
        leagueId,
        userId,
        membershipId: membershipDoc.id,
        eventType: "status_changed",
        previousStatus: membershipDoc.data().status,
        newStatus: status,
        timestamp: FieldValue.serverTimestamp(),
        reason: "manual_admin_change",
        processedBy: request.auth?.uid || "system"
      });

      logger.info(`Membership status changed to ${status} for user ${userId} in league ${leagueId}`);

      return {
        success: true,
        message: `Membership status changed to ${status}`,
        leagueId,
        userId,
        newStatus: status
      };

    } catch (error) {
      logger.error("Error changing membership status:", error);
      throw new HttpsError("internal", "Failed to change membership status");
    }
  }
);
