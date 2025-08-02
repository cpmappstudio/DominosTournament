import React, { useState, useRef, useCallback } from "react";
import { CameraIcon, TrashIcon, PhotoIcon, TrophyIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

interface LeagueImageUploaderProps {
  currentImageUrl?: string | null;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  uploading?: boolean;
  error?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const LeagueImageUploader: React.FC<LeagueImageUploaderProps> = ({
  currentImageUrl,
  onImageSelect,
  onImageRemove,
  uploading = false,
  error,
  className = "",
  size = "lg"
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Size configurations
  const sizeConfig = {
    sm: { container: "w-16 h-16", icon: "h-6 w-6", button: "p-1", text: "text-xs" },
    md: { container: "w-24 h-24", icon: "h-8 w-8", button: "p-1.5", text: "text-sm" },
    lg: { container: "w-32 h-32", icon: "h-10 w-10", button: "p-2", text: "text-base" }
  };

  const config = sizeConfig[size];
  const imageUrl = preview || currentImageUrl;

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

    // Validate image dimensions (optional - can be adjusted)
    return null;
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      // Handle validation error through parent component
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Call parent handler
    onImageSelect(file);
  }, [validateFile, onImageSelect]);

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

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = useCallback(() => {
    setPreview(null);
    onImageRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onImageRemove]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Upload Area */}
      <div
        className={`
          relative ${config.container} rounded-lg overflow-hidden border-2 border-dashed 
          transition-all duration-200 cursor-pointer group
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
        onClick={triggerFileInput}
      >
        {imageUrl ? (
          <>
            {/* Image Preview */}
            <img
              src={imageUrl}
              alt="League avatar preview"
              className="w-full h-full object-cover"
            />
            
            {/* Overlay with controls */}
            <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerFileInput();
                  }}
                  disabled={uploading}
                  className={`${config.button} bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50`}
                  title="Change image"
                >
                  <CameraIcon className={config.icon} />
                </button>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove();
                  }}
                  disabled={uploading}
                  className={`${config.button} bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50`}
                  title="Remove image"
                >
                  <TrashIcon className={config.icon} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Upload placeholder */
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="relative">
              <TrophyIcon className={`${config.icon} mb-2 text-blue-500 dark:text-blue-400`} />
              <PhotoIcon className="h-4 w-4 absolute -top-1 -right-1 text-gray-400" />
            </div>
            <div className={`${config.text} text-center`}>
              <p className="font-medium">League Avatar</p>
              <p className="text-xs opacity-75">Upload or drag & drop</p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
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

      {/* Help text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>• Supported formats: JPG, PNG, GIF, WebP</p>
        <p>• Maximum size: 5MB</p>
        <p>• Recommended: Square images (512x512px or larger)</p>
        <p>• Drag & drop or click to upload</p>
      </div>
    </div>
  );
};

export default LeagueImageUploader;
