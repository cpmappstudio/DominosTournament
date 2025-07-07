import React, { useState } from "react";
import { Avatar } from "@/components/avatar";
import type { User } from "firebase/auth";

interface ProfileAvatarProps {
  user: User | null;
  className?: string;
  square?: boolean;
  size?: "small" | "medium" | "large";
  fallbackSrc?: string;
  alt?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  user,
  className = "",
  square = true,
  size = "medium",
  fallbackSrc = "/profile-photo.jpg",
  alt,
}) => {
  const [imageError, setImageError] = useState(false);
  
  // Size classes mapping
  const sizeClasses = {
    small: "size-8",
    medium: "size-10",
    large: "size-12",
  };

  // Determine the source of the avatar
  const src = user?.photoURL && !imageError ? user.photoURL : fallbackSrc;
  
  // Determine alt text - prioritize provided alt, then displayName, then default
  const avatarAlt = alt || user?.displayName || "User profile";

  return (
    <Avatar
      src={src}
      square={square}
      className={`${sizeClasses[size]} ${className}`}
      alt={avatarAlt}
      onError={() => setImageError(true)}
    />
  );
};