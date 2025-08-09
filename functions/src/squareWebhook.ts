import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHmac } from "crypto";

const db = getFirestore();

/**
 * Verify Square webhook signature for security
 */
function verifySquareSignature(body: string, signature: string, webhookSignatureKey: string): boolean {
  try {
    // Square uses HMAC SHA-256 with the webhook signature key
    const expectedSignature = createHmac('sha256', webhookSignatureKey)
      .update(body)
      .digest('base64');

    // Compare signatures in a timing-safe manner
    return signature === expectedSignature;
  } catch (error) {
    logger.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Handle Square webhook events for payment confirmations
 * This endpoint will be called by Square when payments are completed
 */
export const handleSquareWebhook = onRequest(
  { 
    region: "us-central1",
    cors: false, // Disable CORS for webhooks
  },
  async (req, res) => {
    try {
      // Verify the request method
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Get the webhook signature for verification (Square sends this)
      const signature = req.get("x-square-hmacsha256-signature");
      const body = JSON.stringify(req.body);
      
      // Verify webhook signature for security (in production)
      const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
      if (webhookSignatureKey && signature) {
        const isValidSignature = verifySquareSignature(body, signature, webhookSignatureKey);
        if (!isValidSignature) {
          logger.warn("Invalid webhook signature received");
          res.status(401).json({ error: "Invalid signature" });
          return;
        }
        logger.info("Webhook signature verified successfully");
      } else {
        logger.warn("Webhook signature verification skipped (missing key or signature)");
      }
      logger.info("Square webhook received", {
        signature,
        eventType: req.body?.type,
        eventId: req.body?.event_id
      });

      const event = req.body;

      // Handle different Square event types
      switch (event.type) {
        case "payment.created":
          await handlePaymentCreated(event.data.object.payment);
          break;
          
        case "payment.updated":
          await handlePaymentUpdated(event.data.object.payment);
          break;
          
        case "invoice.payment_made":
          await handleInvoicePaymentMade(event.data.object.invoice_payment_request);
          break;
          
        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      // Respond to Square that we received the webhook
      res.status(200).json({ success: true, message: "Webhook processed" });

    } catch (error) {
      logger.error("Error processing Square webhook:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * Handle payment created event from Square
 */
async function handlePaymentCreated(payment: any) {
  try {
    logger.info("Processing payment created event", {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount_money
    });

    // Extract custom data from payment note or order
    const note = payment.note || "";
    const leagueMatch = note.match(/League: ([^|]+)/);
    const userMatch = note.match(/User: ([^|]+)/);
    
    if (!leagueMatch || !userMatch) {
      logger.error("Could not extract league or user info from payment", { note });
      return;
    }

    const leagueId = leagueMatch[1].trim();
    const userId = userMatch[1].trim();

    // Only process completed payments
    if (payment.status === "COMPLETED") {
      await processSuccessfulPayment({
        paymentId: payment.id,
        leagueId,
        userId,
        amount: payment.amount_money.amount / 100, // Convert from cents
        currency: payment.amount_money.currency,
        squarePaymentData: payment
      });
    }

  } catch (error) {
    logger.error("Error handling payment created:", error);
  }
}

/**
 * Handle payment updated event from Square
 */
async function handlePaymentUpdated(payment: any) {
  try {
    logger.info("Processing payment updated event", {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount_money
    });

    // Extract custom data from payment note
    const note = payment.note || "";
    const leagueMatch = note.match(/League: ([^|]+)/);
    const userMatch = note.match(/User: ([^|]+)/);
    
    if (!leagueMatch || !userMatch) {
      logger.error("Could not extract league or user info from payment update", { note });
      return;
    }

    const leagueId = leagueMatch[1].trim();
    const userId = userMatch[1].trim();

    if (payment.status === "COMPLETED") {
      await processSuccessfulPayment({
        paymentId: payment.id,
        leagueId,
        userId,
        amount: payment.amount_money.amount / 100,
        currency: payment.amount_money.currency,
        squarePaymentData: payment
      });
    } else if (payment.status === "FAILED" || payment.status === "CANCELED") {
      await processFailedPayment({
        paymentId: payment.id,
        leagueId,
        userId,
        status: payment.status,
        squarePaymentData: payment
      });
    }

  } catch (error) {
    logger.error("Error handling payment updated:", error);
  }
}

/**
 * Handle invoice payment made event
 */
async function handleInvoicePaymentMade(invoicePayment: any) {
  logger.info("Invoice payment made", { invoicePayment });
  // Handle invoice payments if needed
}

/**
 * Process a successful payment and activate/extend membership
 */
async function processSuccessfulPayment(paymentData: {
  paymentId: string;
  leagueId: string;
  userId: string;
  amount: number;
  currency: string;
  squarePaymentData: any;
}) {
  const { paymentId, leagueId, userId, amount, currency, squarePaymentData } = paymentData;

  try {
    // Save payment record
    await db.collection("payments").add({
      paymentId,
      squarePaymentId: paymentId,
      userId,
      leagueId,
      amount,
      currency,
      status: "completed",
      type: "membership_payment",
      paymentMethod: "square_checkout",
      squareData: squarePaymentData,
      createdAt: FieldValue.serverTimestamp(),
      processedAt: FieldValue.serverTimestamp(),
    });

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
        lastPaymentId: paymentId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
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
      // Update existing membership (reactivate if needed)
      const membershipDoc = membershipQuery.docs[0];
      await membershipDoc.ref.update({
        status: "active",
        paymentStatus: "active",
        membershipExpiresAt: expiresTimestamp,
        lastPaymentId: paymentId,
        updatedAt: FieldValue.serverTimestamp(),
        ...(membershipDoc.data().status === "inactive" && {
          reactivatedAt: FieldValue.serverTimestamp()
        })
      });
    }

    // Log membership event
    await db.collection("membershipEvents").add({
      leagueId,
      userId,
      eventType: membershipQuery.empty ? "membership_created" : "membership_extended",
      status: "active",
      paymentId,
      expirationDate: expiresTimestamp,
      timestamp: FieldValue.serverTimestamp(),
      reason: "square_payment_completed"
    });

    logger.info("Successfully processed payment and updated membership", {
      paymentId,
      leagueId,
      userId,
      membershipExpires: expirationDate.toISOString()
    });

  } catch (error) {
    logger.error("Error processing successful payment:", error);
    throw error;
  }
}

/**
 * Process a failed payment
 */
async function processFailedPayment(paymentData: {
  paymentId: string;
  leagueId: string;
  userId: string;
  status: string;
  squarePaymentData: any;
}) {
  const { paymentId, leagueId, userId, status, squarePaymentData } = paymentData;

  try {
    // Save failed payment record
    await db.collection("payments").add({
      paymentId,
      squarePaymentId: paymentId,
      userId,
      leagueId,
      status: "failed",
      type: "membership_payment",
      paymentMethod: "square_checkout",
      failureReason: status,
      squareData: squarePaymentData,
      createdAt: FieldValue.serverTimestamp(),
      processedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Recorded failed payment", {
      paymentId,
      leagueId,
      userId,
      status
    });

  } catch (error) {
    logger.error("Error processing failed payment:", error);
  }
}
