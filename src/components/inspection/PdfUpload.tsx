import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, CheckCircle, AlertCircle, Eye, Download, FileArchive } from "lucide-react";
import {  useEffect, useRef, useState } from "react";
import { uploadData, getUrl } from 'aws-amplify/storage';

interface PdfFile {
    id: string;
    file: File;
    status: 'uploading' | 'success' | 'error';
    s3Key: string;
    error?: string;
    url?: string; // For viewing downloaded PDFs
}

interface PdfUploadProps {
    onPdfsChange: (pdfKeys: string[]) => void;
    vehicleReg: string;
    existingPdfs?: string[]; // For editing existing fleet with PDFs
}

export const PdfUpload = ({ onPdfsChange, vehicleReg, existingPdfs = [] }: PdfUploadProps) => {
    const [pdfs, setPdfs] = useState<PdfFile[]>([]);
    const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load existing PDFs when editing
    useEffect(() => {
        if (existingPdfs.length > 0) {
            const loadExistingPdfs = async () => {
                const existingPdfFiles: PdfFile[] = await Promise.all(
                    existingPdfs.map(async (s3Key) => {
                        try {
                            const urlResult = await getUrl({ path: s3Key });
                            return {
                                id: Math.random().toString(36).substring(2, 9),
                                file: new File([], s3Key.split('/').pop() || 'document.pdf'), // Dummy file
                                status: 'success' as const,
                                s3Key,
                                url: urlResult.url.toString()
                            };
                        } catch (error) {
                            console.error('Error getting PDF URL:', error);
                            return {
                                id: Math.random().toString(36).substring(2, 9),
                                file: new File([], s3Key.split('/').pop() || 'document.pdf'),
                                status: 'error' as const,
                                s3Key,
                                error: 'Failed to load PDF'
                            };
                        }
                    })
                );
                setPdfs(existingPdfFiles);
            };
            loadExistingPdfs();
        }
    }, [existingPdfs]);

    // Sync with parent component
    useEffect(() => {
        const successfulPdfKeys = pdfs.filter(pdf => pdf.status === 'success').map(pdf => pdf.s3Key);
        onPdfsChange(successfulPdfKeys);
    }, [pdfs, onPdfsChange]);

    const generateS3Key = (file: File): string => {
        const timestamp = Date.now();
        const cleanVehicleReg = vehicleReg.replace(/[^a-zA-Z0-9]/g, '-');
        const fileExtension = file.name.split('.').pop() || 'pdf';
        return `documents/breakandlux/${cleanVehicleReg}/${timestamp}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
    };

    const uploadToS3 = async (pdf: PdfFile) => {
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
            console.error('PDF upload failed:', error);
            setPdfs(prev => prev.map(p => 
                p.id === pdf.id ? { ...p, status: 'error', error: 'Upload failed' } : p
            ));
        }
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !vehicleReg) return;

        const newPdfs: PdfFile[] = Array.from(files).map(file => ({
            id: Math.random().toString(36).substring(2, 9),
            file,
            s3Key: generateS3Key(file),
            status: 'uploading'
        }));

        setPdfs(prev => [...prev, ...newPdfs]);
        
        // Upload PDFs
        newPdfs.forEach(pdf => uploadToS3(pdf));
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removePdf = (id: string) => {
        setPdfs(prev => prev.filter(p => p.id !== id));
    };

    const viewPdf = async (pdf: PdfFile) => {
        try {
            setLoadingUrls(prev => new Set(prev).add(pdf.id));
            
            let pdfUrl = pdf.url;
            
            // If we don't have a URL yet, get one from S3
            if (!pdfUrl) {
                const urlResult = await getUrl({ path: pdf.s3Key });
                pdfUrl = urlResult.url.toString();
                
                // Update the PDF with the URL for future use
                setPdfs(prev => prev.map(p => 
                    p.id === pdf.id ? { ...p, url: pdfUrl } : p
                ));
            }
            
            // Open PDF in new tab
            window.open(pdfUrl, '_blank');
            
        } catch (error) {
            console.error('Error opening PDF:', error);
            alert('Failed to open PDF. Please try again.');
        } finally {
            setLoadingUrls(prev => {
                const newSet = new Set(prev);
                newSet.delete(pdf.id);
                return newSet;
            });
        }
    };

    const downloadPdf = async (pdf: PdfFile) => {
        try {
            setLoadingUrls(prev => new Set(prev).add(pdf.id));
            
            let pdfUrl = pdf.url;
            
            if (!pdfUrl) {
                const urlResult = await getUrl({ path: pdf.s3Key });
                pdfUrl = urlResult.url.toString();
            }
            
            // Create download link
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = pdf.file.name || 'document.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF. Please try again.');
        } finally {
            setLoadingUrls(prev => {
                const newSet = new Set(prev);
                newSet.delete(pdf.id);
                return newSet;
            });
        }
    };

    const getStatusIcon = (pdf: PdfFile) => {
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Brake & Lux Test PDFs</label>
                <span className="text-xs text-gray-500">{pdfs.filter(p => p.status === 'success').length} uploaded</span>
            </div>
            
            <input
                type="file"
                ref={fileInputRef}
                multiple
                accept=".pdf,application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
                disabled={!vehicleReg}
            />
            
            <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={!vehicleReg}
                className="w-full"
            >
                <Upload className="h-4 w-4 mr-2" />
                Upload PDF Test Reports
            </Button>

            {!vehicleReg && (
                <p className="text-sm text-amber-600">
                    Please enter vehicle registration to upload PDFs
                </p>
            )}

            {pdfs.length > 0 && (
                <div className="space-y-2">
                    {pdfs.map((pdf) => (
                        <div key={pdf.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileArchive className="h-5 w-5 text-red-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {pdf.file.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {pdf.status === 'uploading' && 'Uploading...'}
                                        {pdf.status === 'success' && 'Uploaded successfully'}
                                        {pdf.status === 'error' && `Error: ${pdf.error}`}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {getStatusIcon(pdf)}
                                
                                {pdf.status === 'success' && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => viewPdf(pdf)}
                                            disabled={loadingUrls.has(pdf.id)}
                                            className="h-8 w-8 p-0"
                                            title="View PDF"
                                        >
                                            {loadingUrls.has(pdf.id) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => downloadPdf(pdf)}
                                            disabled={loadingUrls.has(pdf.id)}
                                            className="h-8 w-8 p-0"
                                            title="Download PDF"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                                
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removePdf(pdf.id)}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};