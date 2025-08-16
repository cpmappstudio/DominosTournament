import React, { useState, memo } from 'react';
import { PaymentForm, CreditCard, ApplePay, GooglePay } from 'react-square-web-payments-sdk';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard as CreditCardIcon, DollarSign, Check } from "lucide-react";

// Firebase functions
const processLeaguePayment = httpsCallable(functions, 'processLeaguePayment');
const extendMembershipAfterPayment = httpsCallable(functions, 'extendMembershipAfterPayment');

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  leagueName: string;
  monthlyFee: number;
  currency?: string;
  onSuccess?: () => void;
  userId?: string; // Add userId for membership extension
}

const PaymentModal = memo<PaymentModalProps>(({
  isOpen,
  onClose,
  leagueId,
  leagueName,
  monthlyFee,
  currency = 'USD',
  onSuccess,
  userId
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verificar configuración de Square
  const squareApplicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
  const squareLocationId = import.meta.env.VITE_SQUARE_LOCATION_ID;
  const squareEnvironment = import.meta.env.VITE_SQUARE_ENVIRONMENT;

  const isSquareConfigured = squareApplicationId && 
    squareLocationId && 
    squareApplicationId !== 'your_sandbox_application_id' && 
    squareLocationId !== 'your_sandbox_location_id';

  const handlePaymentResult = async (token: any, verifiedBuyer?: any) => {
    if (!token?.token) {
      setErrorMessage('Invalid payment token');
      setPaymentStatus('error');
      return;
    }

    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      // Process the payment
      const result = await processLeaguePayment({
        sourceId: token.token,
        leagueId: leagueId,
        amount: monthlyFee
      });

      const data = result.data as { success?: boolean; error?: string; paymentId?: string };
      
      if (data.success && data.paymentId) {
        // Extend membership after successful payment
        if (userId) {
          try {
            const extensionResult = await extendMembershipAfterPayment({
              userId: userId,
              leagueId: leagueId,
              paymentId: data.paymentId,
              months: 1
            });
            
            // Check if membership was reactivated
            const membershipData = extensionResult.data as any;
            if (membershipData.reactivated) {
              console.log('Membership reactivated for inactive user');
              setPaymentStatus('success');
            } else {
              console.log('Membership extended for active user');
              setPaymentStatus('success');
            }
            
          } catch (membershipError) {
            console.warn('Payment successful but membership extension failed:', membershipError);
            // Don't fail the entire process if membership extension fails
            setPaymentStatus('success');
          }
        } else {
          setPaymentStatus('success');
        }

        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      } else {
        throw new Error(data.error || 'Payment processing failed');
      }
    } catch (error: any) {
      console.error('Payment failed:', error);
      setErrorMessage(error.message || 'Payment failed. Please try again.');
      setPaymentStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setPaymentStatus('idle');
      setErrorMessage(null);
      onClose();
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Join Premium League
          </DialogTitle>
          <DialogDescription>
            Complete your payment to join <strong>{leagueName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Square Configuration Check */}
          {!isSquareConfigured && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="text-orange-800 dark:text-orange-200">
                <p className="font-medium">Square Configuration Required</p>
                <p className="text-sm mt-1">
                  Square credentials are not configured. Check SQUARE_SETUP_GUIDE.md to set up your account.
                </p>
              </div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Monthly Fee:</span>
              <span className="font-semibold">{formatCurrency(monthlyFee, currency)}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Access Period:</span>
              <span className="text-sm">30 days</span>
            </div>
          </div>

          {/* Payment Status Messages */}
          {paymentStatus === 'success' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <Check className="w-5 h-5" />
                <span className="font-medium">Payment Successful!</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                Welcome to {leagueName}! You now have full access.
              </p>
            </div>
          )}

          {paymentStatus === 'error' && errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="text-red-800 dark:text-red-200">
                <p className="font-medium">Payment Failed</p>
                <p className="text-sm mt-1">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Square Payment Form */}
          {paymentStatus !== 'success' && isSquareConfigured && (
            <div className="space-y-4">
              <PaymentForm
                applicationId={squareApplicationId}
                locationId={squareLocationId}
                cardTokenizeResponseReceived={handlePaymentResult}
                createPaymentRequest={() => ({
                  countryCode: "US",
                  currencyCode: currency,
                  total: {
                    amount: monthlyFee.toFixed(2),
                    label: `${leagueName} - Monthly Fee`,
                  },
                })}
              >
                {/* Digital Wallets - Only show on HTTPS */}
                {location.protocol === 'https:' && (
                  <div className="space-y-2 mb-4">
                    <ApplePay />
                    <GooglePay />
                  </div>
                )}

                {/* Credit Card */}
                <CreditCard
                  buttonProps={{
                    isLoading: isProcessing,
                    css: {
                      backgroundColor: "#3b82f6",
                      fontSize: "14px",
                      color: "#fff",
                      "&:hover": {
                        backgroundColor: "#2563eb",
                      },
                      "&:disabled": {
                        opacity: 0.6,
                        cursor: "not-allowed",
                      },
                    },
                  }}
                  style={{
                    input: {
                      fontSize: "14px",
                    },
                    ".input-container": {
                      borderRadius: "6px",
                    },
                  }}
                />
              </PaymentForm>
            </div>
          )}

          {/* Message when Square is not configured */}
          {!isSquareConfigured && (
            <div className="text-center py-6">
              <CreditCardIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Payments are temporarily disabled.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Configure Square Payment to enable payments.
              </p>
            </div>
          )}
        </div>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center rounded-lg">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Processing payment...</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            {paymentStatus === 'success' ? 'Close' : 'Cancel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

PaymentModal.displayName = 'PaymentModal';

export default PaymentModal;
