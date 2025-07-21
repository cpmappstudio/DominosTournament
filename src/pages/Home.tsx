import React from "react";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import {
  PlayIcon,
  UserIcon,
  Cog6ToothIcon as SettingsIcon,
  ClipboardIcon,
} from "@heroicons/react/24/solid";

const Home: React.FC = () => {
  const isLoggedIn = !!auth.currentUser;

  // Main navigation buttons config
  const mainNavButtons = [
    {
      icon: <PlayIcon className="w-8 h-8" />,
      label: "New Game",
      path: "/create-game",
      description: "Start a new domino game",
      color: "bg-blue-600 hover:bg-blue-700",
      requiresAuth: true,
    },
    {
      icon: <ClipboardIcon className="w-8 h-8" />,
      label: "Rules",
      path: "/rules",
      description: "Learn about Boricua-style domino rules",
      color: "bg-emerald-600 hover:bg-emerald-700",
      requiresAuth: false,
    },
    {
      icon: <UserIcon className="w-8 h-8" />,
      label: "My Profile",
      path: "/profile",
      description: "View your stats and game history",
      color: "bg-violet-600 hover:bg-violet-700",
      requiresAuth: true,
    },
    {
      icon: <SettingsIcon className="w-8 h-8" />,
      label: "Settings",
      path: "/settings",
      description: "Customize your game experience",
      color: "bg-gray-600 hover:bg-gray-700",
      requiresAuth: false,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6 text-zinc-900 dark:text-white">
      {/* Hero Section with Logo */}
      <div className="text-center mb-10">
        <div className="flex justify-center">
          <img
            src="/usa-federation-long.png"
            alt="USA Domino Federation"
            className="w-48 h-48"
          />
        </div>
        <h1 className="text-4xl font-bold collapse">USA Domino Federation</h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto">
          Experience the authentic Puerto Rican style domino game with friends
          and competitors
        </p>
      </div>

      {/* Main Navigation Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl w-full">
        {mainNavButtons.map((button) => (
          <Link
            key={button.label}
            to={!button.requiresAuth || isLoggedIn ? button.path : "#"}
            onClick={
              button.requiresAuth && !isLoggedIn
                ? (e) => {
                    e.preventDefault();
                    alert("Please sign in to access this feature");
                  }
                : undefined
            }
            className={`flex flex-col items-center p-6 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 ${button.color} text-white`}
          >
            <div className="mb-4 bg-white/20 p-4 rounded-full">
              {button.icon}
            </div>
            <h2 className="text-2xl font-bold mb-2">{button.label}</h2>
            <p className="text-center text-white/80">{button.description}</p>
            {button.requiresAuth && !isLoggedIn && (
              <span className="mt-3 text-sm bg-white/20 px-3 py-1 rounded-full">
                Sign in required
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Welcome Message for New Users */}
      {!isLoggedIn && (
        <div className="mt-10 bg-white/10 dark:bg-zinc-800/50 p-6 rounded-lg max-w-2xl text-center">
          <p className="text-lg mb-3">
            Welcome to the USA Domino Federation platform! Sign in to track your
            games, compete with friends, and climb the rankings.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            No account? No problem! Sign in with your Google account to get
            started.
          </p>
        </div>
      )}
    </div>
  );
};

export default Home;
