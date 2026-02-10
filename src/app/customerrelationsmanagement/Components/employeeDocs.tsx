import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, FileText, User, ChevronDown, Search, X, Eye } from "lucide-react";
import {type Employee } from "@/types/hrd.types";
import { formatDate, getExpiryBadgeVariant } from "@/utils/helper/time";
import { viewDoc } from "@/utils/helper/helper";

interface EmployeeSelectProps {
    employees: Employee[];
    complianceData: any;
}

export default function EmployeeSelect({ employees, complianceData }: EmployeeSelectProps) {
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredEmployees = employees.filter(employee => {
        if (!searchQuery) return true;

        const searchLower = searchQuery.toLowerCase();
        const fullName = `${employee.firstName} ${employee.surname}`.toLowerCase();
        const knownAs = employee.knownAs?.toLowerCase() || "";

        return (
            fullName.includes(searchLower) ||
            knownAs.includes(searchLower) ||
            employee.firstName.toLowerCase().includes(searchLower) ||
            employee.surname.toLowerCase().includes(searchLower)
        );
    });

    const getEmployeeRequirements = (employeeId: string): string[] => {
        if (!complianceData?.employeeLookup) return [];
        try {
            const lookup = JSON.parse(complianceData.employeeLookup);
            return lookup[employeeId] || [];
        } catch (error) {
            console.error("Error parsing employee lookup:", error);
            return [];
        }
    };

    const formatRequirementName = (requirement: string) => {
        return requirement
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/\b(\d)\s(\d)\b/g, '$1.$2');
    };

    const getRequirementDetails = (employee: Employee, requirement: string) => {
        const additionalCert = employee.additionalCertificates?.find(
            cert => cert.certificateName.toUpperCase() === requirement
        );

        if (additionalCert) {
            return {
                attachment: additionalCert.attachment,
                expiryDate: additionalCert.expiryDate
            };
        }
        const requirementMap: Record<string, { attachment?: string; expiryDate?: string }> = {

            // Medical Certificates
            CLINIC_PLUS: employee.medicalCertificates?.find(cert => cert.certificateType === "CLINIC_PLUS"),
            CLINIC_PLUS_INDUCTION: employee.medicalCertificates?.find(cert => cert.certificateType === "CLINIC_PLUS_INDUCTION"),
            HEARTLY_HEALTH: employee.medicalCertificates?.find(cert => cert.certificateType === "HEARTLY_HEALTH"),
            KLIPSPRUIT_MEDICAL: employee.medicalCertificates?.find(cert => cert.certificateType === "KLIPSPRUIT_MEDICAL"),
            LUYUYO_MEDICAL: employee.medicalCertificates?.find(cert => cert.certificateType === "LUYUYO_MEDICAL"),
            KRIEL_MEDICAL: employee.medicalCertificates?.find(cert => cert.certificateType === "KRIEL_MEDICAL"),
            PRO_HEALTH_MEDICAL: employee.medicalCertificates?.find(cert => cert.certificateType === "PRO_HEALTH_MEDICAL"),
            WILGE_VXR: employee.medicalCertificates?.find(cert => cert.certificateType === "WILGE_VXR"),

            // Training Certificates
            FIREFIGHTING: employee.trainingCertificates?.find(cert => cert.certificateType === "FIREFIGHTING"),
            FIRST_AID_LEVEL_1: employee.trainingCertificates?.find(cert => cert.certificateType === "FIRST_AID_LEVEL_1"),
            FIRST_AID_LEVEL_2: employee.trainingCertificates?.find(cert => cert.certificateType === "FIRST_AID_LEVEL_2"),
            LEGAL_LIABILITY: employee.trainingCertificates?.find(cert => cert.certificateType === "LEGAL_LIABILITY"),
            OEM_CERT: employee.trainingCertificates?.find(cert => cert.certificateType === "OEM_CERT"),
            SATS_CONVEYOR: employee.trainingCertificates?.find(cert => cert.certificateType === "SATS_CONVEYOR"),
            SATS_COP_SOP: employee.trainingCertificates?.find(cert => cert.certificateType === "SATS_COP_SOP"),
            SATS_ILOT: employee.trainingCertificates?.find(cert => cert.certificateType === "SATS_ILOT"),
            WORKING_AT_HEIGHTS: employee.trainingCertificates?.find(cert => cert.certificateType === "WORKING_AT_HEIGHTS"),
            WORKING_WITH_HAND_TOOLS: employee.trainingCertificates?.find(cert => cert.certificateType === "WORKING_WITH_HAND_TOOLS"),
            WORKING_WITH_POWER_TOOLS: employee.trainingCertificates?.find(cert => cert.certificateType === "WORKING_WITH_POWER_TOOLS"),
            APPOINTMENT_2_9_2: employee.trainingCertificates?.find(cert => cert.certificateType === "APPOINTMENT_2_9_2"),
            OHS_ACT: employee.trainingCertificates?.find(cert => cert.certificateType === "OHS_ACT"),
            MHSA: employee.trainingCertificates?.find(cert => cert.certificateType === "MHSA"),
            HIRA_TRAINING: employee.trainingCertificates?.find(cert => cert.certificateType === "HIRA_TRAINING"),

            // Direct employee fields
            DRIVERS_LICENSE: {
                attachment: employee.driversLicenseAttachment,
                expiryDate: employee.driversLicenseExpiry
            },
            PASSPORT: {
                attachment: employee.passportAttachment,
                expiryDate: employee.passportExpiry
            },
            PDP: {
                attachment: employee.pdpAttachment,
                expiryDate: employee.pdpExpiry
            },
            CURRICULUM_VITAE: {
                attachment: employee.cvAttachment
            },
            PPE_LIST: {
                attachment: employee.ppeListAttachment,
                expiryDate: employee.ppeExpiry
            }
        };

        return requirementMap[requirement] || {};
    };



    const clearSearch = () => {
        setSearchQuery("");
        inputRef.current?.focus();
    };

    const handleEmployeeSelect = (employeeId: string) => {
        setSelectedEmployeeId(employeeId);
        setIsDropdownOpen(false);
        setSearchQuery("");
    };

    const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
    const selectedEmployeeRequirements = selectedEmployeeId ? getEmployeeRequirements(selectedEmployeeId) : [];

    const getSelectedEmployeeDisplayName = () => {
        if (!selectedEmployee) return "Choose an employee...";
        return `${selectedEmployee.firstName} ${selectedEmployee.surname}${selectedEmployee.knownAs ? ` (${selectedEmployee.knownAs})` : ''}`;
    };

    return (
        <div className="space-y-6">
            {/* Employee Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Select Employee
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative" ref={dropdownRef}>
                        {/* Custom Dropdown Trigger */}
                        <div
                            className="flex items-center justify-between w-full px-2 py-1 border border-input rounded-md bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                            <span className={selectedEmployee ? "text-foreground text-sm" : "text-muted-foreground text-sm"}>
                                {getSelectedEmployeeDisplayName()}
                            </span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Dropdown Content */}
                        {isDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 border border-input bg-background rounded-md shadow-lg z-50 max-h-60 overflow-auto">
                                {/* Search Input */}
                                <div className="p-2 border-b">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            ref={inputRef}
                                            type="text"
                                            placeholder="Search employees..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 pr-5"
                                            autoFocus
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={clearSearch}
                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Employee List */}
                                <div className="py-1">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="p-3 text-center text-muted-foreground">
                                            No employees found
                                        </div>
                                    ) : (
                                        filteredEmployees.map((employee) => (
                                            <div
                                                key={employee.id}
                                                className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent  text-sm ${selectedEmployeeId === employee.id ? 'bg-accent' : ''
                                                    }`}
                                                onClick={() => handleEmployeeSelect(employee.id)}
                                            >
                                                <span>
                                                    {employee.firstName} {employee.surname}
                                                    {employee.knownAs && ` (${employee.knownAs})`}
                                                </span>
                                                <Badge variant="secondary" className="ml-2">
                                                    {getEmployeeRequirements(employee.id).length}
                                                </Badge>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Search Results Count */}
                                {searchQuery && (
                                    <div className="p-2 border-t text-sm text-muted-foreground">
                                        Found {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>


            {/* Requirements Display */}
            {selectedEmployee && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-content">
                            <CardTitle className="flex justify-between items-center w-full">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    <span>
                                        Requirements for {selectedEmployee.firstName} {selectedEmployee.surname}
                                    </span>
                                </div>

                            </CardTitle>


                        </CardTitle>
                    </CardHeader>
                    <CardContent>

                        {selectedEmployeeRequirements.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No requirements linked to this employee
                            </div>

                        ) : (
                            <div className="space-y-4">
                                {selectedEmployeeRequirements.map((requirement) => {
                                    const details = getRequirementDetails(selectedEmployee, requirement);
                                    const hasAttachment = !!details.attachment;
                                    const hasExpiry = !!details.expiryDate;

                                    return (
                                        <div
                                            key={requirement}
                                            className="flex items-center justify-between p-4 rounded-lg border bg-card"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h4 className="font-medium">
                                                        {formatRequirementName(requirement)}
                                                    </h4>
                                                    {hasExpiry && (
                                                        <Badge variant={getExpiryBadgeVariant(details.expiryDate)}>
                                                            <Calendar className="h-3 w-3 mr-1" />
                                                            {formatDate(details.expiryDate)}
                                                        </Badge>
                                                    )}
                                                    {!hasExpiry && (
                                                        <Badge variant="secondary">No expiry</Badge>
                                                    )}
                                                </div>

                                                {hasAttachment ? (
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-green-600" />
                                                        <span className="text-sm text-muted-foreground">
                                                            Document available
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4 text-red-600" />
                                                        <span className="text-sm text-muted-foreground">
                                                            No document uploaded
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {hasAttachment && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => viewDoc(details.attachment || '')}
                                                    >
                                                        <Eye className="h-4 w-4 mr-1" />
                                                        View
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}