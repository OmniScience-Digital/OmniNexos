export type SignInFlow = 'signIn' | 'signUp' | 'forgotPassword' | 'resetPassword'; //union type


export interface PDFState {
  id: string;
  file: File;
  s3Key: string;
  status: 'pending'; 
  previewUrl?: string;
  name: string;
  size: string;
  uploadDate: string;
}