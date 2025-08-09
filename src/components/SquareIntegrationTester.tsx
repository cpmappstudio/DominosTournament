import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, TestTube } from "lucide-react";

const testSquareIntegration = httpsCallable(functions, 'testSquareIntegration');

interface SquareIntegrationTesterProps {
  leagueId: string;
  userId: string;
  leagueName: string;
}

export default function SquareIntegrationTester({ leagueId, userId, leagueName }: SquareIntegrationTesterProps) {
  const [isTestingSuccess, setIsTestingSuccess] = useState(false);
  const [isTestingFailure, setIsTestingFailure] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runTest = async (simulate: 'success' | 'failure') => {
    const setLoading = simulate === 'success' ? setIsTestingSuccess : setIsTestingFailure;
    setLoading(true);
    setError(null);
    setTestResults(null);

    try {
      console.log('Testing Square integration...', { leagueId, userId, simulate });
      
      const result = await testSquareIntegration({
        leagueId,
        userId,
        amount: 25,
        simulate
      });

      setTestResults({
        type: simulate,
        data: result.data,
        timestamp: new Date().toISOString()
      });

      console.log('Test result:', result.data);
      
    } catch (error: any) {
      console.error('Test failed:', error);
      setError(error.message || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults(null);
    setError(null);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5 text-blue-600" />
          Square Payment Integration Tester
        </CardTitle>
        <CardDescription>
          Test the payment flow for {leagueName} without making real payments
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={() => runTest('success')}
            disabled={isTestingSuccess || isTestingFailure}
            className="w-full"
            variant="default"
          >
            {isTestingSuccess ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Success...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Test Success Payment
              </>
            )}
          </Button>
          
          <Button
            onClick={() => runTest('failure')}
            disabled={isTestingSuccess || isTestingFailure}
            className="w-full"
            variant="destructive"
          >
            {isTestingFailure ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Failure...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Test Failed Payment
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {testResults && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Test Results</h3>
              <Button onClick={clearResults} variant="ghost" size="sm">
                Clear
              </Button>
            </div>
            
            <div className={`border rounded-md p-4 ${
              testResults.data.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResults.data.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">
                  {testResults.type === 'success' ? 'Success Test' : 'Failure Test'}
                </span>
              </div>
              
              <div className="text-sm space-y-2">
                <p><strong>Message:</strong> {testResults.data.message}</p>
                <p><strong>Payment ID:</strong> {testResults.data.paymentId}</p>
                {testResults.data.membershipExpires && (
                  <p><strong>Membership Expires:</strong> {new Date(testResults.data.membershipExpires).toLocaleString()}</p>
                )}
                <p><strong>Test Time:</strong> {new Date(testResults.timestamp).toLocaleString()}</p>
              </div>
            </div>
            
            <details className="text-sm">
              <summary className="cursor-pointer font-medium hover:text-blue-600">
                View Raw Response
              </summary>
              <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-auto">
                {JSON.stringify(testResults.data, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded">
          <p><strong>How this works:</strong></p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Success test: Simulates completed payment and activates membership</li>
            <li>Failure test: Simulates failed payment and logs the failure</li>
            <li>All test payments are marked as test data in the database</li>
            <li>Check Firestore collections: payments, leagueMemberships, membershipEvents</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
