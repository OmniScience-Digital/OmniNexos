// components/widgets/ImageUploadLoader.tsx
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ImageUploadLoaderProps {
  currentImage: number;
  totalImages: number;
  message?: string;
}

export default function ImageUploadLoader({ 
  currentImage, 
  totalImages, 
  message 
}: ImageUploadLoaderProps) {
  const progress = totalImages > 0 ? (currentImage / totalImages) * 100 : 0;

  return (
    <div className="fixed inset-0   flex items-center justify-center z-40">
      <Card className="w-80">
      
        
        <CardContent className="pt-6">
         
          <div className="flex flex-col items-center space-y-4">
                <p className="text-xs text-muted-foreground mt-1">
                Attaching Images to ClickUp
              </p>
            {/* Spinner */}
            <div className="relative">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium">
                  {currentImage}/{totalImages}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-center text-muted-foreground">
                {Math.round(progress)}% complete
              </p>
            </div>

            {/* Message */}
            <div className="text-center">
              <p className="text-sm font-medium">
                {message || `Uploading image ${currentImage} of ${totalImages}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Please don't close this window
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}