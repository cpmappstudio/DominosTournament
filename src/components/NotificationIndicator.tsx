import React from "react";

interface NotificationIndicatorProps {
  count?: number;
  showCount?: boolean;
  className?: string;
  size?: "small" | "medium" | "large";
}

const NotificationIndicator: React.FC<NotificationIndicatorProps> = ({
  count = 0,
  showCount = false,
  className = "",
  size = "medium",
}) => {
  if (count <= 0) return null;

  // Determine size classes
  const sizeClasses = {
    small: "w-2 h-2",
    medium: "w-3 h-3",
    large: "w-4 h-4",
  };

  // Determine text size for count
  const textSizeClasses = {
    small: "text-[8px] leading-none",
    medium: "text-[10px] leading-none",
    large: "text-xs leading-none",
  };

  // Show just a dot if not showing count
  if (!showCount) {
    return (
      <span
        className={`absolute top-0 right-0 block ${sizeClasses[size]} rounded-full bg-red-500 ring-2 ring-white dark:ring-zinc-900 ${className}`}
        aria-hidden="true"
      />
    );
  }

  // Show a badge with count
  return (
    <span
      className={`absolute -top-1 -right-1 flex items-center justify-center ${
        count > 99 ? "min-w-5" : "min-w-4"
      } h-4 rounded-full bg-red-500 ${
        textSizeClasses[size]
      } font-medium text-white ring-2 ring-white dark:ring-zinc-900 ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
};

export default NotificationIndicator;