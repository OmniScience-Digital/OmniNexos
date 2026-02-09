// components/inspection-image-viewer.tsx
"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface InspectionImageViewerProps {
    images: string[];
    isOpen: boolean;
    onClose: () => void;
    initialIndex?: number;
}

export const InspectionImageViewer = ({
    images,
    isOpen,
    onClose,
    initialIndex = 0
}: InspectionImageViewerProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
        }
    }, [isOpen, initialIndex]);

    const currentImage = images[currentIndex];
    const canGoPrevious = currentIndex > 0;
    const canGoNext = currentIndex < images.length - 1;

    const handlePrevious = () => {
        if (canGoPrevious) {
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleNext = () => {
        if (canGoNext) {
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(currentImage);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inspection-image-${currentIndex + 1}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading image:', error);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-full h-[80vh] p-4 bg-white flex flex-col">
                <DialogTitle className="sr-only">Image Viewer</DialogTitle>

                {/* Header - fixed height, no overlap */}
                <div className="flex items-center justify-between mb-4 h-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X className="h-5 w-5" />
                        </Button>
                        <span className="text-sm text-gray-600">
                            {currentIndex + 1} of {images.length}
                        </span>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleDownload} className="mt-15">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                    </Button>
                </div>

                {/* Image container */}
                <div className="flex-1 relative flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden min-h-0">
                    {/* Navigation arrows */}
                    {canGoPrevious && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white border z-10"
                            onClick={handlePrevious}
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                    )}

                    {canGoNext && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white border z-10"
                            onClick={handleNext}
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    )}

                    {/* Image wrapper */}
                    <div className="w-full h-full flex items-center justify-center p-2">
                        <img
                            src={currentImage}
                            alt={`Inspection image ${currentIndex + 1}`}
                            className="max-w-full max-h-full object-contain"
                        />
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
};