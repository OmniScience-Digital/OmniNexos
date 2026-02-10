// components/file-upload.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, X, Eye, Replace, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { getUrl } from 'aws-amplify/storage';
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import ResponseModal from "@/components/widgets/response";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {type PDFState } from "@/types/schema";

interface PDFUploadProps {
  onFilesChange: (files: PDFState[]) => void;
  assetName: string;
  title: string;
  folder: string;
  existingFiles?: string[];
  onFileRemove?: (s3Key: string) => void;
}

export const FileUploadUpdate = ({ onFilesChange, assetName, title, folder, existingFiles = [], onFileRemove }: PDFUploadProps) => {
  const [pdfs, setPdfs] = useState<PDFState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const [pdfToDelete, setPdfToDelete] = useState<{ index: number; name: string } | null>(null);
  const [opendelete, setOpendelete] = useState(false);
  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  const hasInitialized = useRef(false);

  // Initialize with existing files
  useEffect(() => {
    if (!hasInitialized.current && existingFiles.length > 0) {
      const existingFile = existingFiles[0];
      if (existingFile) {
        const fileName = existingFile.split('/').pop() || `${title.replace(/\s+/g, '_')}.pdf`;
        const s3Key = existingFile;

        const existingPDF: PDFState = {
          id: `existing-0`,
          file: new File([], fileName),
          s3Key: s3Key,
          status: 'pending',
          name: fileName,
          size: "Unknown",
          uploadDate: new Date().toLocaleDateString()
        };

        setPdfs([existingPDF]);
        hasInitialized.current = true;
      }
    }
  }, [existingFiles, title]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const generateS3Key = useCallback((file: File): string => {
    //const cleanassetName = assetName.replace(/[^a-zA-Z0-9]/g, '-');
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const timestamp = Date.now();
    return `documents/${folder}/${cleanFileName}-${timestamp}`;
  }, [assetName, folder]);

  const createPreviewUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.add(url);
    return url;
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !assetName) return;
    handleFiles(files);
    setIsExpanded(true);
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
    setIsExpanded(true);
  };

  const handleFiles = (files: FileList) => {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) return;

    const newFile = pdfFiles[0];

    // Clean up existing file preview URL
    if (pdfs.length > 0 && pdfs[0].previewUrl) {
      URL.revokeObjectURL(pdfs[0].previewUrl);
      previewUrlsRef.current.delete(pdfs[0].previewUrl);
    }

    const newPDF: PDFState = {
      id: Math.random().toString(36).substring(2, 9),
      file: newFile,
      s3Key: generateS3Key(newFile),
      status: 'pending',
      previewUrl: createPreviewUrl(newFile),
      name: newFile.name,
      size: `${(newFile.size / (1024 * 1024)).toFixed(1)} MB`,
      uploadDate: new Date().toLocaleDateString()
    };

    const newPdfs = [newPDF];
    setPdfs(newPdfs);
    onFilesChange(newPdfs);
  };

  const removePDF = useCallback((index: number) => {
    const pdfToRemove = pdfs[index];

    if (pdfToRemove.previewUrl) {
      URL.revokeObjectURL(pdfToRemove.previewUrl);
      previewUrlsRef.current.delete(pdfToRemove.previewUrl);
    }

    if (pdfToRemove.s3Key && pdfToRemove.id.startsWith('existing-')) {
      onFileRemove?.(pdfToRemove.s3Key);
    }

    setPdfs([]);
    onFilesChange([]);
    setIsExpanded(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [pdfs, onFileRemove, onFilesChange]);

  const replacePDF = useCallback(() => {
    const tempFileInput = document.createElement('input');
    tempFileInput.type = 'file';
    tempFileInput.accept = '.pdf';
    tempFileInput.multiple = false;

    tempFileInput.onchange = async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const newFile = files[0];

        if (pdfs.length > 0 && pdfs[0].previewUrl) {
          URL.revokeObjectURL(pdfs[0].previewUrl);
          previewUrlsRef.current.delete(pdfs[0].previewUrl);
        }

        const newPDF: PDFState = {
          id: Math.random().toString(36).substring(2, 9),
          file: newFile,
          s3Key: generateS3Key(newFile),
          status: 'pending',
          previewUrl: createPreviewUrl(newFile),
          name: newFile.name,
          size: `${(newFile.size / (1024 * 1024)).toFixed(1)} MB`,
          uploadDate: new Date().toLocaleDateString()
        };

        const newPdfs = [newPDF];
        setPdfs(newPdfs);
        onFilesChange(newPdfs);
      }
    };

    tempFileInput.click();
  }, [pdfs, generateS3Key, createPreviewUrl, onFilesChange]);

  const handlePreview = async (pdf: PDFState) => {
    try {
      if (pdf.previewUrl) {
        window.open(pdf.previewUrl, '_blank');
      } else if (pdf.s3Key) {
        const result = await getUrl({
          path: pdf.s3Key,
          options: {
            validateObjectExistence: true
          }
        });
    
        window.open(result.url.href, '_blank');
      }
    } catch (error: any) {
      console.error('Error generating URL:', error);
      if (error?.message?.includes('NoSuchKey') || error?.message?.includes('not exist')) {
        setMessage("File not found in storage. It may have been deleted.");
        setSuccessful(false);
        setShow(true);
      }
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

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

  const hasPDF = pdfs.length > 0;
  const isExistingFile = hasPDF && pdfs[0].id.startsWith('existing-');

  return (
    <div className="space-y-3">
      <Card className="border dark:border-gray-800 shadow-sm dark:bg-gray-900">
        <CardHeader className="pb-3 px-4 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              {hasPDF && (
                <Badge 
                  variant={isExistingFile ? "secondary" : "default"} 
                  className="text-xs h-5 px-1.5 dark:bg-gray-800 dark:text-gray-300"
                >
                  {isExistingFile ? "Existing" : "New"}
                </Badge>
              )}
            </div>
            {hasPDF && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0 dark:hover:bg-gray-800"
              >
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>

        <Separator className="dark:bg-gray-800" />

        <CardContent className="px-4 py-4">
          {/* Upload Zone */}
          {!hasPDF ? (
            <div
              className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all ${
                isDragging 
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 dark:border-primary' 
                  : 'border-muted hover:border-muted-foreground/50 hover:bg-muted/30 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800/30'
              } ${!assetName ? 'opacity-50 cursor-not-allowed' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={assetName ? triggerFileInput : undefined}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${
                    isDragging 
                      ? 'bg-primary/10 dark:bg-primary/20' 
                      : 'bg-muted dark:bg-gray-800'
                  }`}>
                    <Upload className="h-4 w-4 text-muted-foreground dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium dark:text-gray-200">
                      {assetName ? "Upload PDF document" : "Enter asset name first"}
                    </p>
                    <p className="text-xs text-muted-foreground dark:text-gray-400">
                      {assetName ? "Drag & drop or click to browse" : "Asset name required"}
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant={assetName ? "default" : "outline"}
                  disabled={!assetName}
                  className="shrink-0 dark:border-gray-700 bg-[#165b8c]"
                >
                  Browse
                </Button>
              </div>
            </div>
          ) : (
            // File Display
            <div className="space-y-4">
              {/* File Card */}
              <div className="border rounded-lg p-3 bg-card dark:bg-gray-800 dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5 dark:text-red-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate dark:text-gray-200" title={pdfs[0].name}>
                          {pdfs[0].name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-gray-400">
                        <span>{pdfs[0].size}</span>
                        <span>•</span>
                        <span>{pdfs[0].uploadDate}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(pdfs[0])}
                      className="h-7 w-7 p-0 dark:hover:bg-gray-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => replacePDF()}
                      className="h-7 w-7 p-0 dark:hover:bg-gray-700"
                    >
                      <Replace className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(0, pdfs[0].name)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-gray-700"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expandable Section with Separator */}
              {isExpanded && (
                <>
                  <Separator className="dark:bg-gray-800" />
                  <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md dark:bg-gray-800 dark:text-gray-400">
                      {isExistingFile
                        ? 'This is an existing document. Replace it to upload a new version.'
                        : 'Document ready for upload. Click Save to upload.'
                      }
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(pdfs[0])}
                        className="text-xs h-8 flex-1 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Eye className="h-3 w-3 mr-1.5" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => replacePDF()}
                        className="text-xs h-8 flex-1 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Replace className="h-3 w-3 mr-1.5" />
                        Replace
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(0, pdfs[0].name)}
                        className="text-xs h-8 flex-1 text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/40 dark:border-red-900/30 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                      >
                        <X className="h-3 w-3 mr-1.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            multiple={false}
            className="hidden"
            disabled={!assetName || hasPDF}
          />

          {/* Asset name warning */}
          {!assetName && !hasPDF && (
            <div className="mt-3">
              <Separator className="mb-3 dark:bg-gray-800" />
              <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span className="text-xs">⚠️</span>
                <span>Please enter asset name first to upload PDFs</span>
              </div>
            </div>
          )}

          {/* Response Modal */}
          {show && (
            <ResponseModal
              successful={successful}
              message={message}
              setShow={setShow}
            />
          )}
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={opendelete}
        setOpen={setOpendelete}
        handleConfirm={handleConfirmDelete}
      />
    </div>
  );
};



