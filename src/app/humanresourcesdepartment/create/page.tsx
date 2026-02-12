"use client";

import { client } from "@/services/schema";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft, User, Loader2, FileText, BriefcaseMedical } from "lucide-react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDateForAmplify } from "@/utils/helper/time";
import {type Employee, MEDICAL_CERTIFICATE_TYPES, TRAINING_CERTIFICATE_TYPES } from "@/types/hrd.types";
import ResponseModal from "@/components/widgets/response";
import {type  PDFState } from "@/types/schema";
import { remove } from "@aws-amplify/storage";
import { FileUploadUpdate } from "@/components/widgets/fileupdate";
import { handleUpload } from "@/services/s3.service";
import { getInitials } from "@/components/widgets/getinitials";


export default function CreateEmployeePage() {
    const navigate = useNavigate();

    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState<Partial<Employee>>({
        authorizedDriver: false
    });

    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");

    const [medicalCerts, setMedicalCerts] = useState<any[]>(() =>
        MEDICAL_CERTIFICATE_TYPES.map(type => ({
            certificateType: type,
            expiryDate: "",
            attachment: ""
        }))
    );

    const [trainingCerts, setTrainingCerts] = useState<any[]>(() =>
        TRAINING_CERTIFICATE_TYPES.map(type => ({
            certificateType: type,
            expiryDate: "",
            attachment: ""
        }))
    );

    // Store full PDFState objects, not just s3Key strings
    const [documentFiles, setDocumentFiles] = useState<Record<string, PDFState>>({});
    const [medicalFiles, setMedicalFiles] = useState<PDFState[]>([]);
    const [trainingFiles, setTrainingFiles] = useState<PDFState[]>([]);

    const handleInputChange = (field: keyof Employee, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleMedicalCertChange = (index: number, field: string, value: string) => {
        const updated = [...medicalCerts];
        updated[index] = { ...updated[index], [field]: value };
        setMedicalCerts(updated);
    };

    const handleTrainingCertChange = (index: number, field: string, value: string) => {
        const updated = [...trainingCerts];
        updated[index] = { ...updated[index], [field]: value };
        setTrainingCerts(updated);
    };



// Update your handlers to store full PDFState objects:
const handleDocumentFileChange = (field: keyof Employee) => (files: PDFState[]) => {
  if (files[0]) {
    // Store the full PDFState object
    setDocumentFiles(prev => ({ ...prev, [field]: files[0] }));
    
    // Also store the s3Key in formData for display
    const url = files[0]?.s3Key || '';
    setFormData(prev => ({ ...prev, [field]: url }));
  }
};

const handleMedicalFileChange = (index: number) => (files: PDFState[]) => {
  if (files[0]) {
    // Update medicalFiles array with full PDFState object
    const updated = [...medicalFiles];
    updated[index] = files[0];
    setMedicalFiles(updated);
    
    // Also update medicalCerts with s3Key
    const updatedCerts = [...medicalCerts];
    updatedCerts[index] = {
      ...updatedCerts[index],
      attachment: files[0]?.s3Key || ""
    };
    setMedicalCerts(updatedCerts);
  }
};

const handleTrainingFileChange = (index: number) => (files: PDFState[]) => {
  if (files[0]) {
    // Update trainingFiles array with full PDFState object
    const updated = [...trainingFiles];
    updated[index] = files[0];
    setTrainingFiles(updated);
    
    // Also update trainingCerts with s3Key
    const updatedCerts = [...trainingCerts];
    updatedCerts[index] = {
      ...updatedCerts[index],
      attachment: files[0]?.s3Key || ""
    };
    setTrainingCerts(updatedCerts);
  }
};
    // Generic handler for file removal
    const handleDocumentFileRemove = (field: keyof Employee) => async (s3Key: string) => {
        if (s3Key) {
            try {
                await remove({ path: s3Key });
                setFormData(prev => ({ ...prev, [field]: '' }));

                setMessage(`File removed successfully`);
                setSuccessful(true);
                setShow(true);
            } catch (error) {
                console.error(`Failed to delete file: ${s3Key}`, error);
                setMessage("Error deleting file");
                setSuccessful(false);
                setShow(true);
            }
        }
    };

    const validateForm = (): boolean => {
        if (!formData.employeeId?.trim()) {

            setMessage("Employee ID is required!");
            setShow(true);
            setSuccessful(false);
            return false;
        }
        if (!formData.firstName?.trim()) {

            setMessage("First name is required!");
            setShow(true);
            setSuccessful(false);
            return false;
        }
        if (!formData.surname?.trim()) {

            setMessage("Surname is required!");
            setShow(true);
            setSuccessful(false);
            return false;
        }
        return true;
    };


const handleSave = async () => {
  try {
    if (!validateForm()) {
      return;
    }

    setSaving(true);

    const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";
    const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
    const historyEntries = `Hrd Dashboard: ${storedName} created new employee at ${johannesburgTime}.\n`;
    
    const employeeId = formData.employeeId!;

    // ==============================================
    // 1. UPLOAD ALL MAIN DOCUMENT FILES
    // ==============================================
    const s3KeyMap: Record<string, string> = {};
    
    // Upload main document files
    const mainUploadPromises = Object.entries(documentFiles).map(async ([field, pdfState]) => {
      if (pdfState && pdfState.file) {
        const key = await handleUpload(pdfState);
        s3KeyMap[field] = key;
      }
    });

    await Promise.all(mainUploadPromises);

    // ==============================================
    // 2. UPLOAD MEDICAL CERTIFICATE FILES
    // ==============================================
    const medicalKeys: string[] = [];
    for (let i = 0; i < medicalFiles.length; i++) {
      const pdfState = medicalFiles[i];
      if (pdfState && pdfState.file) {
        const key = await handleUpload(pdfState);
        medicalKeys[i] = key;
      }
    }

    // ==============================================
    // 3. UPLOAD TRAINING CERTIFICATE FILES
    // ==============================================
    const trainingKeys: string[] = [];
    for (let i = 0; i < trainingFiles.length; i++) {
      const pdfState = trainingFiles[i];
      if (pdfState && pdfState.file) {
        const key = await handleUpload(pdfState);
        trainingKeys[i] = key;
      }
    }

    // ==============================================
    // 4. VALIDATE CERTIFICATES WITH ATTACHMENTS
    // ==============================================
    let hasValidationError = false;
    let errorCertName = "";
    let errorCertType = "";

    // Validate medical certificates
    for (let i = 0; i < medicalCerts.length; i++) {
      const cert = medicalCerts[i];
      if ((medicalKeys[i] || cert.attachment) && !cert.expiryDate) {
        hasValidationError = true;
        errorCertName = cert.certificateType;
        errorCertType = "Medical";
        break;
      }
    }

    // Validate training certificates
    if (!hasValidationError) {
      for (let i = 0; i < trainingCerts.length; i++) {
        const cert = trainingCerts[i];
        if ((trainingKeys[i] || cert.attachment) && !cert.expiryDate) {
          hasValidationError = true;
          errorCertName = cert.certificateType;
          errorCertType = "Training";
          break;
        }
      }
    }

    if (hasValidationError) {
      setMessage(`${errorCertType} Certificate "${errorCertName}" requires an expiry date since it has an attachment`);
      setShow(true);
      setSuccessful(false);
      setSaving(false);
      return;
    }

    // ==============================================
    // 5. CREATE EMPLOYEE RECORD WITH ACTUAL S3 KEYS
    // ==============================================
    const employeeData = {
      employeeId: formData.employeeId!,
      firstName: formData.firstName!,
      surname: formData.surname!,
      employeeNumber: formData.employeeNumber || null,
      knownAs: formData.knownAs || null,
      passportNumber: formData.passportNumber || null,
      passportExpiry: formatDateForAmplify(formData.passportExpiry),
      passportAttachment: s3KeyMap.passportAttachment || null,
      driversLicenseCode: formData.driversLicenseCode || null,
      driversLicenseExpiry: formatDateForAmplify(formData.driversLicenseExpiry),
      driversLicenseAttachment: s3KeyMap.driversLicenseAttachment || null,
      authorizedDriver: formData.authorizedDriver!,
      pdpExpiry: formatDateForAmplify(formData.pdpExpiry),
      pdpAttachment: s3KeyMap.pdpAttachment || null,
      cvAttachment: s3KeyMap.cvAttachment || null,
      ppeListAttachment: s3KeyMap.ppeListAttachment || null,
      ppeExpiry: formatDateForAmplify(formData.ppeExpiry),
      employeeIdAttachment: s3KeyMap.employeeIdAttachment || null,
    };

    const newEmployee = await client.models.Employee.create(employeeData);

    if (!newEmployee.errors) {
      // ==============================================
      // 6. CREATE MEDICAL CERTIFICATES
      // ==============================================
      for (let i = 0; i < medicalCerts.length; i++) {
        const cert = medicalCerts[i];
        if (cert.certificateType) {
          await client.models.EmployeeMedicalCertificate.create({
            employeeId: employeeId,
            certificateType: cert.certificateType,
            expiryDate: formatDateForAmplify(cert.expiryDate) || "",
            attachment: medicalKeys[i] || null
          });
        }
      }

      // ==============================================
      // 7. CREATE TRAINING CERTIFICATES
      // ==============================================
      for (let i = 0; i < trainingCerts.length; i++) {
        const cert = trainingCerts[i];
        if (cert.certificateType) {
          await client.models.EmployeeTrainingCertificate.create({
            employeeId: employeeId,
            certificateType: cert.certificateType,
            expiryDate: formatDateForAmplify(cert.expiryDate) || "",
            attachment: trainingKeys[i] || null
          });
        }
      }

      // ==============================================
      // 8. ADD HISTORY TABLE ENTRY
      // ==============================================
      await client.models.History.create({
        entityType: "EMPLOYEE",
        entityId: employeeId,
        action: "CREATE",
        timestamp: new Date().toISOString(),
        details: historyEntries
      });
      
      setMessage("Employee created successfully!");
      setShow(true);
      setSuccessful(true);
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/humanresourcesdepartment');
      }, 1500);

    } else {
      setMessage("Failed to create employee!");
      setShow(true);
      setSuccessful(false);
    }

  } catch (error: any) {
    console.error("Error saving employee:", error);
    const errorMessage = error.message || "Error creating employee. Please check the console for details.";
    setMessage(errorMessage);
    setShow(true);
    setSuccessful(false);
  } finally {
    setSaving(false);
  }
};

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Navbar />

            <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
                <div className="container mx-auto max-w-6xl mt-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-6">

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/humanresourcesdepartment')}
                                className="h-9 w-9 p-0 relative hover:scale-105 active:scale-95 transition-transform duration-150">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold">
                                    Add New Employee
                                </h1>
                                <p className="text-muted-foreground mt-2 text-base">
                                    Create a new employee profile
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Sidebar */}
                        <div className="lg:col-span-1">
                            <Card className="sticky top-24">
                                <CardContent className="p-6">
                                    <div className="text-center mb-6">
                                        <Avatar className="h-24 w-24 border-4 border-white shadow-lg mx-auto mb-4">
                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold">
                                                {formData.firstName && formData.surname
                                                    ? getInitials(formData.firstName, formData.surname)
                                                    : <User className="h-6 w-6" />
                                                }
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-center">
                                            <h3 className="font-semibold">
                                                {formData.firstName || 'First'} {formData.surname || 'Last'}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {formData.employeeId || 'EMP ID'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <Label>Employee Status</Label>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-sm">Active Employee</span>
                                                <Switch defaultChecked />
                                            </div>
                                        </div>

                                        <div>
                                            <Label>Driver Status</Label>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-sm">Authorized Driver</span>
                                                <Switch
                                                    checked={formData.authorizedDriver || false}
                                                    onCheckedChange={(checked) => handleInputChange('authorizedDriver', checked)}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4">
                                            <Label className="mb-2 block">Document Summary</Label>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span>Medical Certs:</span>
                                                    <Badge variant={medicalCerts.length > 0 ? "default" : "secondary"}>
                                                        {medicalCerts.length}
                                                    </Badge>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Training Certs:</span>
                                                    <Badge variant={trainingCerts.length > 0 ? "default" : "secondary"}>
                                                        {trainingCerts.length}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Main Form */}
                        <div className="lg:col-span-3">

                            <Tabs defaultValue="personal" className="space-y-6">

                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="personal" className="cursor-pointer">Basic</TabsTrigger>
                                    <TabsTrigger value="medical" className="cursor-pointer">Medical / Induction</TabsTrigger>
                                    <TabsTrigger value="training" className="cursor-pointer">Training / Certification</TabsTrigger>

                                </TabsList>

                                {/* Personal Information Tab */}
                                <TabsContent value="personal">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <User className="h-5 w-5" />
                                                Basic Information
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div>
                                                        <Label>Employee ID *</Label>
                                                        <Input
                                                            value={formData.employeeId || ''}
                                                            onChange={(e) => handleInputChange('employeeId', e.target.value)}
                                                            placeholder="1234567890123"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label>First Name *</Label>
                                                        <Input
                                                            value={formData.firstName || ''}
                                                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                                                            placeholder="John"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label>Surname *</Label>
                                                        <Input
                                                            value={formData.surname || ''}
                                                            onChange={(e) => handleInputChange('surname', e.target.value)}
                                                            placeholder="Doe"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label>Known As</Label>
                                                        <Input
                                                            value={formData.knownAs || ''}
                                                            onChange={(e) => handleInputChange('knownAs', e.target.value)}
                                                            placeholder="Johnny"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div>
                                                        <Label>Employee Number</Label>
                                                        <Input
                                                            value={formData.employeeNumber || ''}
                                                            onChange={(e) => handleInputChange('employeeNumber', e.target.value)}
                                                            placeholder="001"
                                                        />
                                                    </div>

                                                    <div>
                                                        <Label>Employee ID Attachment</Label>
                                                        <FileUploadUpdate
                                                            assetName="employee-id"
                                                            title="Employee ID Attachment"
                                                            folder="ID"
                                                            existingFiles={formData.employeeIdAttachment ? [formData.employeeIdAttachment] : []}
                                                            onFilesChange={handleDocumentFileChange('employeeIdAttachment')}
                                                            onFileRemove={handleDocumentFileRemove('employeeIdAttachment')}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Passport Section */}
                                                <div>
                                                    <div className="space-y-4">
                                                        <h4 className="font-semibold border-b">Passport Details</h4>
                                                        <div>
                                                            <Label>Passport Number</Label>
                                                            <Input
                                                                value={formData.passportNumber || ''}
                                                                onChange={(e) => handleInputChange('passportNumber', e.target.value)}
                                                                placeholder="A12345678"
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label>Passport Expiry</Label>
                                                            <Input
                                                                type="date"
                                                                value={formData.passportExpiry || ''}
                                                                onChange={(e) => handleInputChange('passportExpiry', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div>
                                                            <Label>Passport Attachment</Label>
                                                            <FileUploadUpdate
                                                                assetName="passport"
                                                                title="Passport Attachment"
                                                                folder="Passport"
                                                                existingFiles={formData.passportAttachment ? [formData.passportAttachment] : []}
                                                                onFilesChange={handleDocumentFileChange('passportAttachment')}
                                                                onFileRemove={handleDocumentFileRemove('passportAttachment')}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Driver's License Section */}
                                                <div>
                                                    <div className="space-y-4">
                                                        <h4 className="font-semibold border-b">Driver's License</h4>
                                                        <div>
                                                            <Label>License Code</Label>
                                                            <Input
                                                                value={formData.driversLicenseCode || ''}
                                                                onChange={(e) => handleInputChange('driversLicenseCode', e.target.value)}
                                                                placeholder="Code 10, etc."
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label>License Expiry</Label>
                                                            <Input
                                                                type="date"
                                                                value={formData.driversLicenseExpiry || ''}
                                                                onChange={(e) => handleInputChange('driversLicenseExpiry', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div>
                                                            <Label>Driver's License Attachment</Label>
                                                            <FileUploadUpdate
                                                                assetName="drivers-license"
                                                                title="Driver's License Attachment"
                                                                folder="License"
                                                                existingFiles={formData.driversLicenseAttachment ? [formData.driversLicenseAttachment] : []}
                                                                onFilesChange={handleDocumentFileChange('driversLicenseAttachment')}
                                                                onFileRemove={handleDocumentFileRemove('driversLicenseAttachment')}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PDP and CV Documents */}
                                                <div>
                                                    <div className="space-y-4">
                                                        <h4 className="font-semibold border-b">PDP</h4>
                                                        <div>
                                                            <Label>PDP Expiry</Label>
                                                            <Input
                                                                type="date"
                                                                value={formData.pdpExpiry || ''}
                                                                onChange={(e) => handleInputChange('pdpExpiry', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label>PDP Attachment</Label>
                                                            <FileUploadUpdate
                                                                assetName="pdp"
                                                                title="PDP Attachment"
                                                                folder="PDP"
                                                                existingFiles={formData.pdpAttachment ? [formData.pdpAttachment] : []}
                                                                onFilesChange={handleDocumentFileChange('pdpAttachment')}
                                                                onFileRemove={handleDocumentFileRemove('pdpAttachment')}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4 mt-4">
                                                        <h4 className="font-semibold border-b">Curriculum Vitae</h4>
                                                        <div>
                                                            <Label>CV Attachment</Label>
                                                            <FileUploadUpdate
                                                                assetName="cv"
                                                                title="CV Attachment"
                                                                folder="CV"
                                                                existingFiles={formData.cvAttachment ? [formData.cvAttachment] : []}
                                                                onFilesChange={handleDocumentFileChange('cvAttachment')}
                                                                onFileRemove={handleDocumentFileRemove('cvAttachment')}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* PPE Documents */}
                                                <div>
                                                    <div className="space-y-4">
                                                        <h4 className="font-semibold border-b">PPE</h4>
                                                        <div>
                                                            <Label>PPE Expiry</Label>
                                                            <Input
                                                                type="date"
                                                                value={formData.ppeExpiry || ''}
                                                                onChange={(e) => handleInputChange('ppeExpiry', e.target.value)}
                                                            />
                                                        </div>

                                                        <div>
                                                            <Label>PPE List Attachment</Label>
                                                            <FileUploadUpdate
                                                                assetName="ppe-list"
                                                                title="PPE List Attachment"
                                                                folder="PPE"
                                                                existingFiles={formData.ppeListAttachment ? [formData.ppeListAttachment] : []}
                                                                onFilesChange={handleDocumentFileChange('ppeListAttachment')}
                                                                onFileRemove={handleDocumentFileRemove('ppeListAttachment')}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Medical Induction Tab */}
                                <TabsContent value="medical">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <BriefcaseMedical className="h-5 w-5" />
                                                Medical Documents
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="space-y-6">
                                                {medicalCerts.map((cert, index) => (
                                                    <div key={cert.certificateType} className="p-4 border rounded-lg">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <h4 className="font-semibold">{cert.certificateType.replace(/_/g, ' ')}</h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <Label>Certificate Type</Label>
                                                                <Input
                                                                    value={cert.certificateType}
                                                                    disabled
                                                                    className="bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label>Expiry Date</Label>
                                                                <Input
                                                                    type="date"
                                                                    value={cert.expiryDate || ''}
                                                                    onChange={(e) => handleMedicalCertChange(index, 'expiryDate', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <Label>Attachment</Label>
                                                                <FileUploadUpdate
                                                                    assetName={cert.certificateType || ""}
                                                                    title={`${cert.certificateType} Attachment`}
                                                                    folder="Medical"
                                                                    existingFiles={cert.attachment ? [cert.attachment] : []}
                                                                    onFilesChange={handleMedicalFileChange(index)}
                                                                    onFileRemove={async (s3Key) => {
                                                                        if (s3Key && cert.id) {
                                                                            try {
                                                                                await remove({ path: s3Key });

                                                                                // Update medicalCerts state
                                                                                const updated = [...medicalCerts];
                                                                                updated[index] = {
                                                                                    ...updated[index],
                                                                                    attachment: ""
                                                                                };
                                                                                setMedicalCerts(updated);

                                                                                setMessage(`File deleted successfully`);
                                                                                setSuccessful(true);
                                                                                setShow(true);
                                                                            } catch (error) {
                                                                                console.error(`Failed to delete file: ${s3Key}`, error);
                                                                                setMessage("Error deleting file");
                                                                                setSuccessful(false);
                                                                                setShow(true);
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                                {/* Training Certificates Tab */}
                                <TabsContent value="training">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <FileText className="h-5 w-5" />
                                                Training Certificates
                                            </CardTitle>

                                        </CardHeader>
                                        <CardContent className="p-6">
                                            <div className="space-y-6">
                                                {trainingCerts.map((cert, index) => (
                                                    <div key={cert.certificateType} className="p-4 border rounded-lg">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <h4 className="font-semibold">{cert.certificateType.replace(/_/g, ' ')}</h4>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <Label>Certificate Type</Label>
                                                                <Input
                                                                    value={cert.certificateType}
                                                                    disabled
                                                                    className="bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label>Expiry Date</Label>
                                                                <Input
                                                                    type="date"
                                                                    value={cert.expiryDate || ''}
                                                                    onChange={(e) => handleTrainingCertChange(index, 'expiryDate', e.target.value)}
                                                                />
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <Label>Attachment</Label>

                                                                <FileUploadUpdate
                                                                    assetName={cert.certificateType || ""}
                                                                    title={`${cert.certificateType} Attachment`}
                                                                    folder="Training"
                                                                    existingFiles={cert.attachment ? [cert.attachment] : []}
                                                                    onFilesChange={handleTrainingFileChange(index)}  // Use separate handler
                                                                    onFileRemove={async (s3Key) => {
                                                                        if (s3Key && cert.id) {
                                                                            try {
                                                                                await remove({ path: s3Key });

                                                                                //  Update trainingCerts, additionalCerts
                                                                                const updated = [...trainingCerts];
                                                                                updated[index] = {
                                                                                    ...updated[index],
                                                                                    attachment: ""
                                                                                };
                                                                                setTrainingCerts(updated);


                                                                                setMessage(`File deleted successfully`);
                                                                                setSuccessful(true);
                                                                                setShow(true);
                                                                            } catch (error) {
                                                                                console.error(`Failed to delete file: ${s3Key}`, error);
                                                                                setMessage("Error deleting file");
                                                                                setSuccessful(false);
                                                                                setShow(true);
                                                                            }
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                            </Tabs>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-3 mt-8">
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/humanresourcesdepartment')}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving || !formData.employeeId || !formData.firstName || !formData.surname}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4 mr-2" />
                                            Create Employee
                                        </>
                                    )}
                                </Button>
                            </div>
                            {show && (
                                <ResponseModal
                                    successful={successful}
                                    message={message}
                                    setShow={setShow}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}





