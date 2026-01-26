// components/pdf-upload.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, X, Eye, Loader2, CheckCircle, AlertCircle, Replace } from "lucide-react";
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
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const [pdfToDelete, setPdfToDelete] = useState<{ index: number; name: string } | null>(null);
  const [opendelete, setOpendelete] = useState(false);

  // Use refs to track initialization and prevent loops
  const hasInitialized = useRef(false);
  const lastExistingFiles = useRef<string[]>(existingFiles);

  // Initialize with existing files - ONLY ONCE
  useEffect(() => {
    const existingFilesChanged = JSON.stringify(existingFiles) !== JSON.stringify(lastExistingFiles.current);

    if (!hasInitialized.current || existingFilesChanged) {
      if (existingFiles.length > 0) {
        const existingFile = existingFiles[0];
        if (existingFile) {
          const fileName = existingFile.split('/').pop() || `Brake_Lux_Test.pdf`;

          // Extract clean S3 key from URL
          let cleanS3Key = existingFile;
          if (existingFile.includes('amazonaws.com/')) {
            const urlParts = existingFile.split('amazonaws.com/');
            if (urlParts.length > 1) {
              cleanS3Key = urlParts[1].split('?')[0];
              cleanS3Key = decodeURIComponent(cleanS3Key);
            }
          }

          const existingPDF: PDFState = {
            id: `existing-0`,
            file: new File([], fileName),
            s3Key: cleanS3Key,
            status: 'success' as const,
            url: existingFile,
            name: fileName,
            size: "Unknown",
            uploadDate: new Date().toLocaleDateString()
          };

          setPdfs([existingPDF]);
          hasInitialized.current = true;
          lastExistingFiles.current = [...existingFiles];
        }
      } else {
        hasInitialized.current = true;
      }
    }
  }, [existingFiles]);

  // Sync with parent
  const lastPdfsRef = useRef<PDFState[]>([]);
  useEffect(() => {
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
        options: { contentType: 'application/pdf' }
      });
      await result;

      setPdfs(prev => prev.map(p =>
        p.id === pdf.id ? { ...p, status: 'success' } : p
      ));
    } catch (error) {
      console.error('S3 upload failed:', error);
      setPdfs(prev => prev.map(p =>
        p.id === pdf.id ? { ...p, status: 'error', error: 'Upload failed' } : p
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
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    const newFile = pdfFiles[0];
    setIsUploading(true);

    // Clean up existing file
    if (pdfs.length > 0) {
      const existingPdf = pdfs[0];
      if (existingPdf.previewUrl) {
        URL.revokeObjectURL(existingPdf.previewUrl);
        previewUrlsRef.current.delete(existingPdf.previewUrl);
      }
      // Delete existing file from S3 if it was uploaded
      if (existingPdf.status === 'success' && existingPdf.s3Key) {
        await removePDF(0); // Delete the existing file
      }
    }

    const newPDF: PDFState = {
      id: Math.random().toString(36).substring(2, 9),
      file: newFile,
      s3Key: generateS3Key(newFile),
      status: 'uploading',
      previewUrl: createPreviewUrl(newFile),
      name: newFile.name,
      size: `${(newFile.size / (1024 * 1024)).toFixed(1)} MB`,
      uploadDate: new Date().toLocaleDateString()
    };

    setPdfs([newPDF]);
    await uploadToS3(newPDF);

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
        await remove({ path: cleanS3Key });
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
    setPdfs([]);
  }, [pdfs]);

  const replacePDF = useCallback(async (index: number) => {
    const pdfToRemove = pdfs[index];

    // Clean up preview URL
    if (pdfToRemove.previewUrl) {
      URL.revokeObjectURL(pdfToRemove.previewUrl);
      previewUrlsRef.current.delete(pdfToRemove.previewUrl);
    }

    // Remove file completely
    setPdfs([]);

    // Trigger file input for new selection
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
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
      case 'uploading': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const handlePreview = (pdf: PDFState) => {
    const url = pdf.url || pdf.previewUrl;
    if (url) window.open(url, '_blank');
  };

  const triggerFileInput = () => fileInputRef.current?.click();

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

  const allPDFsUploaded = pdfs.length > 0 && pdfs.every(pdf => pdf.status === 'success');

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Brake and Lux Test Document
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              } ${pdfs.length >= 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={pdfs.length >= 1 ? undefined : triggerFileInput}
          >
            <Upload className="h-4 w-4 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium mb-1">
              {pdfs.length >= 1 ? 'Document Uploaded' : 'Upload PDF Document'}
            </p>
            <p className="text-xs text-gray-500">
              {pdfs.length >= 1 ? 'Remove current file to upload new one' : 'Drag and drop file here or click to browse'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Only PDF files are accepted • Maximum 1 file
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            multiple={false}
            className="hidden"
            disabled={!vehicleReg || pdfs.length >= 1}
          />

          {!vehicleReg && (
            <p className="text-sm text-amber-600 mt-2">
              Please enter vehicle registration first to upload PDFs
            </p>
          )}

          {/* Uploaded PDF */}
          {pdfs.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-medium">Uploaded Document</h4>

              <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <span className="text-sm font-medium truncate flex-1" title={pdfs[0].name}>
                      {pdfs[0].name.split('?')[0]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex-shrink-0">{getUploadStatusIcon(pdfs[0])}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => replacePDF(0)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-gray-500 flex-shrink-0"
                    >
                      <Replace className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(0, pdfs[0].name)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-gray-500">{pdfs[0].size}</span>
                  <span className="text-xs text-gray-500">{pdfs[0].uploadDate}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(pdfs[0])}
                    className="flex-1 h-8 text-xs"
                    disabled={pdfs[0].status === 'uploading'}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </div>

                {pdfs[0].status === 'error' && (
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-6 text-xs bg-white"
                      onClick={() => retryUpload(pdfs[0].id)}
                    >
                      Retry Upload
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 text-center">
                {pdfs[0]?.status === 'success' && 'Document uploaded to cloud'}
                {pdfs[0]?.status === 'uploading' && 'Uploading document...'}
                {pdfs[0]?.status === 'error' && 'Upload failed - Please retry'}
              </div>

              {allPDFsUploaded && (
                <div className="flex items-center justify-center text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Document uploaded to cloud
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