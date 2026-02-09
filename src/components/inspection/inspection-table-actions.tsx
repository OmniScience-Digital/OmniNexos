// components/inspection-table-actions.tsx
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InspectionTableActionsProps {
    images: string[];
    onViewImages: (images: string[]) => void;
    inspectionNumber: number;
}

export const InspectionTableActions = ({ 
    images, 
    onViewImages, 
}: InspectionTableActionsProps) => {
    const hasImages = images && images.length > 0;

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewImages(images)}
            disabled={!hasImages}
            className="h-8 text-xs"
        >
            <ImageIcon className="h-4 w-4 mr-1" />
            {hasImages ? `View (${images.length})` : 'No images'}
        </Button>
    );
};