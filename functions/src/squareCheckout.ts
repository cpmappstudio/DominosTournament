import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

/**
 * Create a Square Online Checkout session for league membership payment
 */
export const createSquareCheckout = onCall(
  { region: "us-central1" },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { leagueId, leagueName, amount, currency = "USD", returnUrl, userId } = request.data;

    if (!leagueId || !leagueName || !amount || amount <= 0) {
      throw new HttpsError("invalid-argument", "Invalid checkout parameters");
    }

    const userIdToUse = userId || request.auth.uid;

    try {
      // Get Square access token from environment
      const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
      const squareEnvironment = process.env.SQUARE_ENVIRONMENT || "sandbox";
      
      if (!squareAccessToken) {
        throw new HttpsError("failed-precondition", "Square access token not configured");
      }

      // Determine Square API endpoint
      const baseUrl = squareEnvironment === "production" 
        ? "https://connect.squareup.com" 
        : "https://connect.squareupsandbox.com";

      // Create checkout request body
      const checkoutRequest = {
        idempotency_key: `checkout-${userIdToUse}-${leagueId}-${Date.now()}`,
        order: {
          location_id: process.env.SQUARE_LOCATION_ID,
          line_items: [
            {
              name: `${leagueName} - Monthly Membership`,
              quantity: "1",
              base_price_money: {
                amount: Math.round(amount * 100), // Convert to cents
                currency: currency
              },
              variation_name: "Monthly Subscription"
            }
          ]
        },
        checkout_options: {
          ask_for_shipping_address: false,
          merchant_support_email: "support@dominofederation.com",
          redirect_url: returnUrl || `${process.env.CLIENT_BASE_URL}/leagues/${leagueId}?payment=success`
        },
        pre_populate_buyer_email: request.auth.token?.email || "",
        payment_note: `League: ${leagueId} | User: ${userIdToUse} | Type: membership_payment`
      };

      // Make request to Square API
      const response = await fetch(`${baseUrl}/v2/online-checkout/payment-links`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${squareAccessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-07-17"
        },
        body: JSON.stringify(checkoutRequest)
      });

      const responseData = await response.json();

      if (!response.ok) {
        logger.error("Square API Error:", responseData);
        throw new HttpsError("internal", `Square API error: ${responseData.errors?.[0]?.detail || "Unknown error"}`);
      }

      // Extract checkout URL
      const checkoutUrl = responseData.payment_link?.url;
      const paymentLinkId = responseData.payment_link?.id;

      if (!checkoutUrl) {
        throw new HttpsError("internal", "Failed to create checkout URL");
      }

      logger.info("Square checkout created successfully", {
        leagueId,
        userId: userIdToUse,
        paymentLinkId,
        amount,
        currency
      });

      return {
        success: true,
        checkoutUrl,
        paymentLinkId,
        message: "Checkout session created successfully"
      };

    } catch (error) {
      logger.error("Error creating Square checkout:", error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError("internal", "Failed to create checkout session");
    }
  }
);
