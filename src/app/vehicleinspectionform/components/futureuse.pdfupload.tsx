// components/pdf-upload.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, X, Eye, ChevronLeft, ChevronRight, Loader2, CheckCircle, AlertCircle, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadData, remove } from 'aws-amplify/storage';
import { ConfirmDialog } from "@/components/widgets/deletedialog";

export interface PDFState {
  id: string;
  file: File;
  s3Key: string;
  status: 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
  previewUrl?: string;
  name: string;
  size: string;
  uploadDate: string;
}

interface PDFUploadProps {
  onPDFsChange: (pdfs: PDFState[]) => void;
  vehicleReg: string;
  existingFiles?: string[];
}

export const PDFUpload = ({ onPDFsChange, vehicleReg, existingFiles = [] }: PDFUploadProps) => {
  const [pdfs, setPdfs] = useState<PDFState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const [pdfToDelete, setPdfToDelete] = useState<{ index: number; name: string } | null>(null);
  const [opendelete, setOpendelete] = useState(false);

  // Use refs to track initialization and prevent loops
  const hasInitialized = useRef(false);
  const lastExistingFiles = useRef<string[]>(existingFiles);


  // Initialize with existing files - ONLY ONCE and only when existingFiles actually changes
  useEffect(() => {
    const existingFilesChanged = JSON.stringify(existingFiles) !== JSON.stringify(lastExistingFiles.current);

    if (!hasInitialized.current || existingFilesChanged) {
      if (existingFiles.length > 0) {

        const existingPDFs: PDFState[] = existingFiles.map((url, index) => {
          const fileName = url.split('/').pop() || `Brake_Lux_Test_${index + 1}.pdf`;

          // Extract clean S3 key from URL
          let cleanS3Key = url;
          if (url.includes('amazonaws.com/')) {
            const urlParts = url.split('amazonaws.com/');
            if (urlParts.length > 1) {
              cleanS3Key = urlParts[1].split('?')[0]; // Remove query params
              cleanS3Key = decodeURIComponent(cleanS3Key);
            }
          }

          return {
            id: `existing-${index}`,
            file: new File([], fileName),
            s3Key: cleanS3Key, // Store clean S3 key here
            status: 'success' as const,
            url: url,
            name: fileName,
            size: "Unknown",
            uploadDate: new Date().toLocaleDateString()
          };
        });
        setPdfs(existingPDFs);
      } else {
        setPdfs([]);
      }

      hasInitialized.current = true;
      lastExistingFiles.current = [...existingFiles];
    }
  }, [existingFiles]);

  // Sync with parent ONLY when pdfs actually change from user actions
  const lastPdfsRef = useRef<PDFState[]>([]);

  useEffect(() => {
    // Only call onPDFsChange if pdfs actually changed and it's not the initial setup
    if (JSON.stringify(pdfs) !== JSON.stringify(lastPdfsRef.current) && hasInitialized.current) {
      onPDFsChange(pdfs);
      lastPdfsRef.current = [...pdfs];
    }
  }, [pdfs, onPDFsChange]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const generateS3Key = useCallback((file: File): string => {
    const cleanVehicleReg = vehicleReg.replace(/[^a-zA-Z0-9]/g, '-');

    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    return `documents/${cleanVehicleReg}/brake-lux-tests/${cleanFileName}`;
  }, [vehicleReg]);

  const createPreviewUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.add(url);
    return url;
  }, []);

  const uploadToS3 = async (pdf: PDFState): Promise<void> => {
    try {
      const { result } = await uploadData({
        path: pdf.s3Key,
        data: pdf.file,
        options: {
          contentType: 'application/pdf',
        }
      });
      await result;

      setPdfs(prev => prev.map(p =>
        p.id === pdf.id ? { ...p, status: 'success' } : p
      ));
    } catch (error) {
      console.error('S3 upload failed:', error);
      setPdfs(prev => prev.map(p =>
        p.id === pdf.id ? {
          ...p,
          status: 'error',
          error: 'Upload failed'
        } : p
      ));
    }
  };


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !vehicleReg) return;

    handleFiles(files);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  };


  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    handleFiles(files);
  };

  const handleFiles = async (files: FileList) => {
    const newFiles = Array.from(files).slice(0, 10 - pdfs.length);
    const pdfFiles = newFiles.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) return;

    setIsUploading(true);

    const newPDFs: PDFState[] = pdfFiles.map((file) => {
      const previewUrl = createPreviewUrl(file);
      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        s3Key: generateS3Key(file),
        status: 'uploading',
        previewUrl,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadDate: new Date().toLocaleDateString()
      };
    });

    // Add new files to the BEGINNING instead of the end
    const updatedPDFs = [...newPDFs, ...pdfs];
    setPdfs(updatedPDFs);

    // Upload PDFs
    await Promise.all(newPDFs.map(pdf => uploadToS3(pdf)));

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePDF = useCallback(async (index: number) => {
    const pdfToRemove = pdfs[index];

    // Delete from S3 if it was uploaded
    if (pdfToRemove.status === 'success' && pdfToRemove.s3Key) {
      try {

        const cleanS3Key = pdfToRemove.s3Key.split('?')[0];
        console.log('Deleting from S3 with key:', cleanS3Key);
        await remove({ path: cleanS3Key });
        console.log(`Deleted from S3: ${cleanS3Key}`);
      } catch (error) {
        console.error('S3 delete failed:', error);
      }
    }

    // Clean up preview URL
    if (pdfToRemove.previewUrl) {
      URL.revokeObjectURL(pdfToRemove.previewUrl);
      previewUrlsRef.current.delete(pdfToRemove.previewUrl);
    }

    // Remove from state
    setPdfs(prev => prev.filter((_, i) => i !== index));
  }, [pdfs]);

  const retryUpload = useCallback((pdfId: string) => {
    const pdf = pdfs.find(p => p.id === pdfId);
    if (pdf) {
      setPdfs(prev => prev.map(p =>
        p.id === pdfId ? { ...p, status: 'uploading', error: undefined } : p
      ));
      uploadToS3(pdf);
    }
  }, [pdfs]);

  const getUploadStatusIcon = (pdf: PDFState) => {
    switch (pdf.status) {
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

  const handlePreview = (pdf: PDFState) => {
    // Directly open in new tab instead of showing preview modal
    const url = pdf.url || pdf.previewUrl;
    if (url) {
      window.open(url, '_blank');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const canScrollLeft = () => {
    return (scrollContainerRef.current?.scrollLeft || 0) > 0;
  };

  const canScrollRight = () => {
    const container = scrollContainerRef.current;
    if (!container) return false;
    return container.scrollLeft < container.scrollWidth - container.clientWidth - 10;
  };

  const allPDFsUploaded = pdfs.length > 0 && pdfs.every(pdf => pdf.status === 'success');
  const hasUploadErrors = pdfs.some(pdf => pdf.status === 'error');

  const replacePDF = useCallback(async (index: number) => {
    const pdfToRemove = pdfs[index];

    // Clean up preview URL
    if (pdfToRemove.previewUrl) {
      URL.revokeObjectURL(pdfToRemove.previewUrl);
      previewUrlsRef.current.delete(pdfToRemove.previewUrl);
    }

    // Remove file from state
    setPdfs(prev => prev.filter((_, i) => i !== index));

    // Trigger file input for new selection
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  }, [pdfs]);

  const handleDeleteClick = (index: number, fileName: string) => {
    setPdfToDelete({ index, name: fileName });
    setOpendelete(true);
  };

  const handleConfirmDelete = () => {
    if (pdfToDelete) {
      removePDF(pdfToDelete.index);
      setPdfToDelete(null);
      setOpendelete(false);
    }
  };



  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Brake and Lux Test Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
          >
            <Upload className="h-4 w-4 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">
              Upload PDF documents
            </p>
            <p className="text-xs text-gray-500">
              Drag and drop files here or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Only PDF files are accepted
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            multiple
            className="hidden"
            disabled={!vehicleReg || pdfs.length >= 10}
          />

          {!vehicleReg && (
            <p className="text-sm text-amber-600 mt-2">
              Please enter vehicle registration first to upload PDFs
            </p>
          )}

          {/* Uploaded PDFs with Horizontal Scroll */}
          {pdfs.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  Uploaded Documents ({pdfs.length})
                </h4>

                {pdfs.length > 2 && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollLeft}
                      disabled={!canScrollLeft()}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={scrollRight}
                      disabled={!canScrollRight()}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Horizontal Scroll Container */}
              <div className="relative">
                <div
                  ref={scrollContainerRef}
                  className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                >
                  {pdfs.map((pdf, index) => (
                    <div
                      key={pdf.id}
                      className="flex-shrink-0 w-64 bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      {/* File Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                          <span
                            className="text-sm font-medium truncate flex-1"
                            title={pdf.name}
                          >
                            {/* Clean the filename for display */}
                            {pdf.name?.split('?')[0]?.split('/').pop() || pdf.name || 'Document'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="flex-shrink-0">
                            {getUploadStatusIcon(pdf)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => replacePDF(index)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-500 flex-shrink-0"
                          >
                            <Replace className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(index, pdf.name)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {/* File Info */}
                      <div className="flex  justify-end mb-3">

                        <span className="text-xs text-gray-500">
                          {pdf.uploadDate}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(pdf)}
                          className="flex-1 h-8 text-xs"
                          disabled={pdf.status === 'uploading'}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>

                      </div>

                      {/* Error Retry Button */}
                      {pdf.status === 'error' && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full h-6 text-xs bg-white"
                            onClick={() => retryUpload(pdf.id)}
                          >
                            Retry Upload
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Upload Status */}
              <div className="text-xs text-gray-500 text-center">
                {pdfs.length} PDF(s) • {pdfs.filter(p => p.status === 'success').length} uploaded •
                {pdfs.filter(p => p.status === 'uploading').length} uploading •
                {pdfs.filter(p => p.status === 'error').length} failed
                {hasUploadErrors && " • Please fix errors before saving"}
              </div>

              {allPDFsUploaded && (
                <div className="flex items-center justify-center text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  All PDFs uploaded to cloud
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={opendelete}
        setOpen={setOpendelete}
        handleConfirm={handleConfirmDelete}
      />

    </div>
  );
};


