import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Test function to simulate a Square payment completion
 * This helps verify the webhook integration without making real payments
 */
export const testSquareIntegration = onCall(
  { region: "us-central1" },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { leagueId, userId, amount = 25, simulate = "success" } = request.data;

    if (!leagueId || !userId) {
      throw new HttpsError("invalid-argument", "leagueId and userId are required");
    }

    try {
      logger.info("Testing Square integration", {
        leagueId,
        userId,
        amount,
        simulate
      });

      if (simulate === "success") {
        // Simulate successful payment
        const mockPaymentId = `test_payment_${Date.now()}`;
        
        // Calculate membership expiration (30 days from now)
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 30);
        const expiresTimestamp = Timestamp.fromDate(expirationDate);

        // Check if user already has membership for this league
        const membershipQuery = await db
          .collection("leagueMemberships")
          .where("leagueId", "==", leagueId)
          .where("userId", "==", userId)
          .get();

        let membershipAction = "created";

        if (membershipQuery.empty) {
          // Create new membership
          await db.collection("leagueMemberships").add({
            leagueId,
            userId,
            status: "active",
            role: "player",
            joinedAt: FieldValue.serverTimestamp(),
            membershipExpiresAt: expiresTimestamp,
            paymentStatus: "active",
            lastPaymentId: mockPaymentId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            testPayment: true, // Mark as test payment
            stats: {
              gamesPlayed: 0,
              gamesWon: 0,
              totalPoints: 0,
              winRate: 0,
              currentStreak: 0,
              longestWinStreak: 0,
            },
          });
        } else {
          // Update existing membership
          const membershipDoc = membershipQuery.docs[0];
          membershipAction = membershipDoc.data().status === "inactive" ? "reactivated" : "extended";
          
          await membershipDoc.ref.update({
            status: "active",
            paymentStatus: "active",
            membershipExpiresAt: expiresTimestamp,
            lastPaymentId: mockPaymentId,
            updatedAt: FieldValue.serverTimestamp(),
            testPayment: true,
            ...(membershipDoc.data().status === "inactive" && {
              reactivatedAt: FieldValue.serverTimestamp()
            })
          });
        }

        // Save test payment record
        await db.collection("payments").add({
          paymentId: mockPaymentId,
          squarePaymentId: mockPaymentId,
          userId,
          leagueId,
          amount,
          currency: "USD",
          status: "completed",
          type: "membership_payment",
          paymentMethod: "test_simulation",
          testPayment: true,
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
        });

        // Log membership event
        await db.collection("membershipEvents").add({
          leagueId,
          userId,
          eventType: `membership_${membershipAction}`,
          status: "active",
          paymentId: mockPaymentId,
          expirationDate: expiresTimestamp,
          timestamp: FieldValue.serverTimestamp(),
          reason: "test_payment_simulation",
          testEvent: true
        });

        return {
          success: true,
          message: `Test payment successful - membership ${membershipAction}`,
          membershipExpires: expirationDate.toISOString(),
          paymentId: mockPaymentId
        };

      } else {
        // Simulate failed payment
        const mockPaymentId = `test_payment_failed_${Date.now()}`;
        
        await db.collection("payments").add({
          paymentId: mockPaymentId,
          squarePaymentId: mockPaymentId,
          userId,
          leagueId,
          status: "failed",
          type: "membership_payment",
          paymentMethod: "test_simulation",
          failureReason: "test_failure_simulation",
          testPayment: true,
          createdAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
        });

        return {
          success: false,
          message: "Test payment failed as requested",
          paymentId: mockPaymentId
        };
      }

    } catch (error) {
      logger.error("Error in test Square integration:", error);
      throw new HttpsError("internal", "Test failed");
    }
  }
);
