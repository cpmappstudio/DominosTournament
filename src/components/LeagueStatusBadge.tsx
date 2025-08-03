/**
 * League Status Badge Component
 * 
 * A component that displays league status with visual indicators,
 * next transition information, and automatic updates.
 */

import React, { memo } from 'react';
import { useLeagueStatus, useLeagueStatusDisplay } from '../hooks/useLeagueStatus';
import { CalendarIcon, ClockIcon } from '@heroicons/react/24/solid';

interface LeagueStatusBadgeProps {
  leagueId: string;
  initialStatus?: string;
  showTransition?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'card' | 'inline';
  className?: string;
}

const LeagueStatusBadge: React.FC<LeagueStatusBadgeProps> = memo(({
  leagueId,
  initialStatus,
  showTransition = false,
  size = 'md',
  variant = 'badge',
  className = ''
}) => {
  const { status, loading, nextTransition } = useLeagueStatus(leagueId, initialStatus);
  const statusDisplay = useLeagueStatusDisplay(status);

  // Size configurations
  const sizeConfig = {
    sm: {
      text: 'text-xs',
      padding: 'px-2 py-1',
      icon: 'h-3 w-3'
    },
    md: {
      text: 'text-sm',
      padding: 'px-3 py-1.5',
      icon: 'h-4 w-4'
    },
    lg: {
      text: 'text-base',
      padding: 'px-4 py-2',
      icon: 'h-5 w-5'
    }
  };

  const config = sizeConfig[size];

  if (loading && !initialStatus) {
    return (
      <div className={`${config.padding} ${config.text} bg-gray-100 text-gray-500 rounded-full animate-pulse ${className}`}>
        Loading...
      </div>
    );
  }

  // Badge variant (simple status indicator)
  if (variant === 'badge') {
    return (
      <span className={`inline-flex items-center ${config.padding} ${config.text} font-medium rounded-full ${statusDisplay.color} text-white ${className}`}>
        <div className={`${config.icon} mr-1.5 rounded-full bg-white/20`} />
        {statusDisplay.label}
      </span>
    );
  }

  // Inline variant (text with icon)
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center ${config.text} font-medium ${statusDisplay.textColor} ${className}`}>
        <div className={`${config.icon} mr-1.5 rounded-full ${statusDisplay.color}`} />
        {statusDisplay.label}
      </span>
    );
  }

  // Card variant (detailed information)
  return (
    <div className={`rounded-lg border ${statusDisplay.bgColor} border-current/20 p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`${config.icon} rounded-full ${statusDisplay.color}`} />
          <span className={`font-medium ${statusDisplay.textColor} ${config.text}`}>
            {statusDisplay.label}
          </span>
        </div>
        
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent opacity-50" />
        )}
      </div>
      
      <p className={`mt-1 text-xs ${statusDisplay.textColor} opacity-75`}>
        {statusDisplay.description}
      </p>
      
      {showTransition && nextTransition && (
        <div className={`mt-2 pt-2 border-t border-current/10`}>
          <div className="flex items-center space-x-1 text-xs opacity-75">
            <CalendarIcon className="h-3 w-3" />
            <span>
              Next: <strong>{nextTransition.status}</strong> in {nextTransition.daysUntil} day{nextTransition.daysUntil !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-1 text-xs opacity-60 mt-1">
            <ClockIcon className="h-3 w-3" />
            <span>{nextTransition.date.toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
});

LeagueStatusBadge.displayName = 'LeagueStatusBadge';

export default LeagueStatusBadge;
