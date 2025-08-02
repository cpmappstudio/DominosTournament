import React, { memo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface ProfileCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  skeleton?: React.ReactNode;
}

/**
 * Reusable ProfileCard component using Shadcn Card
 * Provides consistent styling and structure for all profile sections
 */
export const ProfileCard = memo<ProfileCardProps>(({ 
  title, 
  description, 
  children, 
  className = "",
  loading = false,
  skeleton
}) => {
  if (loading && skeleton) {
    return skeleton;
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {children}
      </CardContent>
    </Card>
  );
});

ProfileCard.displayName = 'ProfileCard';

export default ProfileCard;
