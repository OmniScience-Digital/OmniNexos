// components/file-upload.tsx
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, FileText, X, Eye, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import { type PDFState } from "@/types/schema";
import { getUrl } from "@aws-amplify/storage";
import ResponseModal from "@/components/widgets/response";

interface PDFUploadProps {
  onFilesChange: (files: PDFState[]) => void;
  assetName: string;
  title: string;
  folder: string;
}

export const FileUpload = ({ onFilesChange, assetName, title, folder }: PDFUploadProps) => {
  const [pdfs, setPdfs] = useState<PDFState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const [pdfToDelete, setPdfToDelete] = useState<{ index: number; name: string } | null>(null);
  const [opendelete, setOpendelete] = useState(false);
  const [show, setShow] = useState(false);
  const [successful] = useState(false);
  const [message] = useState("");

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const generateS3Key = useCallback((file: File): string => {
    const cleanassetName = assetName.replace(/[^a-zA-Z0-9]/g, '-');
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const timestamp = Date.now();
    return `documents/${folder}/${cleanassetName}/${cleanFileName}-${timestamp}`;
  }, [assetName]);

  const createPreviewUrl = useCallback((file: File): string => {
    const url = URL.createObjectURL(file);
    previewUrlsRef.current.add(url);
    return url;
  }, []);

  // Sync files with parent
  useEffect(() => {
    onFilesChange(pdfs);
  }, [pdfs, onFilesChange]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !assetName) return;
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

    setPdfs([newPDF]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePDF = useCallback((index: number) => {
    const pdfToRemove = pdfs[index];

    // Clean up preview URL
    if (pdfToRemove.previewUrl) {
      URL.revokeObjectURL(pdfToRemove.previewUrl);
      previewUrlsRef.current.delete(pdfToRemove.previewUrl);
    }

    // Remove from state
    setPdfs([]);
  }, [pdfs]);

  const replacePDF = useCallback((index: number) => {
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

   const handlePreview = (pdf: PDFState) => {
    const url = pdf.previewUrl;
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

  const hasPDF = pdfs.length > 0;

  return (
    <div className="space-y-3">
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 px-4 pt-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {/* Upload Zone - More Compact */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              } ${hasPDF ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={hasPDF ? undefined : triggerFileInput}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">
                    {hasPDF ? 'Document Ready' : 'Upload PDF'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {hasPDF ? 'Ready to upload' : 'Drag & drop or click'}
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="shrink-0"
                disabled={hasPDF || !assetName}
              >
                Browse
              </Button>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            multiple={false}
            className="hidden"
            disabled={!assetName || hasPDF}
          />

          {!assetName && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              ⚠️ Please enter asset name first
            </p>
          )}

          {/* Selected PDF - More Compact */}
          {hasPDF && (
            <div className="mt-3 space-y-2">
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={pdfs[0].name}>
                        {pdfs[0].name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
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
                      className="h-6 w-6 p-0"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => replacePDF(0)}
                      className="h-6 w-6 p-0"
                    >
                      <Replace className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(0, pdfs[0].name)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(pdfs[0])}
                    className="flex-1 h-7 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Ready - uploads when you click Save
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={opendelete}
        setOpen={setOpendelete}
        handleConfirm={handleConfirmDelete}
      />
      {show && (
        <ResponseModal
          successful={successful}
          message={message}
          setShow={setShow}
        />
      )}
    </div>
  );
};

export const FileUploadMany = ({ onFilesChange, assetName, title, folder }: PDFUploadProps) => {
  const [pdfs, setPdfs] = useState<PDFState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  const [pdfToDelete, setPdfToDelete] = useState<{ index: number; name: string } | null>(null);
  const [opendelete, setOpendelete] = useState(false);

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

    const newPdfs: PDFState[] = [newPDF];
    setPdfs(newPdfs);
    onFilesChange(newPdfs);
  };

  const removePDF = useCallback((index: number) => {
    const pdfToRemove = pdfs[index];

    // Clean up preview URL
    if (pdfToRemove.previewUrl) {
      URL.revokeObjectURL(pdfToRemove.previewUrl);
      previewUrlsRef.current.delete(pdfToRemove.previewUrl);
    }

    // Remove from state and notify parent
    const newPdfs: PDFState[] = [];
    setPdfs(newPdfs);
    onFilesChange(newPdfs);
  }, [pdfs, onFilesChange]);

  const replacePDF = useCallback((index: number) => {
    const pdfToRemove = pdfs[index];

    // Clean up preview URL
    if (pdfToRemove.previewUrl) {
      URL.revokeObjectURL(pdfToRemove.previewUrl);
      previewUrlsRef.current.delete(pdfToRemove.previewUrl);
    }

    // Remove file completely
    const newPdfs: PDFState[] = [];
    setPdfs(newPdfs);
    onFilesChange(newPdfs);

    // Trigger file input for new selection
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  }, [pdfs, onFilesChange]);

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

  const hasPDF = pdfs.length > 0;

  return (
    <div className="space-y-3">
      <Card className="border shadow-sm">
        <CardHeader className="pb-3 px-4 pt-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {/* Upload Zone - More Compact */}
          <div
            className={`border-2 border-dashed rounded-lg p-4 transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              } ${hasPDF ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={hasPDF ? undefined : triggerFileInput}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">
                    {hasPDF ? 'Document Ready' : 'Upload PDF'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {hasPDF ? 'Ready to upload' : 'Drag & drop or click'}
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="shrink-0"
                disabled={hasPDF || !assetName}
              >
                Browse
              </Button>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf"
            multiple={false}
            className="hidden"
            disabled={!assetName || hasPDF}
          />

          {!assetName && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              ⚠️ Please enter asset name first
            </p>
          )}

          {/* Selected PDF - More Compact */}
          {hasPDF && (
            <div className="mt-3 space-y-2">
              <div className="bg-gray-50 border rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <FileText className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={pdfs[0].name}>
                        {pdfs[0].name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
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
                      className="h-6 w-6 p-0"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => replacePDF(0)}
                      className="h-6 w-6 p-0"
                    >
                      <Replace className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(0, pdfs[0].name)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(pdfs[0])}
                    className="flex-1 h-7 text-xs"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Ready - uploads when you click Save
              </p>
            </div>
          )}
        </CardContent>
        {show && (
          <ResponseModal
            successful={successful}
            message={message}
            setShow={setShow}
          />
        )}
      </Card>
      <ConfirmDialog
        open={opendelete}
        setOpen={setOpendelete}
        handleConfirm={handleConfirmDelete}
      />
    </div>
  );
};