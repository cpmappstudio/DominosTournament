import React from 'react';
import { AlertTriangle, Wifi, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface DatabaseErrorProps {
  error: Error;
  onRetry?: () => void;
  onRefresh?: () => void;
}

export const DatabaseError: React.FC<DatabaseErrorProps> = ({
  error,
  onRetry,
  onRefresh,
}) => {
  const isNetworkError = error.message.includes('network') || 
                        error.message.includes('offline') ||
                        error.message.includes('connection');
  
  const isPermissionError = error.message.includes('permission') ||
                           error.message.includes('unauthorized') ||
                           error.message.includes('auth');

  const getErrorMessage = () => {
    if (isNetworkError) {
      return 'Connection problem. Please check your internet connection and try again.';
    }
    
    if (isPermissionError) {
      return 'You don\'t have permission to access this data. Please try logging in again.';
    }
    
    return 'There was a problem loading the data. Please try again.';
  };

  const getErrorIcon = () => {
    if (isNetworkError) {
      return <Wifi className="h-6 w-6 text-orange-600 dark:text-orange-400" />;
    }
    
    return <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />;
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
        {getErrorIcon()}
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {isNetworkError ? 'Connection Error' : 'Data Error'}
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-md">
        {getErrorMessage()}
      </p>

      {import.meta.env.DEV && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/50 rounded-md text-left w-full max-w-md">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            Error Details (Development)
          </h4>
          <pre className="text-xs text-red-700 dark:text-red-300 overflow-auto max-h-32">
            {error.message}
          </pre>
        </div>
      )}

      <div className="flex gap-3">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
        
        {onRefresh && (
          <Button
            onClick={onRefresh}
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
};
