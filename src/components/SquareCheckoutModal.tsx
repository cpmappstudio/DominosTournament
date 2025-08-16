import React, { useState, memo } from 'react';
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
import { Loader2, CreditCard, DollarSign, ExternalLink, Shield, Zap } from "lucide-react";

// Firebase function
const createSquareCheckout = httpsCallable(functions, 'createSquareCheckout');

interface SquareCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  leagueName: string;
  monthlyFee: number;
  currency?: string;
  onSuccess?: () => void;
  userId?: string;
}

const SquareCheckoutModal = memo<SquareCheckoutModalProps>(({
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const returnUrl = `${window.location.origin}/leagues/${leagueId}?payment=success`;
      
      const result = await createSquareCheckout({
        leagueId,
        leagueName,
        amount: monthlyFee,
        currency,
        returnUrl,
        userId
      });

      const data = result.data as any;
      
      if (data.success && data.checkoutUrl) {
        // Redirect to Square's secure checkout page
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }

    } catch (error: any) {
      console.error('Error creating checkout:', error);
      setErrorMessage(error.message || 'Failed to start payment process');
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Join League Payment
          </DialogTitle>
          <DialogDescription>
            Complete your membership payment for {leagueName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Payment Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300">Monthly Membership</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(monthlyFee)}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Renews automatically every month
            </p>
          </div>

          {/* Square Benefits */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">Secure Payment by Square</h4>
            <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Bank-level security & encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-500" />
                <span>Credit cards, Apple Pay, Google Pay supported</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-500" />
                <span>Instant activation after payment</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-700 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Payment Process Info */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">What happens next:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>You'll be redirected to Square's secure payment page</li>
              <li>Complete your payment with your preferred method</li>
              <li>Return automatically to the league page</li>
              <li>Your membership will be activated instantly</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating checkout...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Pay {formatCurrency(monthlyFee)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

SquareCheckoutModal.displayName = 'SquareCheckoutModal';

export default SquareCheckoutModal;
