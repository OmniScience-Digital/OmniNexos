// components/inspection-image-gallery.tsx
"use client";

import { ImageIcon, Eye, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface InspectionImageGalleryProps {
    images: string[];
    onImageClick: (imageUrl: string, allImages: string[]) => void;
    title?: string;
}

// Global cache to prevent re-renders
const imageCache = new Map<string, { loaded: boolean; error: boolean }>();

export const InspectionImageGallery = ({ 
    images, 
    onImageClick,
    title = "Inspection Photos"
}: InspectionImageGalleryProps) => {
    const [loadedStates, setLoadedStates] = useState<Map<string, boolean>>(new Map());
    const [errorStates, setErrorStates] = useState<Map<string, boolean>>(new Map());
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Initialize cache for new images
    useEffect(() => {
        images.forEach(imageUrl => {
            if (!imageCache.has(imageUrl)) {
                imageCache.set(imageUrl, { loaded: false, error: false });
            }
        });
    }, [images]);

    const handleImageLoad = (imageUrl: string) => {
        imageCache.set(imageUrl, { loaded: true, error: false });
        setLoadedStates(prev => new Map(prev).set(imageUrl, true));
        setErrorStates(prev => new Map(prev).set(imageUrl, false));
    };

    const handleImageError = (imageUrl: string) => {
        imageCache.set(imageUrl, { loaded: true, error: true });
        setLoadedStates(prev => new Map(prev).set(imageUrl, true));
        setErrorStates(prev => new Map(prev).set(imageUrl, true));
    };

    const isImageLoaded = (imageUrl: string) => {
        return imageCache.get(imageUrl)?.loaded || loadedStates.get(imageUrl) || false;
    };

    const hasImageError = (imageUrl: string) => {
        return imageCache.get(imageUrl)?.error || errorStates.get(imageUrl) || false;
    };

    if (!images || images.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-sm font-medium">No photos available</p>
                <p className="text-gray-400 text-xs mt-1 max-w-md mx-auto">
                    Photos will appear here once they are uploaded during the inspection process
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    {title}
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {images.length} photo{images.length !== 1 ? 's' : ''}
                </span>
            </div>
            
            {/* Horizontal scrollable image gallery */}
            <div 
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto pb-4 px-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
            >
                {images.map((imageUrl, index) => {
                    const isLoaded = isImageLoaded(imageUrl);
                    const hasError = hasImageError(imageUrl);
                    
                    return (
                        <div 
                            key={`${imageUrl}-${index}`} 
                            className="flex-shrink-0 relative group cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                            onClick={() => onImageClick(imageUrl, images)}
                        >
                            <div className="w-36 h-36 border-2 border-gray-200 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm">
                                {/* Loading skeleton - only show while loading */}
                                {!isLoaded && !hasError && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                                        <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
                                    </div>
                                )}
                                
                                {/* Actual image - always render but control visibility */}
                                <img
                                    src={imageUrl}
                                    alt={`Inspection photo ${index + 1}`}
                                    className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-105 ${
                                        isLoaded && !hasError 
                                            ? 'opacity-100 scale-100' 
                                            : 'opacity-0 scale-95'
                                    }`}
                                    onLoad={() => handleImageLoad(imageUrl)}
                                    onError={() => handleImageError(imageUrl)}
                                    loading="eager" // Change to eager to prevent lazy loading issues
                                    decoding="async"
                                    style={{ 
                                        display: isLoaded && !hasError ? 'block' : 'none'
                                    }}
                                />
                                
                                {/* Error fallback */}
                                {hasError && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 bg-gray-100">
                                        <ImageIcon className="h-8 w-8 text-gray-400 mb-1" />
                                        <span className="text-xs text-gray-500 text-center">Failed to load</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Hover overlay - only show when image is loaded and no error */}
                            {isLoaded && !hasError && (
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all rounded-xl flex items-center justify-center">
                                    <div className="bg-black/80 text-white px-3 py-2 rounded-lg transform translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-2">
                                        <Eye className="h-4 w-4" />
                                        <span className="text-sm font-medium">View</span>
                                    </div>
                                </div>
                            )}
                            
                            {/* Image number badge - always show */}
                            <div className="absolute top-3 left-3 bg-black/80 text-white text-xs font-medium px-2.5 py-1 rounded-full z-10">
                                {index + 1}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                    <Eye className="h-4 w-4 flex-shrink-0" />
                    <span>Click on any image to open the full-screen viewer with zoom, pan, and download functionality</span>
                </p>
            </div>
        </div>
    );
};