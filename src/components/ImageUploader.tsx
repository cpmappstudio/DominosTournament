import React, { useState, useRef, useCallback } from "react";
import { CameraIcon, TrashIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { Dialog, DialogTitle, DialogBody, DialogActions } from "./dialog";
import { Button } from "./button";

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onImageSelect?: (file: File | null) => void;
  onImageRemove?: () => void;
  onImageUpload?: (file: File) => Promise<string>; // Returns uploaded image URL
  uploading?: boolean;
  error?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
  title?: string;
  placeholder?: string;
  acceptedFormats?: string[];
  maxSizeInMB?: number;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  currentImageUrl,
  onImageSelect,
  onImageRemove,
  onImageUpload,
  uploading = false,
  error,
  className = "",
  size = "lg",
  title = "Image",
  placeholder = "Upload",
  acceptedFormats = ["JPG", "PNG", "GIF", "WebP"],
  maxSizeInMB = 5,
  disabled = false
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [internalUploading, setInternalUploading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use internal state if external state not provided
  const isUploading = uploading || internalUploading;
  const currentError = error || internalError;

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
      return `Please select an image file (${acceptedFormats.join(', ')})`;
    }

    // Validate file size
    const maxSize = maxSizeInMB * 1024 * 1024;
    if (file.size > maxSize) {
      return `Image size must be less than ${maxSizeInMB}MB`;
    }

    return null;
  }, [acceptedFormats, maxSizeInMB]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (disabled) return;

    const validationError = validateFile(file);
    if (validationError) {
      setInternalError(validationError);
      return;
    }

    setInternalError(null);

    // If onImageUpload is provided, handle upload internally
    if (onImageUpload) {
      setInternalUploading(true);
      try {
        await onImageUpload(file);
        setIsDialogOpen(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to upload image";
        setInternalError(errorMessage);
      } finally {
        setInternalUploading(false);
      }
    } else {
      // Otherwise, call onImageSelect if provided
      if (onImageSelect) {
        onImageSelect(file);
      }
      setIsDialogOpen(false);
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [disabled, validateFile, onImageUpload, onImageSelect]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [disabled, handleFileSelect]);

  const handleRemoveImage = useCallback(() => {
    if (disabled) return;
    
    if (onImageRemove) {
      onImageRemove();
    } else if (onImageSelect) {
      onImageSelect(null);
    }
    setInternalError(null);
    setIsDialogOpen(false);
  }, [disabled, onImageRemove, onImageSelect]);

  const triggerFileInput = useCallback(() => {
    if (disabled) return;
    fileInputRef.current?.click();
  }, [disabled]);

  const handleImageClick = useCallback(() => {
    if (disabled) return;
    
    if (currentImageUrl) {
      setIsDialogOpen(true);
    } else {
      triggerFileInput();
    }
  }, [disabled, currentImageUrl, triggerFileInput]);

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {/* Image Container */}
        <div
          className={`
            relative ${containerSize} rounded-lg overflow-hidden border-2 border-dashed 
            transition-all duration-200 cursor-pointer flex-shrink-0 ${className}
            ${dragOver 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
              : 'border-gray-300 dark:border-zinc-600 hover:border-gray-400 dark:hover:border-zinc-500'
            }
            ${isUploading || disabled ? 'pointer-events-none opacity-75' : ''}
            ${currentError ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleImageClick}
        >
          {currentImageUrl ? (
            /* Current Image */
            <img
              src={currentImageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Default placeholder */
            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-700 dark:to-zinc-800 text-gray-600 dark:text-zinc-400">
              <PhotoIcon className={`${config.icon} mb-1`} />
              <div className={`${config.text} text-center`}>
                <p className="font-medium">{title}</p>
                <p className="text-xs opacity-75">{placeholder}</p>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {isUploading && (
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
          disabled={isUploading || disabled}
        />

        {/* Error message */}
        {currentError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Upload Error</p>
              <p className="text-xs mt-1 opacity-90">{currentError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Dialog */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} size="lg">
        <DialogTitle>{title}</DialogTitle>
        <DialogBody>
          {currentImageUrl && (
            <div className="mb-6">
              <img
                src={currentImageUrl}
                alt={title}
                className="w-full h-auto max-h-96 object-contain rounded-lg"
              />
            </div>
          )}
          
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>• Supported formats: {acceptedFormats.join(', ')}</p>
              <p>• Maximum size: {maxSizeInMB}MB</p>
              <p>• Drag & drop or click to upload</p>
            </div>
            
            {currentError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Upload Error</p>
                  <p className="text-xs mt-1 opacity-90">{currentError}</p>
                </div>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            outline
            onClick={() => setIsDialogOpen(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={triggerFileInput}
              disabled={isUploading}
              color="blue"
            >
              <CameraIcon className="h-4 w-4 mr-2" />
              {currentImageUrl ? "Change Image" : "Upload Image"}
            </Button>
            
            {currentImageUrl && (
              <Button
                onClick={handleRemoveImage}
                disabled={isUploading}
                color="red"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Remove Image
              </Button>
            )}
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ImageUploader;
