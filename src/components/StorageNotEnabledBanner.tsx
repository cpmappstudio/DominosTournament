import React from "react";
import { ExclamationTriangleIcon, CogIcon } from "@heroicons/react/24/outline";

const StorageNotEnabledBanner: React.FC = () => {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 dark:bg-yellow-900/20 dark:border-yellow-500">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-200">
            <strong>Firebase Storage not enabled:</strong> To upload profile images, you need to enable 
            Firebase Storage in your Firebase Console.
          </p>
          <div className="mt-2">
            <div className="text-sm">
              <a
                href="https://console.firebase.google.com/project/domino-federation/storage"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-yellow-700 underline hover:text-yellow-600 dark:text-yellow-200 dark:hover:text-yellow-100 flex items-center"
              >
                <CogIcon className="h-4 w-4 mr-1" />
                Open Firebase Console to enable Storage
              </a>
            </div>
          </div>
          <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-300">
            <p>1. Click the link above → 2. Click "Get started" → 3. Select region → 4. Done!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageNotEnabledBanner;
