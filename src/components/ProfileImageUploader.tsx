import React, { useState, useRef, useCallback } from "react";
import { CameraIcon, TrashIcon, UserIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { uploadProfileImage, deleteProfileImage } from "../firebase";
import type { User } from "firebase/auth";
import { Dialog, DialogTitle, DialogBody, DialogActions } from "./dialog";
import { Button } from "./button";

interface ProfileImageUploaderProps {
  user: User;
  onImageUpdate: (newPhotoURL: string | null) => void;
  onError?: (error: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const ProfileImageUploader: React.FC<ProfileImageUploaderProps> = ({
  user,
  onImageUpdate,
  onError,
  className = "",
  size = "lg"
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Size configurations
  const sizeConfig = {
    sm: { container: "w-16 h-16", icon: "h-4 w-4", button: "p-1", text: "text-xs" },
    md: { container: "w-20 h-20", icon: "h-5 w-5", button: "p-1.5", text: "text-sm" },
    lg: { container: "w-24 h-24", icon: "h-6 w-6", button: "p-2", text: "text-base" }
  };

  const config = sizeConfig[size];
  
  // Use custom className if provided, otherwise use size config
  const containerSize = className.includes('w-') ? '' : config.container;

  const validateFile = useCallback((file: File): string | null => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return "Please select an image file (JPG, PNG, GIF, WebP)";
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return "Image size must be less than 5MB";
    }

    return null;
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      if (onError) onError(validationError);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const newPhotoURL = await uploadProfileImage(file, user.uid);
      onImageUpdate(newPhotoURL);
      setError(null);
      setIsDialogOpen(false); // Close dialog after successful upload
    } catch (err) {
      console.error("Upload error:", err);
      
      // More specific error messages
      let errorMessage = "Failed to upload image";
      
      if (err instanceof Error) {
        if (err.message.includes('storage/unauthorized') || err.message.includes('CORS')) {
          errorMessage = "Firebase Storage is not enabled. Please check the setup guide.";
        } else if (err.message.includes('storage/quota-exceeded')) {
          errorMessage = "Storage quota exceeded. Please contact support.";
        } else {
          errorMessage = err.message;
        }
      } else {
        errorMessage = "Firebase Storage is not properly configured. Please enable Storage in Firebase Console.";
      }
      
      setError(errorMessage);
      
      // Call onError callback if provided
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [user.uid, onImageUpdate, onError, validateFile]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDeleteImage = useCallback(async () => {
    setUploading(true);
    setError(null);

    try {
      // Always try to delete, even if user.photoURL is null
      // This handles cases where the image might exist in storage but not in user state
      await deleteProfileImage(user.uid);
      onImageUpdate(null);
      setError(null);
      setIsDialogOpen(false); // Close dialog after successful deletion
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete image";
      setError(errorMessage);
      
      // Call onError callback if provided
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setUploading(false);
    }
  }, [user.uid, onImageUpdate, onError]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageClick = useCallback(() => {
    if (user.photoURL) {
      setIsDialogOpen(true);
    } else {
      triggerFileInput();
    }
  }, [user.photoURL, triggerFileInput]);

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {/* Profile Image Container */}
        <div
          className={`
            relative ${containerSize} rounded-full overflow-hidden border-2 border-dashed 
            transition-all duration-200 cursor-pointer flex-shrink-0 ${className}
            ${dragOver 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-zinc-600 hover:border-gray-400 dark:hover:border-zinc-500'
            }
            ${uploading ? 'pointer-events-none opacity-75' : ''}
            ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleImageClick}
        >
          {user.photoURL ? (
            /* Profile Image */
            <img
              src={user.photoURL}
              alt={user.displayName || "Profile"}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Default avatar placeholder */
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <UserIcon className={`${config.icon} mb-1`} />
              <div className={`${config.text} text-center`}>
                <p className="font-medium">Photo</p>
                <p className="text-xs opacity-75">Upload</p>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Upload Error</p>
              <p className="text-xs mt-1 opacity-90">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Profile Image Dialog */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} size="lg">
        <DialogTitle>Profile Picture</DialogTitle>
        <DialogBody>
          {user.photoURL && (
            <div className="mb-6">
              <img
                src={user.photoURL}
                alt={user.displayName || "Profile"}
                className="w-full h-auto max-h-96 object-contain rounded-lg"
              />
            </div>
          )}
          
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>• Supported formats: JPG, PNG, GIF, WebP</p>
              <p>• Maximum size: 5MB</p>
              <p>• Drag & drop or click to upload</p>
            </div>
            
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Upload Error</p>
                  <p className="text-xs mt-1 opacity-90">{error}</p>
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            outline
            onClick={() => setIsDialogOpen(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={triggerFileInput}
              disabled={uploading}
              color="blue"
            >
              <CameraIcon className="h-4 w-4 mr-2" />
              {user.photoURL ? "Change Picture" : "Upload Picture"}
            </Button>
            
            {user.photoURL && (
              <Button
                onClick={handleDeleteImage}
                disabled={uploading}
                color="red"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Remove Picture
              </Button>
            )}
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ProfileImageUploader;
