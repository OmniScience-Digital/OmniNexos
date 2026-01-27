// components/questions.tsx
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadData } from 'aws-amplify/storage';

// Boolean questions array 
export const booleanQuestions = [
  {
    question: "Are the engine oil and Coolant Level Acceptable?",
    value: null as boolean | null
  },
  {
    question: "Is there a full tank of Fuel prior to start?",
    value: null
  },
  {
    question: "Are the Seatbelts, Doors and Mirror's Functioning Correctly?",
    value: null
  },
  {
    question: "Is the handbrake Tested and Functional?",
    value: null
  },
  {
    question: "Are all the Tyres wear, Tread, and Pressure Acceptable?",
    value: null
  },
  {
    question: "Is there a Spare tyre, jack, Spanner (Lock Nut Adaptor if needed) on the vehicle and in good condition?",
    value: null
  },
  {
    question: "Is there a valid number plate on the Front and Back of the vehicle?",
    value: null
  },
  {
    question: "Is the License Disc Clearly Visible in the windscreen?",
    value: null
  },
  {
    question: "Is there any signs of leaks under the vehicle prior to start?",
    value: null
  },
  {
    question: "Are the headlights, Taillights, Fog Lights, indicators and hazards functioning correctly?",
    value: null
  },
  {
    question: "Are the defrosters, heaters and air conditioners functional?",
    value: null
  },
  {
    question: "Is the Emergency Kit within the Vehicle (First Aid Kit, Fire extsinguisher,Warning Triangle)?",
    value: null
  },
  {
    question: "Is the car interior and Exterior Clean?",
    value: null
  },
  {
    question: "Are there any warning Lights present on the Dash at start up?",
    value: null
  },
  {
    question: "Are the Windscreen Wipers in working condition?",
    value: null
  },
  {
    question: "Is the Service book within the vehicle?",
    value: null
  },
  {
    question: "Is there Reflectors, Buggy Whip, Strobe Light and Stop Blocks within the Vehicle?",
    value: null
  }
];

// Boolean Question Component
export const BooleanQuestion = ({ question, value, onChange }: {
  question: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-center justify-between p-3 border rounded-lg">
    <span className="text-sm flex-1">{question}</span>
    <div className="flex gap-2">
      <Button 
        type="button" 
        variant={value === true ? "default" : "outline"} 
        size="sm"
        onClick={() => onChange(true)}
      >
        Yes
      </Button>
      <Button 
        type="button" 
        variant={value === false ? "destructive" : "outline"} 
        size="sm"
        onClick={() => onChange(false)}
      >
        No
      </Button>
    </div>
  </div>
);

export interface PhotoState {
  id: string;
  file: File;
  s3Key: string;
  status: 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
  previewUrl?: string; // Add preview URL to cache
}

interface PhotoUploadProps {
  onPhotosChange: (photos: PhotoState[]) => void;
  vehicleReg: string;
  inspectionNumber: number | null;
}

// Image resizing function
const resizeImage = (file: File, maxWidth: number = 1200, maxHeight: number = 1200, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw resized image
      ctx?.drawImage(img, 0, 0, width, height);

      // Convert to blob and then to file
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Failed to resize image'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const PhotoUpload = ({ onPhotosChange, vehicleReg, inspectionNumber }: PhotoUploadProps) => {
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set()); // Track created URLs

  // Single source of truth for parent sync
  useEffect(() => {
    onPhotosChange(photos);
  }, [photos, onPhotosChange]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const generateS3Key = useCallback(( index: number): string => {
    const timestamp = Date.now();
    const cleanVehicleReg = vehicleReg.replace(/[^a-zA-Z0-9]/g, '-');
    const fileExtension = 'jpg'; // Always use jpeg after resizing
    return `inspections/${cleanVehicleReg}/${inspectionNumber}/${timestamp}-${index}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
  }, [vehicleReg, inspectionNumber]);

  const createPreviewUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.add(url);
    return url;
  }, []);

  const uploadToS3 = async (photo: PhotoState): Promise<void> => {
    try {
      const { result } = await uploadData({
        path: photo.s3Key,
        data: photo.file,
        options: {
          contentType: 'image/jpeg', // Always JPEG after resizing
        }
      });
      await result;
      
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, status: 'success' } : p
      ));
    } catch (error) {
      console.error('S3 upload failed:', error);
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { 
          ...p, 
          status: 'error', 
          error: 'Upload failed' 
        } : p
      ));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !vehicleReg) return;

    setIsUploading(true);
    
    const newFiles = Array.from(files).slice(0, 20 - photos.length);
    
    try {
      // Resize all images first
      const resizedFiles = await Promise.all(
        newFiles.map(file => resizeImage(file))
      );

      const newPhotos: PhotoState[] = resizedFiles.map((file, index) => {
        const previewUrl = createPreviewUrl(file);
        return {
          id: Math.random().toString(36).substring(2, 9),
          file,
          s3Key: generateS3Key( photos.length + index),
          status: 'uploading',
          previewUrl
        };
      });

      const updatedPhotos = [...photos, ...newPhotos];
      setPhotos(updatedPhotos);

      // Upload resized images
      await Promise.all(newPhotos.map(photo => uploadToS3(photo)));
      
    } catch (error) {
      console.error('Error processing images:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = useCallback((index: number) => {
    setPhotos(prev => {
      const photoToRemove = prev[index];
      if (photoToRemove.previewUrl) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
        previewUrlsRef.current.delete(photoToRemove.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const retryUpload = useCallback((photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (photo) {
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, status: 'uploading', error: undefined } : p
      ));
      uploadToS3(photo);
    }
  }, [photos]);

  const getUploadStatusIcon = (photo: PhotoState) => {
    switch (photo.status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const allPhotosUploaded = photos.length > 0 && photos.every(photo => photo.status === 'success');
  const hasUploadErrors = photos.some(photo => photo.status === 'error');

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
        disabled={!vehicleReg || photos.length >= 20}
      />
      
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={!vehicleReg || photos.length >= 20 || isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Uploading...' : `Upload Photos (${photos.length}/20)`}
        </Button>

        {allPhotosUploaded && (
          <div className="flex items-center text-green-600 text-sm">
            <CheckCircle className="h-4 w-4 mr-1" />
            All photos uploaded to cloud
          </div>
        )}
      </div>

      {!vehicleReg && (
        <p className="text-sm text-amber-600">
          Please select a vehicle first to upload photos
        </p>
      )}

      {photos.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-4 overflow-x-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {photos.map((photo, index) => (
              <div 
                key={photo.id} 
                className="flex-shrink-0 w-32 h-32 relative border rounded-lg p-2 bg-gray-50"
              >
                <img
                  src={photo.previewUrl}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover rounded"
                  loading="lazy" // Lazy load images
                />
                
                <div className="absolute top-1 left-1">
                  {getUploadStatusIcon(photo)}
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={() => removePhoto(index)}
                >
                  <X className="h-3 w-3" />
                </Button>

                {photo.status === 'error' && (
                  <div className="absolute bottom-1 left-1 right-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-6 text-xs bg-white"
                      onClick={() => retryUpload(photo.id)}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            {photos.length} photo(s) • {photos.filter(p => p.status === 'success').length} uploaded • 
            {photos.filter(p => p.status === 'uploading').length} uploading • 
            {photos.filter(p => p.status === 'error').length} failed
            {hasUploadErrors && " • Please fix errors before submitting"}
          </div>
        </div>
      )}
    </div>
  );
};