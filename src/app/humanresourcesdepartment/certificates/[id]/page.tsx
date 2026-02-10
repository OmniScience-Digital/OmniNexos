"use client";

import { client } from "@/services/schema";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Calendar, FileText, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUrl } from 'aws-amplify/storage';
import { toast } from "sonner";

interface Employee {
    id: string;
    employeeId: string;
    firstName: string;
    surname: string;
    medicalCertificates?: any[];
    trainingCertificates?: any[];
    additionalCertificates?: any[];
}

interface CertificateStatus {
    isExpired: boolean;
    isExpiringSoon: boolean;
    daysUntilExpiry: number;
    status: 'valid' | 'expiring' | 'expired';
}



export default function ViewCertificatesPage() {
    const navigate = useNavigate();
    const params = useParams();
    const employeeId = decodeURIComponent(params.id as string);

    const [loading, setLoading] = useState(true);
    const [employee, setEmployee] = useState<Employee | null>(null);

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
                { data: additionalCertificates }
            ] = await Promise.all([
                client.models.EmployeeMedicalCertificate.medicalCertsByEmployee({
                    employeeId: employee.employeeId
                }),
                client.models.EmployeeTrainingCertificate.trainingCertsByEmployee({
                    employeeId: employee.employeeId
                }),
                client.models.EmployeeAdditionalCertificate.additionalCertsByEmployee({
                    employeeId: employee.employeeId
                })
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
                const employeeData = await fetchEmployeeWithRelations();
                setEmployee(employeeData);
  
            } catch (error) {
                console.error("Error fetching employee:", error);
                toast.error("Failed to load employee certificates");
            } finally {
                setLoading(false);
            }
        };

        fetchEmployee();
    }, [employeeId]);

    const getCertificateStatus = (expiryDate: string): CertificateStatus => {
        const today = new Date();
        const expiry = new Date(expiryDate);
        const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        const isExpired = daysUntilExpiry < 0;
        const isExpiringSoon = daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

        let status: 'valid' | 'expiring' | 'expired' = 'valid';
        if (isExpired) status = 'expired';
        else if (isExpiringSoon) status = 'expiring';

        return {
            isExpired,
            isExpiringSoon,
            daysUntilExpiry,
            status
        };
    };

    const getStatusBadge = (status: 'valid' | 'expiring' | 'expired') => {
        const variants = {
            valid: { className: "bg-green-100 text-green-800", icon: CheckCircle },
            expiring: { className: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
            expired: { className: "bg-red-100 text-red-800", icon: XCircle }
        };

        const { className, icon: Icon } = variants[status];
        return (
            <Badge className={`${className} flex items-center gap-1`}>
                <Icon className="h-3 w-3" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
        );
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-ZA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };



const handlePreview = async (pdf: any) => {    
    try {
        if (pdf.attachment) {
            
            const { url: s3Url } = await getUrl({ 
                path: pdf.attachment 
            });
            
            const finalUrl = s3Url.toString();
            window.open(finalUrl, '_blank');
        }
    } catch (error) {
        console.error('Error details:', error);
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
                <div className="container mx-auto max-w-6xl mt-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/humanresourcesdepartment')}
                                className="h-9 w-9 p-0"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold">
                                    Certificates for {employee.firstName} {employee.surname}
                                </h1>
                                <p className="text-muted-foreground mt-2">
                                    Employee ID: {employee.employeeId}
                                </p>
                            </div>
                        </div>
                    </div>

                    <Tabs defaultValue="medical" className="space-y-6">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="medical" className="cursor-pointer">
                                Medical Certificates ({employee.medicalCertificates?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="training" className="cursor-pointer">
                                Training Certificates ({employee.trainingCertificates?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="additional" className="cursor-pointer">
                                Additional Certificates ({employee.additionalCertificates?.length || 0})
                            </TabsTrigger>
                        </TabsList>

                        {/* Medical Certificates Tab */}
                        <TabsContent value="medical">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Medical Certificates
                                    </CardTitle>
                                    <CardDescription>
                                        All medical certificates and their expiry status
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        {employee.medicalCertificates?.map((cert) => {
                                            const status = getCertificateStatus(cert.expiryDate);
                                            return (
                                                <div key={cert.id} className="p-4 border rounded-lg">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h4 className="font-semibold text-lg">
                                                                {cert.certificateType?.replace(/_/g, ' ')}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-sm text-muted-foreground">
                                                                    Expires: {formatDate(cert.expiryDate)}
                                                                </span>
                                                                {getStatusBadge(status.status)}
                                                            </div>
                                                        </div>
                                                        {cert.attachment && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handlePreview(cert)}
                                                            >
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {status.isExpiringSoon && !status.isExpired && (
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                                            <p className="text-yellow-800 text-sm">
                                                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                                                This certificate expires in {status.daysUntilExpiry} days
                                                            </p>
                                                        </div>
                                                    )}

                                                    {status.isExpired && (
                                                        <div className="bg-red-50 border border-red-200 rounded p-3">
                                                            <p className="text-red-800 text-sm">
                                                                <XCircle className="h-4 w-4 inline mr-1" />
                                                                This certificate expired {Math.abs(status.daysUntilExpiry)} days ago
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {(!employee.medicalCertificates || employee.medicalCertificates.length === 0) && (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>No medical certificates found for this employee.</p>
                                            </div>
                                        )}
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
                                    <CardDescription>
                                        All training certificates and their expiry status
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        {employee.trainingCertificates?.map((cert) => {
                                            const status = getCertificateStatus(cert.expiryDate);
                                            return (
                                                <div key={cert.id} className="p-4 border rounded-lg">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h4 className="font-semibold text-lg">
                                                                {cert.certificateType?.replace(/_/g, ' ')}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-sm text-muted-foreground">
                                                                    Expires: {formatDate(cert.expiryDate)}
                                                                </span>
                                                                {getStatusBadge(status.status)}
                                                            </div>
                                                        </div>
                                                        {cert.attachment && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handlePreview(cert)}
                                                            >
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {status.isExpiringSoon && !status.isExpired && (
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                                            <p className="text-yellow-800 text-sm">
                                                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                                                This certificate expires in {status.daysUntilExpiry} days
                                                            </p>
                                                        </div>
                                                    )}

                                                    {status.isExpired && (
                                                        <div className="bg-red-50 border border-red-200 rounded p-3">
                                                            <p className="text-red-800 text-sm">
                                                                <XCircle className="h-4 w-4 inline mr-1" />
                                                                This certificate expired {Math.abs(status.daysUntilExpiry)} days ago
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {(!employee.trainingCertificates || employee.trainingCertificates.length === 0) && (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>No training certificates found for this employee.</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Additional Certificates Tab */}
                        <TabsContent value="additional">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Additional Certificates
                                    </CardTitle>
                                    <CardDescription>
                                        All additional certificates and their expiry status
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        {employee.additionalCertificates?.map((cert) => {
                                            const status = getCertificateStatus(cert.expiryDate);
                                            return (
                                                <div key={cert.id} className="p-4 border rounded-lg">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h4 className="font-semibold text-lg">
                                                                {cert.certificateName}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-sm text-muted-foreground">
                                                                    Expires: {formatDate(cert.expiryDate)}
                                                                </span>
                                                                {getStatusBadge(status.status)}
                                                            </div>
                                                        </div>
                                                        {cert.attachment && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handlePreview(cert)}
                                                            >
                                                                <Eye className="h-4 w-4 mr-2" />
                                                                View
                                                            </Button>
                                                        )}
                                                    </div>

                                                    {status.isExpiringSoon && !status.isExpired && (
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                                            <p className="text-yellow-800 text-sm">
                                                                <AlertTriangle className="h-4 w-4 inline mr-1" />
                                                                This certificate expires in {status.daysUntilExpiry} days
                                                            </p>
                                                        </div>
                                                    )}

                                                    {status.isExpired && (
                                                        <div className="bg-red-50 border border-red-200 rounded p-3">
                                                            <p className="text-red-800 text-sm">
                                                                <XCircle className="h-4 w-4 inline mr-1" />
                                                                This certificate expired {Math.abs(status.daysUntilExpiry)} days ago
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {(!employee.additionalCertificates || employee.additionalCertificates.length === 0) && (
                                            <div className="text-center py-8 text-muted-foreground">
                                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                                <p>No additional certificates found for this employee.</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </main>
            <Footer />
        </div>
    );
}