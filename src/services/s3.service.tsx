import {type PDFState } from "@/types/schema";
import { uploadData } from "aws-amplify/storage"


export const handleUpload = async (fileState: PDFState): Promise<string> => {
    try {
        console.log('Uploading file to:', fileState.s3Key);
        
         await uploadData({
            path: fileState.s3Key,
            data: fileState.file,
            options: {
                contentType: 'application/pdf'
            }
        }).result;
        
        console.log('File uploaded successfully:', fileState.s3Key);
        return fileState.s3Key;
    } catch (error) {
        console.error('Error uploading file to S3:', error);
        throw new Error(`Failed to upload file: ${error}`);
    }
};