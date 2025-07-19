// import React, { useState, useRef } from "react";
// import { CameraIcon, TrashIcon } from "@heroicons/react/24/outline";
// import { uploadProfileImage, deleteProfileImage } from "../firebase";
// import type { User } from "firebase/auth";

// interface ProfileImageUploaderProps {
//   user: User;
//   onImageUpdate: (newPhotoURL: string | null) => void;
//   onError?: (error: string) => void;
//   className?: string;
// }

// const ProfileImageUploader: React.FC<ProfileImageUploaderProps> = ({
//   user,
//   onImageUpdate,
//   onError,
//   className = "",
// }) => {
//   const [uploading, setUploading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     setUploading(true);
//     setError(null);

//     try {
//       const newPhotoURL = await uploadProfileImage(file, user.uid);
//       onImageUpdate(newPhotoURL);
//     } catch (err) {
//       console.error("Upload error:", err);
      
//       // More specific error messages
//       let errorMessage = "Failed to upload image";
      
//       if (err instanceof Error) {
//         if (err.message.includes('storage/unauthorized') || err.message.includes('CORS')) {
//           errorMessage = "Firebase Storage is not enabled. Please check the setup guide.";
//         } else if (err.message.includes('storage/quota-exceeded')) {
//           errorMessage = "Storage quota exceeded. Please contact support.";
//         } else {
//           errorMessage = err.message;
//         }
//       } else {
//         errorMessage = "Firebase Storage is not properly configured. Please enable Storage in Firebase Console.";
//       }
      
//       setError(errorMessage);
      
//       // Call onError callback if provided
//       if (onError) {
//         onError(errorMessage);
//       }
//     } finally {
//       setUploading(false);
//       // Reset the file input
//       if (fileInputRef.current) {
//         fileInputRef.current.value = "";
//       }
//     }
//   };

//   const handleDeleteImage = async () => {
//     if (!user.photoURL) return;

//     setUploading(true);
//     setError(null);

//     try {
//       await deleteProfileImage(user.uid);
//       onImageUpdate(null);
//     } catch (err) {
//       setError(err instanceof Error ? err.message : "Failed to delete image");
      
//       // Call onError callback if provided
//       if (onError) {
//         onError(err instanceof Error ? err.message : "Failed to delete image");
//       }
//     } finally {
//       setUploading(false);
//     }
//   };

//   const triggerFileInput = () => {
//     fileInputRef.current?.click();
//   };

//   return (
//     <div className={`relative ${className}`}>
//       {/* Profile Image Container */}
//       <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-zinc-700 flex-shrink-0">
//         <img
//           src={user.photoURL || "/profile-photo.jpg"}
//           alt={user.displayName || "Player"}
//           className="w-full h-full object-cover"
//         />

//         {/* Overlay on hover */}
//         <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
//           <div className="flex space-x-2">
//             <button
//               onClick={triggerFileInput}
//               disabled={uploading}
//               className="p-1.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//               title="Change photo"
//             >
//               <CameraIcon className="h-4 w-4" />
//             </button>

//             {user.photoURL && (
//               <button
//                 onClick={handleDeleteImage}
//                 disabled={uploading}
//                 className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
//                 title="Remove photo"
//               >
//                 <TrashIcon className="h-4 w-4" />
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Loading overlay */}
//         {uploading && (
//           <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
//             <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
//           </div>
//         )}
//       </div>

//       {/* Hidden file input */}
//       <input
//         ref={fileInputRef}
//         type="file"
//         accept="image/*"
//         onChange={handleFileSelect}
//         className="hidden"
//       />

//       {/* Error message */}
//       {error && (
//         <div className="absolute top-full left-0 mt-2 p-2 bg-red-100 border border-red-300 text-red-700 text-xs rounded-md shadow-lg z-10 whitespace-nowrap">
//           {error}
//         </div>
//       )}

//       {/* Help text */}
//       <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
//         <p>Click photo to change</p>
//         <p>Max 5MB • JPG, PNG, GIF</p>
//       </div>
//     </div>
//   );
// };

// export default ProfileImageUploader;
