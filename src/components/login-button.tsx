import React, { useState } from "react";
import { UserIcon } from "@heroicons/react/16/solid";

interface LoginButtonProps {
  onClick: () => void;
  className?: string;
  variant?: "sidebar" | "navbar";
}

export const LoginButton: React.FC<LoginButtonProps> = ({ 
  onClick, 
  className = "", 
  variant = "sidebar" 
}) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    
    try {
      await onClick();
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      // Reset loading state after login completes (success or failure)
      setIsLoggingIn(false);
    }
  };
  
  if (variant === "navbar") {
    return (
      <button
        onClick={handleLogin}
        disabled={isLoggingIn}
        className={`flex items-center justify-center rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white ${isLoggingIn ? 'opacity-70' : ''} ${className}`}
        aria-label="Login with Google"
      >
        {isLoggingIn ? (
          <div className="h-5 w-5 border-2 border-t-transparent border-zinc-600 rounded-full animate-spin" />
        ) : (
          <UserIcon className="h-5 w-5" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={isLoggingIn}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm/6 font-medium  hover:text-zinc-200 text-white hover:bg-zinc-800 ${isLoggingIn ? 'opacity-70' : ''} ${className}`}
    >
      <div className="flex h-5 w-5 items-center justify-center">
        {isLoggingIn ? (
          <div className="h-5 w-5 border-2 border-t-transparent border-zinc-600 rounded-full animate-spin" />
        ) : (
          <UserIcon className="h-5 w-5" />
        )}
      </div>
      <span>{isLoggingIn ? "Signing in..." : "Login with Google"}</span>
    </button>
  );
};