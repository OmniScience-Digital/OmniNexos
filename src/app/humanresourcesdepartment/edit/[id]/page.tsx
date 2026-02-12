"use client";

import { client } from "@/services/schema";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Save, ArrowLeft, User, Loader2, FileText, Plus, Trash2, BriefcaseMedical, Search
} from "lucide-react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ResponseModal from "@/components/widgets/response";
import { formatDateForAmplify } from "@/utils/helper/time";
import { Textarea } from "@/components/ui/textarea";
import  {type Employee, MEDICAL_CERTIFICATE_TYPES, TRAINING_CERTIFICATE_TYPES } from "@/types/hrd.types";
import { handleEmployeeTasks } from "../../components/employeetasks";
import type { PDFState } from "@/types/schema";
import { remove } from "aws-amplify/storage";
import { handleUpload } from "@/services/s3.service";
import { FileUploadUpdate } from "@/components/widgets/fileupdate";
import { FileUploadMany } from "@/components/widgets/fileUpload";
import { getInitials } from "@/components/widgets/getinitials";


export default function EditEmployeePage() {
  const navigate = useNavigate();
  const params = useParams();
  const employeeId = decodeURIComponent(params.id as string);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [medicalCerts, setMedicalCerts] = useState<any[]>([]);
  const [trainingCerts, setTrainingCerts] = useState<any[]>([]);
  const [additionalCerts, setAdditionalCerts] = useState<any[]>([]);

  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState("");

  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalExpiringDocuments, setTotalExpiringDocuments] = useState(0);

  //search
  const [searchCertTerm, setSearchCertTerm] = useState("");
  //handle additional
  const [additionalCertificateFiles, setAdditionalCertificateFiles] = useState<Record<string, PDFState[]>>({});

  const fetchEmployeeWithRelations = async (): Promise<Employee | null> => {
    try {
      // Fetch employee base record
      const { data: employee, errors } = await client.models.Employee.get(
        { id: employeeId }
      );

      if (errors || !employee) {
        console.error("Error fetching employee:", errors);
        return null;
      }

      // Fetch all related certificates using GSIs
      const [
        { data: medicalCertificates },
        { data: trainingCertificates },
        { data: additionalCertificates },
      ] = await Promise.all([
        client.models.EmployeeMedicalCertificate.medicalCertsByEmployee({
          employeeId: employee.employeeId
        }),
        client.models.EmployeeTrainingCertificate.trainingCertsByEmployee({
          employeeId: employee.employeeId
        }),
        client.models.EmployeeAdditionalCertificate.additionalCertsByEmployee({
          employeeId: employee.employeeId
        }),
      ]);


      return {
        ...employee,
        medicalCertificates: medicalCertificates || [],
        trainingCertificates: trainingCertificates || [],
        additionalCertificates: additionalCertificates || []
      } as unknown as Employee;
    } catch (error) {
      console.error("Error in fetchEmployeeWithRelations:", error);
      return null;
    }
  };

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoading(true);

        // Fetch all data concurrently
        const [employeeData, additionList] = await Promise.all([
          fetchEmployeeWithRelations(),
          client.models.EmployeeAdditionalList.list()
        ]);


        if (employeeData) {
          // Fetch employee-specific data concurrently
          const [expiringtask, employeeHistory] = await Promise.all([
            client.models.EmployeeTaskTable.listEmployeeTaskTableByEmployeeIdAndEmployeeName({
              employeeId: employeeData.employeeId
            }),
            client.models.History.getHistoryByEntityId({
              entityId: employeeData.employeeId,
            }, {
              sortDirection: 'DESC',
              limit: 20
            })
          ]);

          // Convert to string format
          const historyString = employeeHistory.data
            .map(entry => entry.details)
            .join('');
          setHistory(historyString);

          setEmployee(employeeData);
          setFormData(employeeData);

          // Process certificates in parallel
          const totalDocs = countUploadedDocuments(employeeData);
          setTotalDocuments(totalDocs);
          setTotalExpiringDocuments(expiringtask.data.length);

          // MEDICAL CERTIFICATES
          const certsMap = new Map(
            employeeData.medicalCertificates?.map(cert => [cert.certificateType, cert])
          );
          const allMedicalCerts = MEDICAL_CERTIFICATE_TYPES.map(type =>
            certsMap.get(type) || {
              certificateType: type,
              expiryDate: "",
              attachment: ""
            }
          );

          // TRAINING CERTIFICATES
          const trainingcertsMap = new Map(
            employeeData.trainingCertificates?.map(cert => [cert.certificateType, cert])
          );
          const alltrainingCerts = TRAINING_CERTIFICATE_TYPES.map(type =>
            trainingcertsMap.get(type) || {
              certificateType: type,
              expiryDate: "",
              attachment: ""
            }
          );

          // ADDITIONAL CERTIFICATES
          const additionalCertsMap = new Map(
            employeeData.additionalCertificates?.map(cert => [cert.certificateName, cert])
          );
          const allAdditionalCertTypes = additionList.data?.map(item => item.certificateName) || [];
          const allAdditionalCerts = allAdditionalCertTypes.map(certificateName =>
            additionalCertsMap.get(certificateName) || {
              id: "",
              certificateName: certificateName,
              expiryDate: "",
              attachment: ""
            }
          );

          const sortedAdditionalCerts = allAdditionalCerts
            .slice()
            .sort((a, b) => a.certificateName.localeCompare(b.certificateName));

          // Set all state at once
          setMedicalCerts(allMedicalCerts);
          setTrainingCerts(alltrainingCerts);
          setAdditionalCerts(sortedAdditionalCerts);
        }
      } catch (error) {
        console.error("Error fetching employee:", error);
        setMessage("Failed to load employee data!");
        setShow(true);
        setSuccessful(false);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  const countUploadedDocuments = (employeeData: any) => {
    let total = 0;

    // Direct attachments
    const directAttachments = [
      employeeData.employeeIdAttachment,
      employeeData.passportAttachment,
      employeeData.driversLicenseAttachment,
      employeeData.pdpAttachment,
      employeeData.cvAttachment,
      employeeData.ppeListAttachment
    ];

    directAttachments.forEach(att => {
      if (att) total++;
    });

    // Certificate attachments
    const medicalCount = employeeData.medicalCertificates?.length || 0;
    const trainingCount = employeeData.trainingCertificates?.length || 0;
    const additionalCount = employeeData.additionalCertificates?.length || 0;

    total += medicalCount + trainingCount + additionalCount;

    return total;
  };


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

  const handleAdditionalCertChange = (index: number, field: string, value: string) => {
    const updated = [...additionalCerts];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalCerts(updated);
  };

  const addAdditionalCertificate = () => {
    setAdditionalCerts(prev => [{ certificateName: "", expiryDate: "", attachment: "" }, ...prev]);
  };

  const removeAdditionalCertificate = (index: number) => {
    setAdditionalCerts(prev => prev.filter((_, i) => i !== index));

  };

  const handleTrainingFileChange = (index: number) => (files: PDFState[]) => {
    console.log("🔄 Training file change received:", {
      index,
      filesCount: files.length,
      fileObject: files[0]?.file ? "EXISTS" : "MISSING",
      s3Key: files[0]?.s3Key
    });

    const updated = [...trainingCerts];

    if (files.length > 0) {
      if (files[0].file) {
        const fileWithData = {
          ...files[0],
          file: files[0].file,
          s3Key: files[0].s3Key || `training/${Date.now()}-${files[0].file.name}`
        };

        // Store with key "training_index"
        setAdditionalCertificateFiles(prev => ({
          ...prev,
          [`training_${index}`]: [fileWithData]
        }));

        updated[index] = {
          ...updated[index],
          attachment: fileWithData.s3Key
        };
      } else if (files[0].s3Key) {
        updated[index] = {
          ...updated[index],
          attachment: files[0].s3Key
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        attachment: ""
      };
      setAdditionalCertificateFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[index];
        return newFiles;
      });
    }

    setTrainingCerts(updated);
  };

  const handleExistingFileChange = (index: number) => (files: PDFState[]) => {
    console.log("🔄 Additional certificate file change received:", {
      index,
      filesCount: files.length,
      fileObject: files[0]?.file ? "EXISTS" : "MISSING",
      s3Key: files[0]?.s3Key
    });

    const updated = [...additionalCerts];

    if (files.length > 0) {
      if (files[0].file) {
        const fileWithData = {
          ...files[0],
          file: files[0].file,
          s3Key: files[0].s3Key || `additional/${Date.now()}-${files[0].file.name}`
        };

        // Store with numeric key
        setAdditionalCertificateFiles(prev => ({
          ...prev,
          [index]: [fileWithData]
        }));

        updated[index] = {
          ...updated[index],
          attachment: fileWithData.s3Key
        };
      } else if (files[0].s3Key) {
        updated[index] = {
          ...updated[index],
          attachment: files[0].s3Key
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        attachment: ""
      };
      setAdditionalCertificateFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[index];
        return newFiles;
      });
    }

    setAdditionalCerts(updated);
  };

  const handleMedicalFileChange = (index: number) => (files: PDFState[]) => {
    console.log("🔄 Medical file change received:", {
      index,
      filesCount: files.length,
      fileObject: files[0]?.file ? "EXISTS" : "MISSING",
      s3Key: files[0]?.s3Key
    });

    const updated = [...medicalCerts];

    if (files.length > 0) {
      if (files[0].file) {
        const fileWithData = {
          ...files[0],
          file: files[0].file,
          s3Key: files[0].s3Key || `medical/${Date.now()}-${files[0].file.name}`
        };

        // Store with key "medical_index"
        setAdditionalCertificateFiles(prev => ({
          ...prev,
          [`medical_${index}`]: [fileWithData]
        }));

        updated[index] = {
          ...updated[index],
          attachment: fileWithData.s3Key
        };
      } else if (files[0].s3Key) {
        updated[index] = {
          ...updated[index],
          attachment: files[0].s3Key
        };
      }
    } else {
      updated[index] = {
        ...updated[index],
        attachment: ""
      };
      setAdditionalCertificateFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[index];
        return newFiles;
      });
    }

    setMedicalCerts(updated);
  };
  // Generic handler for all document file changes
  const handleDocumentFileChange = (field: keyof Employee) => (files: PDFState[]) => {
    const url = files[0]?.s3Key || '';
    setFormData(prev => ({ ...prev, [field]: url }));

    // ALSO store the file object for later upload
    if (files.length > 0 && files[0] && files[0].file) {
      setAdditionalCertificateFiles(prev => ({
        ...prev,
        [field]: files // Store the files with the field name as key
      }));
    } else {
      // Clear if no files
      setAdditionalCertificateFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[field];
        return newFiles;
      });
    }
  };

  // Generic handler for file removal
  const handleDocumentFileRemove = (field: keyof Employee) => async (s3Key: string) => {
    if (s3Key && employee) {
      try {
        await remove({ path: s3Key });
        setFormData(prev => ({ ...prev, [field]: '' }));

        // Update employee in database immediately
        const updateData: any = { id: employee.id };
        updateData[field] = '';  // Set to empty string

        await client.models.Employee.update(updateData);

        const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";
        const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

        // Create a readable field name for the history
        const fieldName = field.replace('Attachment', '')
          .replace(/([A-Z])/g, ' $1')
          .trim()
          .toLowerCase()
          .replace(/\b\w/g, l => l.toUpperCase());

        const historyDetails = `\nHrd Dashboard: ${storedName} removed ${fieldName} file at ${johannesburgTime}`;

        await client.models.History.create({
          entityType: "EMPLOYEE",
          entityId: employee?.employeeId || '',
          action: "REMOVE_DOCUMENT_FILE",
          timestamp: new Date().toISOString(),
          details: historyDetails
        });

        // Update the history state
        setHistory(prev => `${historyDetails}\n${prev}`);

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
  };


  const handleSave = async () => {
    if (!employee) {
      console.error("❌ No employee found, cannot save");
      return;
    }

    try {
      setSaving(true);


      const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";
      const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

      // Track changed fields for History table
      const changedFields: string[] = [];

      // Log form data changes
      Object.keys(formData).forEach(key => {
        const typedKey = key as keyof Employee;
        if (formData[typedKey] !== employee[typedKey]) {
          changedFields.push(` ${storedName} updated ${typedKey} from ${employee[typedKey]} to ${formData[typedKey]} at ${johannesburgTime}.\n`);
          console.log(`   🔄 ${typedKey}: ${employee[typedKey]} → ${formData[typedKey]}`);
        }
      });

      // Existing certificates from DB for THIS employee
      const existingAdditionalCerts = employee.additionalCertificates || [];
      const existingTrainingCertsFromDB = employee.trainingCertificates || [];
      const existingMedicalCertsFromDB = employee.medicalCertificates || [];

      // ==============================================
      // 1. UPLOAD FILES AND UPDATE STATE FIRST
      // ==============================================

      // Create a copy of formData to update with uploaded keys
      const updatedFormData = { ...formData };

      // Upload Main Employee Documents

      const mainDocumentFields = [
        'employeeIdAttachment',
        'passportAttachment',
        'driversLicenseAttachment',
        'pdpAttachment',
        'cvAttachment',
        'ppeListAttachment'
      ] as const;

      // We need to track pending uploads for main documents too
      // Add this to your state at the top:
      // const [pendingMainDocuments, setPendingMainDocuments] = useState<{ [key: string]: PDFState[] }>({});

      for (const field of mainDocumentFields) {
        // Check if there are pending uploads for this field
        const uploadedFiles = additionalCertificateFiles[field as any];

        if (uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0] && uploadedFiles[0].file) {

          try {
            const uploadedKey = await handleUpload(uploadedFiles[0]);
            if (uploadedKey) {
              updatedFormData[field] = uploadedKey;
              // Also update the formData state
              setFormData(prev => ({ ...prev, [field]: uploadedKey }));
            }
          } catch (uploadError) {
            console.error(`❌ Failed to upload ${field}:`, uploadError);
          }
        }
      }

      // Upload Additional Certificate Files

      const certsToSave = [...additionalCerts];
      let uploadedCount = 0;

      for (let i = 0; i < certsToSave.length; i++) {
        const cert = certsToSave[i];
        const uploadedFiles = additionalCertificateFiles[i as number];

        if (cert.certificateName && uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0] && uploadedFiles[0].file) {
          try {
            const uploadedKey = await handleUpload(uploadedFiles[0]);
            if (uploadedKey) {
              certsToSave[i].attachment = uploadedKey;
              uploadedCount++;

              const updatedCerts = [...additionalCerts];
              updatedCerts[i].attachment = uploadedKey;
              setAdditionalCerts(updatedCerts);
            }
          } catch (uploadError) {
            console.error(`❌ Failed to upload file for "${cert.certificateName}":`, uploadError);
          }
        }
      }


      // Upload Medical Certificate Files
      for (let i = 0; i < medicalCerts.length; i++) {
        const cert = medicalCerts[i];
        const uploadedFiles = additionalCertificateFiles[`medical_${i}` as any] || additionalCertificateFiles[i as number];

        if (cert.certificateType && uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0] && uploadedFiles[0].file) {
          try {
            const uploadedKey = await handleUpload(uploadedFiles[0]);
            if (uploadedKey) {
              const updated = [...medicalCerts];
              updated[i].attachment = uploadedKey;
              setMedicalCerts(updated);
            }
          } catch (uploadError) {
            console.error(`❌ Failed to upload medical file for "${cert.certificateType}":`, uploadError);
          }
        }
      }

      // Upload Training Certificate Files
      for (let i = 0; i < trainingCerts.length; i++) {
        const cert = trainingCerts[i];
        const uploadedFiles = additionalCertificateFiles[`training_${i}` as any] || additionalCertificateFiles[i as number];

        if (cert.certificateType && uploadedFiles && uploadedFiles.length > 0 && uploadedFiles[0] && uploadedFiles[0].file) {

          try {
            const uploadedKey = await handleUpload(uploadedFiles[0]);

            if (uploadedKey) {
              const updated = [...trainingCerts];
              updated[i].attachment = uploadedKey;
              setTrainingCerts(updated);
            }
          } catch (uploadError) {
            console.error(`❌ Failed to upload training file for "${cert.certificateType}":`, uploadError);
          }
        }
      }
      // ==============================================
      // 2. CHECK FOR CERTIFICATES WITH ATTACHMENTS BUT NO EXPIRY (WARNING ONLY)
      // ==============================================
      console.log("🔍 CHECKING FOR CERTIFICATES WITH ATTACHMENTS BUT NO EXPIRY...");
      const certificatesWithoutExpiry: string[] = [];

      // Check additional certificates
      for (const cert of certsToSave) {
        if (cert.certificateName &&
          cert.certificateName.trim() !== '' &&
          cert.attachment &&
          cert.attachment.trim() !== '' &&
          !cert.expiryDate) {
          certificatesWithoutExpiry.push(`Additional Certificate "${cert.certificateName}"`);
        }
      }

      // Check training certificates
      for (const cert of trainingCerts) {
        if (cert.attachment &&
          cert.attachment.trim() !== '' &&
          !cert.expiryDate) {
          certificatesWithoutExpiry.push(`Training Certificate "${cert.certificateType}"`);
        }
      }

      // Check medical certificates
      for (const cert of medicalCerts) {
        if (cert.attachment &&
          cert.attachment.trim() !== '' &&
          !cert.expiryDate) {
          certificatesWithoutExpiry.push(`Medical Certificate "${cert.certificateType}"`);
        }
      }

      // ==============================================
      // 3. TRACK CHANGES FOR HISTORY
      // ==============================================


      // Track additional certificate changes (SKIP those without expiry if they have attachment)
      certsToSave.forEach(cert => {
        const existingCert = existingAdditionalCerts.find(ec => ec.id === cert.id);

        if (!cert.certificateName || cert.certificateName.trim() === '') {
          return;
        }

        // SKIP this certificate if it has attachment but no expiry
        if (cert.attachment && cert.attachment.trim() !== '' && !cert.expiryDate) {
          return;
        }

        if (existingCert) {
          if (cert.certificateName !== existingCert.certificateName) {
            changedFields.push(`${storedName} updated Additional Certificate name from "${existingCert.certificateName}" to "${cert.certificateName}" at ${johannesburgTime}.\n`);
          }
          if (cert.expiryDate !== existingCert.expiryDate) {
            changedFields.push(`${storedName} updated Additional Certificate "${cert.certificateName}" expiry from ${existingCert.expiryDate} to ${cert.expiryDate} at ${johannesburgTime}.\n`);
          }
          if (cert.attachment && cert.attachment !== existingCert.attachment) {
            changedFields.push(`${storedName} updated Additional Certificate "${cert.certificateName}" attachment at ${johannesburgTime}.\n`);
          }
        } else if (cert.certificateName && (cert.expiryDate || cert.attachment)) {
          changedFields.push(`${storedName} added Additional Certificate "${cert.certificateName}" at ${johannesburgTime}.\n`);
        }
      });

      // Track training certificate changes (SKIP those without expiry if they have attachment)
      trainingCerts.forEach(cert => {
        const existingCert = existingTrainingCertsFromDB.find(ec => ec.certificateType === cert.certificateType);

        // SKIP this certificate if it has attachment but no expiry
        if (cert.attachment && cert.attachment.trim() !== '' && !cert.expiryDate) {
          return;
        }

        if (existingCert) {
          if (cert.expiryDate !== existingCert.expiryDate) {
            changedFields.push(`${storedName} updated Training ${cert.certificateType} expiry from ${existingCert.expiryDate} to ${cert.expiryDate} at ${johannesburgTime}.\n`);
          }
          if (cert.attachment && cert.attachment !== existingCert.attachment) {
            changedFields.push(`${storedName} updated Training ${cert.certificateType} attachment at ${johannesburgTime}.\n`);
          }
        } else if (cert.expiryDate || cert.attachment) {
          changedFields.push(`${storedName} added Training ${cert.certificateType} certificate at ${johannesburgTime}.\n`);
        }
      });

      // Track medical certificate changes (SKIP those without expiry if they have attachment)
      medicalCerts.forEach(cert => {
        const existingCert = existingMedicalCertsFromDB.find(ec => ec.certificateType === cert.certificateType);

        // SKIP this certificate if it has attachment but no expiry
        if (cert.attachment && cert.attachment.trim() !== '' && !cert.expiryDate) {
          return;
        }

        if (existingCert) {
          if (cert.expiryDate !== existingCert.expiryDate) {
            changedFields.push(`${storedName} updated Medical ${cert.certificateType} expiry from ${existingCert.expiryDate} to ${cert.expiryDate} at ${johannesburgTime}.\n`);
          }
          if (cert.attachment && cert.attachment !== existingCert.attachment) {
            changedFields.push(`${storedName} updated Medical ${cert.certificateType} attachment at ${johannesburgTime}.\n`);
          }
        } else if (cert.expiryDate || cert.attachment) {
          changedFields.push(`${storedName} added Medical ${cert.certificateType} certificate at ${johannesburgTime}.\n`);
        }
      });

      // Track removed additional certificates
      existingAdditionalCerts.forEach(existingCert => {
        const stillExists = certsToSave.find(ac => ac.id === existingCert.id);
        if (!stillExists) {
          changedFields.push(`${storedName} removed Additional Certificate "${existingCert.certificateName}" at ${johannesburgTime}.\n`);
        }
      });

      // ==============================================
      // 4. CHECK IF ANYTHING ACTUALLY CHANGED
      // ==============================================


      if (changedFields.length === 0) {
        setMessage("No changes detected. Nothing to save.");
        setShow(true);
        setSuccessful(true);
        setSaving(false);
        return;
      }

      // ==============================================
      // 5. UPDATE MAIN EMPLOYEE RECORD
      // ==============================================

      const employeeData = {
        employeeId: formData.employeeId!,
        firstName: formData.firstName!,
        surname: formData.surname!,
        employeeNumber: formData.employeeNumber || null,
        knownAs: formData.knownAs || null,
        passportNumber: formData.passportNumber || null,
        passportExpiry: formatDateForAmplify(formData.passportExpiry),
        passportAttachment: formData.passportAttachment || '',
        driversLicenseCode: formData.driversLicenseCode || null,
        driversLicenseExpiry: formatDateForAmplify(formData.driversLicenseExpiry),
        driversLicenseAttachment: formData.driversLicenseAttachment || '',
        authorizedDriver: formData.authorizedDriver!,
        pdpExpiry: formatDateForAmplify(formData.pdpExpiry),
        pdpAttachment: formData.pdpAttachment || '',
        cvAttachment: formData.cvAttachment || '',
        ppeListAttachment: formData.ppeListAttachment || '',
        ppeExpiry: formatDateForAmplify(formData.ppeExpiry),
        employeeIdAttachment: formData.employeeIdAttachment || '',
      };

      const result = await client.models.Employee.update({
        id: employee.id,
        ...employeeData
      });

      if (result.errors) {
        throw new Error("Failed to update employee");
      }


      // ==============================================
      // 6. SAVE MEDICAL CERTIFICATES (SKIP those without expiry if they have attachment)
      // ==============================================

      let medicalSaved = 0;
      let medicalSkipped = 0;
      for (const cert of medicalCerts) {
        const existingCert = existingMedicalCertsFromDB.find(ec => ec.certificateType === cert.certificateType);

        // Skip if no attachment AND no expiry date
        if (!cert.attachment && !cert.expiryDate) {
          continue;
        }

        // SKIP this certificate if it has attachment but no expiry
        if (cert.attachment && cert.attachment.trim() !== '' && !cert.expiryDate) {
          medicalSkipped++;
          continue;
        }

        // Check if anything actually changed
        const isNewCert = !existingCert;
        const expiryChanged = existingCert?.expiryDate !== cert.expiryDate;
        const attachmentChanged = existingCert?.attachment !== cert.attachment;

        // Only save if something changed or it's a new cert with data
        if (isNewCert || expiryChanged || attachmentChanged) {
          if (existingCert && existingCert.id) {
            console.log(`📝 Updating medical cert: ${cert.certificateType}`);
            await client.models.EmployeeMedicalCertificate.update({
              id: existingCert.id,
              certificateType: cert.certificateType,
              expiryDate: formatDateForAmplify(cert.expiryDate) || "",
              attachment: cert.attachment || null
            });
            medicalSaved++;
          } else {
            console.log(`➕ Creating new medical cert: ${cert.certificateType}`);
            await client.models.EmployeeMedicalCertificate.create({
              employeeId: employee.employeeId,
              certificateType: cert.certificateType,
              expiryDate: formatDateForAmplify(cert.expiryDate) || "",
              attachment: cert.attachment || null
            });
            medicalSaved++;
          }
        } else {
          console.log(`⏭️ No changes for medical cert: ${cert.certificateType}`);
        }
      }

      // ==============================================
      // 7. SAVE TRAINING CERTIFICATES (SKIP those without expiry if they have attachment)
      // ==============================================

      let trainingSaved = 0;
      let trainingSkipped = 0;
      for (const cert of trainingCerts) {
        const existingCert = existingTrainingCertsFromDB.find(ec => ec.certificateType === cert.certificateType);

        // Skip if no attachment AND no expiry date
        if (!cert.attachment && !cert.expiryDate) {
          continue;
        }

        // SKIP this certificate if it has attachment but no expiry
        if (cert.attachment && cert.attachment.trim() !== '' && !cert.expiryDate) {
          trainingSkipped++;
          continue;
        }

        // Check if anything actually changed
        const isNewCert = !existingCert;
        const expiryChanged = existingCert?.expiryDate !== cert.expiryDate;
        const attachmentChanged = existingCert?.attachment !== cert.attachment;

        // Only save if something changed or it's a new cert with data
        if (isNewCert || expiryChanged || attachmentChanged) {
          if (existingCert && existingCert.id) {

            await client.models.EmployeeTrainingCertificate.update({
              id: existingCert.id,
              certificateType: cert.certificateType,
              expiryDate: formatDateForAmplify(cert.expiryDate) || "",
              attachment: cert.attachment || null
            });
            trainingSaved++;
          } else {

            await client.models.EmployeeTrainingCertificate.create({
              employeeId: employee.employeeId,
              certificateType: cert.certificateType,
              expiryDate: formatDateForAmplify(cert.expiryDate) || "",
              attachment: cert.attachment || null
            });
            trainingSaved++;
          }
        } else {
          console.log(`⏭️ No changes for training cert: ${cert.certificateType}`);
        }
      }


      // ==============================================
      // 8. SAVE ADDITIONAL CERTIFICATES (SKIP those without expiry if they have attachment)
      // ==============================================

      const existingListItems = await client.models.EmployeeAdditionalList.list();
      const existingCertificateNames = new Set(
        existingListItems.data?.map(item => item.certificateName.toLowerCase()) || []
      );

      let additionalSaved = 0;
      let additionalDeleted = 0;
      let additionalSkipped = 0;

      for (const cert of certsToSave) {
        if (!cert.certificateName || cert.certificateName.trim() === '') {
          continue;
        }

        if (!cert.attachment && !cert.expiryDate) {

          continue;
        }

        // SKIP this certificate if it has attachment but no expiry
        if (cert.attachment && cert.attachment.trim() !== '' && !cert.expiryDate) {

          additionalSkipped++;
          continue;
        }

        const existingCert = existingAdditionalCerts.find(ec => ec.id === cert.id);

        // Check if anything actually changed
        const isNewCert = !existingCert;
        const nameChanged = existingCert?.certificateName !== cert.certificateName;
        const expiryChanged = existingCert?.expiryDate !== cert.expiryDate;
        const attachmentChanged = existingCert?.attachment !== cert.attachment;

        // Only save if something changed or it's a new cert with data
        if (isNewCert || nameChanged || expiryChanged || attachmentChanged) {
          // Add to EmployeeAdditionalList if needed
          if (!existingCertificateNames.has(cert.certificateName.toLowerCase())) {

            await client.models.EmployeeAdditionalList.create({
              certificateName: cert.certificateName.trim()
            });
            existingCertificateNames.add(cert.certificateName.toLowerCase());
          }

          if (existingCert && cert.id) {

            await client.models.EmployeeAdditionalCertificate.update({
              id: existingCert.id,
              certificateName: cert.certificateName,
              expiryDate: formatDateForAmplify(cert.expiryDate) || "",
              attachment: cert.attachment || null
            });
            additionalSaved++;
          } else {

            await client.models.EmployeeAdditionalCertificate.create({
              employeeId: employee.employeeId,
              certificateName: cert.certificateName,
              expiryDate: formatDateForAmplify(cert.expiryDate) || "",
              attachment: cert.attachment || null
            });
            additionalSaved++;
          }
        } else {
          console.log(`⏭️ No changes for additional cert: "${cert.certificateName}"`);
        }
      }

      // Remove deleted additional certificates
      for (const existingCert of existingAdditionalCerts) {
        const stillExists = certsToSave.find(ac => ac.id === existingCert.id);
        if (!stillExists) {

          await client.models.EmployeeAdditionalCertificate.delete({
            id: existingCert.id
          });
          additionalDeleted++;
        }
      }

      // ==============================================
      // 9. CREATE HISTORY
      // ==============================================

      await client.models.History.create({
        entityType: "EMPLOYEE",
        entityId: employee.employeeId,
        action: "UPDATE",
        timestamp: new Date().toISOString(),
        details: `\nHrd Dashboard: Employee ${formData.firstName} ${formData.surname} updated by ${storedName}. Changes:\n${changedFields.join('')}`
      });

      setHistory(prev => `Employee ${formData.firstName} ${formData.surname} updated by ${storedName}. Changes:\n${changedFields.join('')}\n${prev}`);

      // Call the task checking function after all updates are complete
      await checkAndPrintTasks(
        employee, // oldEmployee
        {
          ...employeeData,
          medicalCertificates: medicalCerts.filter(cert => !(cert.attachment && !cert.expiryDate)),
          trainingCertificates: trainingCerts.filter(cert => !(cert.attachment && !cert.expiryDate)),
          additionalCertificates: certsToSave.filter(cert => !(cert.attachment && !cert.expiryDate))
        }
      );

      // Clear uploaded files state
      setAdditionalCertificateFiles({});

      // Show success message with warning if certificates were skipped
      if (certificatesWithoutExpiry.length > 0) {
        const warningMessage = certificatesWithoutExpiry.join(', ');
        setMessage(`Employee data saved successfully! \n ⚠️ Note: The following certificates have attachments but no expiry dates and were not saved: ${warningMessage}`);
      } else {
        setMessage("Employee data saved successfully!");
      }

      setShow(true);
      setSuccessful(true);



      // Refresh the page data after a short delay
      setTimeout(() => {
        navigate('/humanresourcesdepartment');
      }, 1500);

    } catch (error) {
      console.error("❌ ERROR in handleSave:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
      setMessage(error instanceof Error ? error.message : "Error saving employee data");
      setShow(true);
      setSuccessful(false);
    } finally {
      setSaving(false);
    }
  };


  const checkAndPrintTasks = async (oldEmployee: Employee, newData: any) => {
    // Check main employee documents - USE LOWERCASE to match database
    const mainDocumentTypes = [
      { key: 'passportExpiry', type: 'passport', attachment: newData.passportAttachment },
      { key: 'driversLicenseExpiry', type: 'drivers_license', attachment: newData.driversLicenseAttachment },
      { key: 'pdpExpiry', type: 'pdp', attachment: newData.pdpAttachment },
      { key: 'ppeExpiry', type: 'ppe', attachment: newData.ppeListAttachment }
    ];

    for (const doc of mainDocumentTypes) {
      const oldExpiry = oldEmployee[doc.key as keyof Employee];
      const newExpiry = newData[doc.key as keyof Employee];

      if (newExpiry && newExpiry !== oldExpiry) {
        const documentIdentifier = `${oldEmployee.employeeId}_${doc.type}`;

        // Check if task exists using GSI
        const { data: existingTasks } = await client.models.EmployeeTaskTable.listEmployeeTaskTableByDocumentIdentifier({
          documentIdentifier: documentIdentifier
        });
        const existingTask = existingTasks?.[0];

        if (existingTask) {
          await handleEmployeeTasks(newExpiry, existingTask, doc);
        } else {
          console.log(`No task found for: ${documentIdentifier}`);
        }
      }
    }

    // Check medical certificates
    const oldMedicalCerts = oldEmployee.medicalCertificates || [];
    const newMedicalCerts = newData.medicalCertificates || [];
    for (const newCert of newMedicalCerts) {
      const oldCert = oldMedicalCerts.find(oc => oc.certificateType === newCert.certificateType);

      if (newCert.expiryDate && newCert.expiryDate !== oldCert?.expiryDate) {
        const documentIdentifier = `${oldEmployee.employeeId}_medical_${newCert.certificateType}`;

        const { data: existingTasks } = await client.models.EmployeeTaskTable.listEmployeeTaskTableByDocumentIdentifier({
          documentIdentifier: documentIdentifier
        });
        const existingTask = existingTasks?.[0];

        if (existingTask) {
          await handleEmployeeTasks(newCert.expiryDate, existingTask, {
            key: 'expiryDate',
            type: `medical_${newCert.certificateType}`,
            attachment: newCert.attachment
          });
        }
      }
    }

    // Check training certificates
    const oldTrainingCerts = oldEmployee.trainingCertificates || [];
    const newTrainingCerts = newData.trainingCertificates || [];
    for (const newCert of newTrainingCerts) {
      const oldCert = oldTrainingCerts.find(oc => oc.certificateType === newCert.certificateType);

      if (newCert.expiryDate && newCert.expiryDate !== oldCert?.expiryDate) {
        const documentIdentifier = `${oldEmployee.employeeId}_training_${newCert.certificateType}`;

        const { data: existingTasks } = await client.models.EmployeeTaskTable.listEmployeeTaskTableByDocumentIdentifier({
          documentIdentifier: documentIdentifier
        });
        const existingTask = existingTasks?.[0];

        if (existingTask) {
          await handleEmployeeTasks(newCert.expiryDate, existingTask, {
            key: 'expiryDate',
            type: `training_${newCert.certificateType}`,
            attachment: newCert.attachment
          });
        }
      }
    }

    // Check additional certificates
    const oldAdditionalCerts = oldEmployee.additionalCertificates || [];
    const newAdditionalCerts = newData.additionalCertificates || [];
    for (const newCert of newAdditionalCerts) {
      const oldCert = oldAdditionalCerts.find(oc => oc.id === newCert.id);

      if (newCert.expiryDate && newCert.expiryDate !== oldCert?.expiryDate) {
        const documentIdentifier = `${oldEmployee.employeeId}_additional_${newCert.certificateName}`;

        const { data: existingTasks } = await client.models.EmployeeTaskTable.listEmployeeTaskTableByDocumentIdentifier({
          documentIdentifier: documentIdentifier
        });
        const existingTask = existingTasks?.[0];

        if (existingTask) {
          await handleEmployeeTasks(newCert.expiryDate, existingTask, {
            key: 'expiryDate',
            type: `additional_${newCert.certificateName}`,
            attachment: newCert.attachment
          });
        }
      }
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <Loading />
        <Footer />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <p>Employee not found</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />

      <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
        <div className="container mx-auto max-w-6xl  mt-4">

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
                  Edit {employee.firstName} {employee.surname}
                </h1>
                <p className="text-muted-foreground mt-2 text-base">
                  Update employee information and documents
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
                        {getInitials(formData.firstName || '', formData.surname || '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <h3 className="font-semibold">
                        {formData.firstName} {formData.surname}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {formData.employeeId}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
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
                          <span>Total Documents uploaded:</span>
                          <Badge className="bg-black dark:bg-black text-white">
                            {totalDocuments}
                          </Badge>
                        </div>

                        <div className="flex justify-between">
                          <span>Expiring / Expired Documents:</span>

                          <Badge
                            className={
                              totalExpiringDocuments > 0
                                ? "bg-red-500 dark:bg-red-500 text-white"
                                : "bg-black-500 dark:bg-black-500 text-white"
                            }
                          >
                            {totalExpiringDocuments}
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
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="personal" className="cursor-pointer">Basic</TabsTrigger>
                  <TabsTrigger value="medical" className="cursor-pointer">Medical / Induction</TabsTrigger>
                  <TabsTrigger value="training" className="cursor-pointer">Training / Certification</TabsTrigger>
                  <TabsTrigger value="additional" className="cursor-pointer">Additional</TabsTrigger>
                  <TabsTrigger value="history" className="cursor-pointer">History</TabsTrigger>
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

                                        // Update EmployeeMedicalCertificate
                                        await client.models.EmployeeMedicalCertificate.delete({
                                          id: cert.id,
                                        });

                                        // Update medicalCerts state
                                        const updated = [...medicalCerts];
                                        updated[index] = {
                                          ...updated[index],
                                          attachment: "",
                                          expiryDate: ""
                                        };
                                        setMedicalCerts(updated);



                                        const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";
                                        const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

                                        await client.models.History.create({
                                          entityType: "EMPLOYEE",
                                          entityId: employee.employeeId,
                                          action: "REMOVE_MEDICAL_FILE",
                                          timestamp: new Date().toISOString(),
                                          details: `\nHrd Dashboard: ${storedName} removed file from medical certificate "${cert.certificateType}" at ${johannesburgTime}`
                                        });

                                        setHistory(prev => `\n${storedName} removed file from medical certificate "${cert.certificateType}" at ${johannesburgTime}${prev}`);
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

                                        // Update EmployeeTrainingCertificate, 
                                        await client.models.EmployeeTrainingCertificate.delete({
                                          id: cert.id,
                                        });

                                        //  Update trainingCerts, additionalCerts
                                        const updated = [...trainingCerts];
                                        updated[index] = {
                                          ...updated[index],
                                          expiryDate: "",
                                          attachment: ""
                                        };
                                        setTrainingCerts(updated);

                                        const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";
                                        const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

                                        // Reference cert.certificateType
                                        await client.models.History.create({
                                          entityType: "EMPLOYEE",
                                          entityId: employee.employeeId,
                                          action: "REMOVE_TRAINING_FILE",
                                          timestamp: new Date().toISOString(),
                                          details: `\nHrd Dashboard: ${storedName} removed file from training certificate "${cert.certificateType}" at ${johannesburgTime}`
                                        });

                                        setHistory(prev => `\n${storedName} removed file from training certificate "${cert.certificateType}" at ${johannesburgTime}${prev}`);
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
                {/* Additional Certificates Tab */}
                <TabsContent value="additional">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Additional Certificates
                        </CardTitle>
                        <Button onClick={addAdditionalCertificate} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Certificate
                        </Button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search by certificate name..."
                          value={searchCertTerm}
                          onChange={(e) => setSearchCertTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                    </CardHeader>

                    <CardContent className="p-6">
                      <div className="space-y-6">

                        {/* NEW CERTIFICATE FORM (the one user is currently adding) */}
                        {additionalCerts
                          .filter(cert =>
                            cert.certificateName?.toLowerCase().includes(searchCertTerm.toLowerCase()) ||
                            "new certificate".includes(searchCertTerm.toLowerCase())
                          )
                          .map((cert, index) => {
                            // If certificate has an ID, it's from database
                            // If no ID, it's a new one being added
                            const isNewCertificate = !cert.id;

                            return (
                              <div
                                key={isNewCertificate ? `new-${index}` : cert.id}
                                className={`p-4 border rounded-lg ${isNewCertificate ? 'border-dashed border-blue-300' : ''}`}
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <h4 className="font-semibold">
                                    {isNewCertificate ? "New Certificate" : cert.certificateName}
                                  </h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeAdditionalCertificate(index)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label>Certificate Name</Label>
                                    <Input
                                      value={cert.certificateName || ''}
                                      onChange={(e) => handleAdditionalCertChange(index, 'certificateName', e.target.value)}
                                      placeholder="Enter certificate name"
                                    />
                                  </div>
                                  <div>
                                    <Label>Expiry Date</Label>
                                    <Input
                                      type="date"
                                      value={cert.expiryDate || ''}
                                      onChange={(e) => handleAdditionalCertChange(index, 'expiryDate', e.target.value)}
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label>Attachment</Label>

                                    {isNewCertificate ? (
                                      // For NEW certificates (no ID) - use FileUploadMany
                                      <FileUploadMany
                                        assetName={cert.certificateName}
                                        title={cert.certificateName || "New Certificate"}
                                        folder="additional"
                                        onFilesChange={(files) => {
                                          const updated = [...additionalCerts];
                                          updated[index] = {
                                            ...updated[index],
                                            attachment: files[0]?.s3Key || ""
                                          };
                                          setAdditionalCerts(updated);

                                          // ALSO store files for upload
                                          if (files.length > 0 && files[0] && files[0].file) {
                                            setAdditionalCertificateFiles(prev => ({
                                              ...prev,
                                              [index]: files // Store with index as key
                                            }));
                                          } else {
                                            // Clear if no files
                                            setAdditionalCertificateFiles(prev => {
                                              const newFiles = { ...prev };
                                              delete newFiles[index];
                                              return newFiles;
                                            });
                                          }
                                        }}
                                      />
                                    ) : (
                                      // For EXISTING certificates (has ID) - use FileUploadUpdate
                                      <FileUploadUpdate
                                        assetName={cert.certificateName || ""}
                                        title={`${cert.certificateName || 'Additional'} Attachment`}
                                        folder="additional"
                                        existingFiles={cert.attachment ? [cert.attachment] : []}
                                        onFilesChange={handleExistingFileChange(index)}
                                        onFileRemove={async (s3Key) => {
                                          if (s3Key && cert.id) {
                                            try {
                                              await remove({ path: s3Key });
                                              const updated = [...additionalCerts];
                                              updated[index] = {
                                                ...updated[index],
                                                attachment: ""
                                              };
                                              setAdditionalCerts(updated);
                                              await client.models.EmployeeAdditionalCertificate.delete({
                                                id: cert.id,
                                              });
                                              const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";
                                              const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });
                                              await client.models.History.create({
                                                entityType: "EMPLOYEE",
                                                entityId: employee.employeeId,
                                                action: "REMOVE_CERTIFICATE_FILE",
                                                timestamp: new Date().toISOString(),
                                                details: `\nHrd Dashboard: ${storedName} remove file from certificate "${cert.certificateName}" at ${johannesburgTime}`
                                              });
                                              setHistory(prev => `\n${storedName} removed file from certificate "${cert.certificateName}" at ${johannesburgTime}${prev}`);
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
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}

                        {additionalCerts.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            No additional certificates added yet.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* History  Tab */}
                <TabsContent value="history" >
                  <Card className="bg-background border-slate-200 shadow-sm">
                    <CardHeader className="bg-background border-b border-slate-200">
                      <CardTitle className="flex items-center gap-2 text-foreground">
                        <FileText className="h-5 w-5" />
                        History & Notes
                      </CardTitle>
                      <CardDescription>
                        Employee history and additional notes
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="history" className="text-sm font-medium text-slate-700">
                            Employee History
                          </Label>
                          <Textarea
                            id="history"
                            value={history || ''}
                            className="min-h-[200px] text-sm resize-vertical border-slate-300 focus:border-blue-500"
                            placeholder="Add any relevant history or notes about the employee..."
                            readOnly
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            This field will automatically record creation and updates.
                          </p>
                        </div>

                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-800">
                            <strong>Note:</strong> System-generated history entries will be automatically
                            added when creating or updating this employee record.
                          </p>
                        </div>
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
                >
                  Cancel
                </Button>


                <Button
                  onClick={handleSave}
                  disabled={saving}
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
                      Update Employee
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