/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue, Timestamp} from "firebase-admin/firestore";
// import {SquareClient} from "square";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Initialize Square Client with minimal configuration
// const squareClient = new SquareClient({});

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Process league payment
export const processLeaguePayment = onCall(
  {cors: true},
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new Error("User must be authenticated");
    }

    const {sourceId, leagueId, amount} = request.data;
    
    if (!sourceId || !leagueId || !amount || amount <= 0) {
      throw new Error("Invalid payment parameters");
    }

    const userId = request.auth.uid;

    try {
      // Generate unique idempotency key (commented for simulation)
      // const idempotencyKey = `${userId}-${leagueId}-${Date.now()}`;

      // Create payment with Square - simplified version for testing
      logger.info("Creating payment with Square", {
        sourceId,
        amount,
        leagueId,
      });

      // For now, simulate successful payment until Square config is fixed
      const simulatedPayment = {
        payment: {
          id: `simulated_${Date.now()}`,
          status: 'COMPLETED'
        }
      };
      
      const response = simulatedPayment;

      if (!response.payment) {
        throw new Error("Payment processing failed");
      }

      logger.info("Payment processed successfully", {
        paymentId: response.payment.id,
        userId,
        leagueId,
        amount,
      });

      // Calculate membership period (30 days from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
      const expiresTimestamp = Timestamp.fromDate(expiresAt);

      // Create payment record in Firestore
      const paymentRef = db.collection("payments").doc();
      await paymentRef.set({
        userId: userId,
        leagueId: leagueId,
        amount: amount,
        currency: "USD",
        squarePaymentId: response.payment.id,
        status: "completed",
        type: "initial",
        createdAt: FieldValue.serverTimestamp(),
        processedAt: FieldValue.serverTimestamp(),
      });

      // Find or create league membership document
      const membershipQuery = db.collection("leagueMemberships")
        .where("userId", "==", userId)
        .where("leagueId", "==", leagueId)
        .limit(1);

      const membershipSnap = await membershipQuery.get();
      
      if (membershipSnap.empty) {
        // Create new membership
        await db.collection("leagueMemberships").add({
          userId: userId,
          leagueId: leagueId,
          joinedAt: FieldValue.serverTimestamp(),
          status: "active",
          role: "player",
          paymentStatus: "active",
          membershipExpiresAt: expiresTimestamp,
          subscriptionId: null,
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
        const membershipDoc = membershipSnap.docs[0];
        await membershipDoc.ref.update({
          status: "active",
          paymentStatus: "active",
          membershipExpiresAt: expiresTimestamp,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Update league membership (legacy support)
      const leagueRef = db.collection("leagues").doc(leagueId);
      const membershipData = {
        [`members.${userId}`]: {
          joinedAt: FieldValue.serverTimestamp(),
          paymentStatus: "active",
          membershipExpiresAt: expiresTimestamp,
          role: "player",
          status: "active",
        },
      };

      await leagueRef.update(membershipData);

      // Create subscription record
      const subscriptionRef = db.collection("subscriptions").doc();
      await subscriptionRef.set({
        userId: userId,
        leagueId: leagueId,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: expiresAt,
        autoRenew: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        paymentHistory: [paymentRef.id],
        lastPaymentId: paymentRef.id,
      });

      return {
        success: true,
        paymentId: response.payment.id,
        membershipExpiresAt: expiresAt.toISOString(),
        expiresTimestamp: expiresTimestamp,
      };

    } catch (error: any) {
      logger.error("Payment processing error:", error);
      
      // Save failed payment record
      await db.collection("payments").add({
        userId: userId,
        leagueId: leagueId,
        amount: amount,
        currency: "USD",
        status: "failed",
        type: "initial",
        createdAt: FieldValue.serverTimestamp(),
        failureReason: error.message,
      });

      throw new Error(`Payment failed: ${error.message}`);
    }
  }
);

// Export expired membership functions
export {
  checkExpiredMemberships,
  manualCheckExpiredMemberships,  
  extendMembershipAfterPayment,
  reactivateMembership
} from "./expiredMemberships";

// Export Square checkout functions
export { createSquareCheckout } from "./squareCheckout";
export { handleSquareWebhook } from "./squareWebhook";

// Export testing functions (for development only)
export { setMembershipStatus } from "./testMembership";
export { testSquareIntegration } from "./testSquareIntegration";
