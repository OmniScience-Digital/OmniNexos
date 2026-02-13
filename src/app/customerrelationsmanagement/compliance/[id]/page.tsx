import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search, Users, FileText, Plus, Minus, ArrowLeft, Pencil, Check, X } from "lucide-react";
import { type Employee, MEDICAL_CERTIFICATE_TYPES, TRAINING_CERTIFICATE_TYPES } from "@/types/hrd.types";
import { client } from "@/services/schema";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import { useParams, useNavigate } from "react-router-dom";
import Loading from "@/app/stockcontrolform/Components/component_loading";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { getInitials } from "@/utils/helper/helper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PrimaryDoc from "../../Components/employeeDocs";
import SiteAdditional from "../../Components/siteadditionalDoc";
import VehicleDocs from "../../Components/vehicleDocs";
import TabsHistory from "@/components/table/tabshistory";
import type { ComplianceAdditionals } from "@/types/crm.types";
import { Textarea } from "@/components/ui/textarea";
import ResponseModal from "@/components/widgets/response";
import { useAuth } from "@/contexts/auth-context";

export default function Compliance() {
    const navigate = useNavigate();
    const params = useParams();
    const { user } = useAuth();

    const customerSiteId = decodeURIComponent(params.id as string);
    const [siteName, setSiteName] = useState("");
    const [siteLocation, setSiteLocation] = useState("");

    const [rating, setCompRating] = useState(0);
    const [thirtydayrating, setthirtyCompRating] = useState(0);

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
    const [complianceData, setComplianceData] = useState<any>(null);

    const [linkingLoading, setLinkingLoading] = useState(false);
    const [unlinkingLoading, setUnlinkingLoading] = useState(false);

    const [selectedRequirements, setSelectedRequirements] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [searchReqTerm, setSearchReqTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState<string>("");

    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");

    const [requirementTypes, setRequirementTypes] = useState<string[]>([]);
    //vehicles
    const [vehicles, setVehicles] = useState<any[]>([]);

    //site additional documents 
    const [existingdocs, setAdditionalDocs] = useState<ComplianceAdditionals[]>([]);
    const [editingNotes, setEditingNotes] = useState(false);


    // Fetch employees from your Employee model with relations
    useEffect(() => {
        const fetchSite = async () => {
            try {
                // Fetch all data concurrently
                const [customerSitesResult, additionalListResult, complianceResult, siteVehiclesResult] = await Promise.all([
                    client.models.CustomerSite.list({
                        filter: { id: { eq: customerSiteId } }
                    }),
                    client.models.EmployeeAdditionalList.list(),
                    client.models.Compliance.list({
                        filter: { customerSiteId: { eq: customerSiteId } }
                    }),
                    client.models.Fleet.list(),
                ]);

                const { data: customerSites } = customerSitesResult;
                const { data: additionalList } = additionalListResult;
                const { data: complianceRecords } = complianceResult;
                const { data: vehicleseRecords } = siteVehiclesResult;

                setVehicles(vehicleseRecords || []);

                const firstRecord = complianceRecords?.[0];

                setCompRating(parseFloat(firstRecord?.complianceRating ?? "0"));
                setthirtyCompRating(parseFloat(firstRecord?.complianceRating30Days ?? "0"));


                const additionalCertNames = additionalList?.map(item => item.certificateName.toUpperCase()) || [];

                // Sort and set requirement types
                const sortedRequirements = [
                    ...MEDICAL_CERTIFICATE_TYPES,
                    ...TRAINING_CERTIFICATE_TYPES,
                    ...additionalCertNames,
                    "DRIVERS_LICENSE",
                    "PASSPORT",
                    "PDP",
                    "CURRICULUM_VITAE",
                    "PPE_LIST"
                ].sort((a, b) => formatRequirementName(a).localeCompare(formatRequirementName(b)));

                setRequirementTypes(sortedRequirements);

                if (customerSites.length > 0) {
                    const site = customerSites[0];
                    setSiteName(site.siteName);
                    setSiteLocation(site.siteLocation || "");

                    if (complianceRecords.length > 0) {
                        const compliance = complianceRecords[0];
                        setComplianceData({
                            ...compliance
                        });

                        // Set notes immediately after
                        setNotes(compliance.notes || "");

                        // FETCH SITE ADDITIONAL DOCS HERE - AFTER complianceData is set
                        if (compliance.id) {
                            const siteAdditionalsResult = await client.models.ComplianceAdditionals.listComplianceAdditionalsByComplianceid({
                                complianceid: compliance.id
                            });

                            if (siteAdditionalsResult.data) {
                                setAdditionalDocs(siteAdditionalsResult.data as ComplianceAdditionals[]);
                            }
                        }


                        if (compliance.linkedEmployees) {
                            const validEmployeeIds = compliance.linkedEmployees.filter((id): id is string => id !== null);
                            setSelectedEmployees(new Set(validEmployeeIds));
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching site:", error);
            }
        };


        const fetchEmployeesWithRelations = async () => {
            try {
                // Fetch all employees
                const { data: employeeItems } = await client.models.Employee.list();

                if (!employeeItems) return;

                // Fetch relations for all employees in parallel
                const employeesWithRelations = await Promise.all(
                    employeeItems.map(async (employee) => {
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
                            id: employee.id,
                            employeeId: employee.employeeId,
                            employeeNumber: employee.employeeNumber ?? undefined,
                            firstName: employee.firstName,
                            surname: employee.surname,
                            knownAs: employee.knownAs ?? undefined,
                            passportNumber: employee.passportNumber ?? undefined,
                            passportExpiry: employee.passportExpiry ?? undefined,
                            passportAttachment: employee.passportAttachment ?? undefined,
                            driversLicenseCode: employee.driversLicenseCode ?? undefined,
                            driversLicenseExpiry: employee.driversLicenseExpiry ?? undefined,
                            driversLicenseAttachment: employee.driversLicenseAttachment ?? undefined,
                            authorizedDriver: employee.authorizedDriver ?? false,
                            pdpExpiry: employee.pdpExpiry ?? undefined,
                            pdpAttachment: employee.pdpAttachment ?? undefined,
                            cvAttachment: employee.cvAttachment ?? undefined,
                            ppeListAttachment: employee.ppeListAttachment ?? undefined,
                            ppeExpiry: employee.ppeExpiry ?? undefined,
                            employeeIdAttachment: employee.employeeIdAttachment ?? undefined,
                            medicalCertificates: medicalCertificates || [],
                            trainingCertificates: trainingCertificates || [],
                            additionalCertificates: additionalCertificates || []
                        } as Employee;
                    })
                );
                setEmployees(employeesWithRelations);
                setLoading(false);
            } catch (error) {
                console.error("Error fetching employees with relations:", error);
                setLoading(false);
            }
        };

        fetchSite();
        fetchEmployeesWithRelations();
    }, [customerSiteId]);


    const filteredEmployees = employees.filter(employee =>
        `${employee.firstName} ${employee.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredRequirements = requirementTypes.filter(item =>
        item.toLowerCase().includes(searchReqTerm.toLowerCase())
    );


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

    const toggleEmployee = (employeeId: string) => {
        const newSelected = new Set(selectedEmployees);
        if (newSelected.has(employeeId)) {
            newSelected.delete(employeeId);
        } else {
            newSelected.add(employeeId);
        }
        setSelectedEmployees(newSelected);
    };

    const toggleRequirement = (requirement: string) => {
        const newSelected = new Set(selectedRequirements);
        if (newSelected.has(requirement)) {
            newSelected.delete(requirement);
        } else {
            newSelected.add(requirement);
        }
        setSelectedRequirements(newSelected);
    };

    const formatRequirementName = (requirement: string) => {
        return requirement
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/\b(\d)\s(\d)\b/g, '$1.$2');
    };

    const handleLinkRequirements = async () => {
        if (selectedEmployees.size === 0 || selectedRequirements.size === 0) return;
        setLinkingLoading(true);
        try {
            // Check if compliance record already exists for this customerSiteId
            const { data: existingCompliance } = await client.models.Compliance.list({
                filter: { customerSiteId: { eq: customerSiteId } }
            });

            // Get employee names for history BEFORE we process the link
            const employeeNames: string[] = [];
            Array.from(selectedEmployees).forEach(employeeId => {
                const employee = employees.find(emp => emp.id === employeeId);
                if (employee) {
                    employeeNames.push(`${employee.firstName} ${employee.surname}`);
                }
            });

            // Start with existing employeeLookup or create new one
            let employeeLookup: Record<string, string[]> = {};
            if (existingCompliance?.[0]?.employeeLookup) {
                try {
                    employeeLookup = JSON.parse(existingCompliance[0].employeeLookup);
                } catch (error) {
                    console.error("Error parsing existing employee lookup:", error);
                }
            }


            // Merge new requirements with existing ones for each employee
            Array.from(selectedEmployees).forEach(employeeId => {
                const existingReqs = employeeLookup[employeeId] || [];
                const newReqs = Array.from(selectedRequirements);
                // Combine and remove duplicates
                employeeLookup[employeeId] = Array.from(new Set([...existingReqs, ...newReqs]));
            });

            // Map requirement types to exact field names in your schema
            const requirementFieldMap: Record<string, string> = {
                "CLINIC_PLUS": "clinicPlusRqd",
                "CLINIC_PLUS_INDUCTION": "clinicPlusInductionRqd",
                "DRIVERS_LICENSE": "driversLicenseRqd",
                "FIREFIGHTING": "firefightingRqd",
                "FIRST_AID_LEVEL_1": "firstAidLevel1Rqd",
                "FIRST_AID_LEVEL_2": "firstAidLevel2Rqd",
                "HEARTLY_HEALTH": "heartlyHealthRqd",
                "KLIPSPRUIT_MEDICAL": "klipspruitMedicalRqd",
                "LEGAL_LIABILITY": "legalLiabilityRqd",
                "LUYUYO_MEDICAL": "luvuyoMedicalRqd",
                "OEM_CERT": "oemCertRqd",
                "PASSPORT": "passportRqd",
                "PDP": "pdpRqd",
                "SATS_CONVEYOR": "satsConveyorRqd",
                "SATS_COP_SOP": "satsCopSopRqd",
                "WILGE_VXR": "wilgeVxrRqd",
                "WORKING_AT_HEIGHTS": "workingAtHeightsRqd",
                "WORKING_WITH_HAND_TOOLS": "workingWithHandToolsRqd",
                "WORKING_WITH_POWER_TOOLS": "workingWithPowerToolsRqd",
                "APPOINTMENT_2_9_2": "appointment292Rqd",
                "CURRICULUM_VITAE": "curriculumVitaeRqd",
                "PPE_LIST": "ppeListRqd",
                "OHS_ACT": "ohsActRqd",
                "MHSA": "mhsaRqd",
                "KRIEL_MEDICAL": "krielMedicalRqd",
                "PRO_HEALTH_MEDICAL": "proHealthMedicalRqd",
                "SATS_ILOT": "satsIlotRqd",
                "HIRA_TRAINING": "hiraTrainingRqd",

            };

            // Prepare the compliance data
            const complianceData: any = {
                customerSiteId: customerSiteId,
                employeeLookup: JSON.stringify(employeeLookup)
            };

            // Add/merge employee IDs to linkedEmployees array
            const existingLinkedEmployees = (existingCompliance?.[0] as any)?.linkedEmployees || [];
            complianceData.linkedEmployees = Array.from(new Set([...existingLinkedEmployees, ...Array.from(selectedEmployees)]));

            // Add/merge employee IDs to each requirement array using correct field names
            Array.from(selectedRequirements).forEach(requirement => {
                const fieldName = requirementFieldMap[requirement];
                if (fieldName) {
                    const existingEmployees = (existingCompliance?.[0] as any)?.[fieldName] || [];
                    complianceData[fieldName] = Array.from(new Set([...existingEmployees, ...Array.from(selectedEmployees)]));
                }
            });

            // Update existing record or create new one

            if (existingCompliance?.[0]?.id) {
                await client.models.Compliance.update({
                    id: existingCompliance[0].id,
                    ...complianceData
                });
            } else {
                await client.models.Compliance.create(complianceData);
            }

            // Reset selection
            setSelectedEmployees(new Set());
            setSelectedRequirements(new Set());
            // After the compliance update is successful, add history
            const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

            // Get requirement names for history
            const requirementNames = Array.from(selectedRequirements).map(req =>
                req.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            );


            const historyEntry = `\nCRM Dashboard :${user?.preferred_username} linked ${employeeNames.join(', ')} to requirements: ${requirementNames.join(', ')} at ${johannesburgTime}`;

            // Save to database
            await client.models.History.create({
                entityType: "COMPLIANCE",
                entityId: customerSiteId,
                action: "LINK",
                timestamp: new Date().toISOString(),
                updatedBy: user?.preferred_username || user?.email,
                details: historyEntry
            });

            // Refresh compliance data
            const { data: updatedCompliance } = await client.models.Compliance.list({
                filter: { customerSiteId: { eq: customerSiteId } }
            });
            if (updatedCompliance.length > 0) {
                setComplianceData(updatedCompliance[0]);
            }

        } catch (error) {
            console.error("Error linking requirements:", error);
        } finally {
            setLinkingLoading(false);
        }
    };

    const handleUnlinkRequirements = async () => {
        if (selectedEmployees.size === 0 || selectedRequirements.size === 0) return;
        setUnlinkingLoading(true);


        try {
            // Check if compliance record already exists for this customerSiteId
            const { data: existingCompliance } = await client.models.Compliance.list({
                filter: { customerSiteId: { eq: customerSiteId } }
            });

            if (!existingCompliance?.[0]?.id) {
                console.log("No compliance record found to unlink from");
                return;
            }
            // Get employee names for history BEFORE we process the unlink
            const employeeNames: string[] = [];
            Array.from(selectedEmployees).forEach(employeeId => {
                const employee = employees.find(emp => emp.id === employeeId);
                if (employee) {
                    employeeNames.push(`${employee.firstName} ${employee.surname}`);
                }
            });
            // Get requirement names for history
            const requirementNames = Array.from(selectedRequirements).map(req =>
                req.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            );
            const compliance = existingCompliance[0];

            // Map requirement types to exact field names in your schema
            const requirementFieldMap: Record<string, string> = {
                "CLINIC_PLUS": "clinicPlusRqd",
                "CLINIC_PLUS_INDUCTION": "clinicPlusInductionRqd",
                "DRIVERS_LICENSE": "driversLicenseRqd",
                "FIREFIGHTING": "firefightingRqd",
                "FIRST_AID_LEVEL_1": "firstAidLevel1Rqd",
                "FIRST_AID_LEVEL_2": "firstAidLevel2Rqd",
                "HEARTLY_HEALTH": "heartlyHealthRqd",
                "KLIPSPRUIT_MEDICAL": "klipspruitMedicalRqd",
                "LEGAL_LIABILITY": "legalLiabilityRqd",
                "LUYUYO_MEDICAL": "luvuyoMedicalRqd",
                "OEM_CERT": "oemCertRqd",
                "PASSPORT": "passportRqd",
                "PDP": "pdpRqd",
                "SATS_CONVEYOR": "satsConveyorRqd",
                "SATS_COP_SOP": "satsCopSopRqd",
                "WILGE_VXR": "wilgeVxrRqd",
                "WORKING_AT_HEIGHTS": "workingAtHeightsRqd",
                "WORKING_WITH_HAND_TOOLS": "workingWithHandToolsRqd",
                "WORKING_WITH_POWER_TOOLS": "workingWithPowerToolsRqd",
                "APPOINTMENT_2_9_2": "appointment292Rqd",
                "CURRICULUM_VITAE": "curriculumVitaeRqd",
                "PPE_LIST": "ppeListRqd",
                "OHS_ACT": "ohsActRqd",
                "MHSA": "mhsaRqd",
                "KRIEL_MEDICAL": "krielMedicalRqd",
                "PRO_HEALTH_MEDICAL": "proHealthMedicalRqd",
                "SATS_ILOT": "satsIlotRqd",
                "HIRA_TRAINING": "hiraTrainingRqd"
            };

            // Prepare the compliance data for unlinking
            const complianceData: any = {
                id: compliance.id,
                customerSiteId: customerSiteId
            };

            // Remove employee IDs from linkedEmployees array
            const existingLinkedEmployees = (compliance as any)?.linkedEmployees || [];
            complianceData.linkedEmployees = existingLinkedEmployees.filter(
                (empId: string) => !selectedEmployees.has(empId)
            );

            // Remove employee IDs from each requirement array
            Array.from(selectedRequirements).forEach(requirement => {
                const fieldName = requirementFieldMap[requirement];
                if (fieldName) {
                    const existingEmployees = (compliance as any)?.[fieldName] || [];
                    complianceData[fieldName] = existingEmployees.filter(
                        (empId: string) => !selectedEmployees.has(empId)
                    );
                }
            });

            // Update employeeLookup to remove the unlinked requirements
            if (compliance.employeeLookup) {
                try {
                    const existingLookup = JSON.parse(compliance.employeeLookup);
                    const updatedLookup = { ...existingLookup };

                    Array.from(selectedEmployees).forEach(employeeId => {
                        if (updatedLookup[employeeId]) {
                            updatedLookup[employeeId] = updatedLookup[employeeId].filter(
                                (req: string) => !selectedRequirements.has(req)
                            );
                            // Remove employee from lookup if they have no requirements left
                            if (updatedLookup[employeeId].length === 0) {
                                delete updatedLookup[employeeId];
                            }
                        }
                    });

                    complianceData.employeeLookup = JSON.stringify(updatedLookup);
                } catch (error) {
                    console.error("Error parsing employee lookup:", error);
                }
            }

            // Update the compliance record
            await client.models.Compliance.update(complianceData);

            // After the compliance update is successful, add history  
            const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

            const historyEntry = `\nCRM Dashboard : ${user?.preferred_username} unlinked ${employeeNames.join(', ')} from requirements: ${requirementNames.join(', ')} at ${johannesburgTime}`;

            // Save to database
            await client.models.History.create({
                entityType: "COMPLIANCE",
                entityId: customerSiteId,
                action: "UNLINK",
                timestamp: new Date().toISOString(),
                updatedBy: user?.preferred_username || user?.email,
                details: historyEntry
            });



            // Reset selection
            setSelectedEmployees(new Set());
            setSelectedRequirements(new Set());

            // Refresh compliance data
            const { data: updatedCompliance } = await client.models.Compliance.list({
                filter: { customerSiteId: { eq: customerSiteId } }
            });
            if (updatedCompliance.length > 0) {
                setComplianceData(updatedCompliance[0]);
            }

        } catch (error) {
            console.error("Error unlinking requirements:", error);
        } finally {
            setUnlinkingLoading(false);
        }
    };


    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
    };

    const saveNotes = async () => {

        try {
            const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

            // Update notes if they've changed - ALWAYS update if we're in edit mode
            if (notes.trim() !== (complianceData?.notes || "").trim()) {

                try {
                    // First update the database
                    await client.models.Compliance.update({
                        id: complianceData.id,
                        notes: notes
                    });


                    // Create history entry
                    await client.models.History.create({
                        entityType: "COMPLIANCE",
                        entityId: complianceData?.customerSiteId,
                        action: "UPDATE_NOTES",
                        timestamp: new Date().toISOString(),
                        updatedBy: user?.preferred_username || user?.email,
                        details: `\nCRM Dashboard :${user?.preferred_username} UPDATED compliance notes at ${johannesburgTime}\nNew notes: ${notes}\n`
                    });


                } catch (error) {
                    console.error("Failed to update notes:", error);
                    throw error;
                }
            } else {
                setMessage(`No changes to save`);
                setSuccessful(true);
                setShow(true);

            }
        } catch (error) {
            console.error("Error in saveNotes:", error);
        } finally {
            setEditingNotes(false);

        }
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <Navbar />
            <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
                <div className="container mx-auto max-w-7xl mt-4">

                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/customerrelationsmanagement')}
                                className="h-9 w-9 p-0 relative hover:scale-105 active:scale-95 transition-transform duration-150">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">
                                    {siteName} Compliance Management
                                </h1>
                                <p className="text-muted-foreground text-base">Link employees to required documents and certificates</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Sidebar */}
                        <div className="lg:col-span-1">
                            <Card className="sticky top-24">
                                <CardContent className="p-6">
                                    <div className="text-center mb-6">
                                        <Avatar className="h-24 w-24 border-4 border-white shadow-lg mx-auto mb-4">
                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xl font-bold">
                                                {getInitials(siteName || 'Site')}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="text-center">
                                            <h3 className="font-semibold">
                                                {siteName || 'Site Name'}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {siteLocation || 'Site Location'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">

                                        <div className="pt-4">
                                            <Label className="mb-2 block">Site Summary</Label>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span>Compliance Rating :</span>

                                                    <Badge
                                                        className={
                                                            rating < 90
                                                                ? "bg-red-600 dark:bg-red-500 text-white"
                                                                : "bg-black dark:bg-black text-white"
                                                        }
                                                    >
                                                        {rating} %
                                                    </Badge>
                                                </div>

                                                <div className="flex justify-between">
                                                    <span>Compliance Rating - 30 days :</span>

                                                    <Badge
                                                        className={
                                                            thirtydayrating < 90
                                                                ? "bg-red-600 dark:bg-red-500 text-white"
                                                                : "bg-black dark:bg-black text-white"
                                                        }
                                                    >
                                                        {thirtydayrating} %
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
                            <Tabs defaultValue="basic" className="w-[100%]">
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="basic" className="cursor-pointer">Config</TabsTrigger>
                                    <TabsTrigger value="viewdocs" className="cursor-pointer">Employees Docs</TabsTrigger>
                                    <TabsTrigger value="vehicledocs" className="cursor-pointer">Vehicle Docs</TabsTrigger>
                                    <TabsTrigger value="history" className="cursor-pointer">History</TabsTrigger>
                                </TabsList>
                                <TabsContent value="basic">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Employees Section */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Users className="h-5 w-5" />
                                                    Employees ({employees.length})
                                                </CardTitle>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                                    <Input
                                                        placeholder="Search by name, ID, or number..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </CardHeader>
                                            {loading ? (<Loading />) : (
                                                <CardContent>
                                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                                        {filteredEmployees.map((employee) => (
                                                            <div
                                                                key={employee.id}
                                                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors bg-background ${selectedEmployees.has(employee.id)
                                                                    ? "hover:border-blue-200"
                                                                    : "hover:border-gray-200 "
                                                                    }`}
                                                                onClick={() => toggleEmployee(employee.id)}
                                                            >
                                                                <Checkbox
                                                                    checked={selectedEmployees.has(employee.id)}
                                                                    onChange={() => toggleEmployee(employee.id)}
                                                                />
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-medium text-sm truncate  text-foreground">
                                                                        {employee.firstName} {employee.surname}
                                                                        {employee.knownAs && ` (${employee.knownAs})`}
                                                                    </p>
                                                                    <div className="flex gap-2 text-xs text-gray-500 ">
                                                                        <span>ID: {employee.employeeId}</span>
                                                                        {employee.employeeNumber && <span>• #{employee.employeeNumber}</span>}
                                                                    </div>
                                                                </div>
                                                                <Badge variant={selectedEmployees.has(employee.id) ? "default" : "outline"}>
                                                                    {selectedEmployees.has(employee.id) ? "Selected" : "Select"}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {selectedEmployees.size > 0 && (
                                                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                                            <p className="text-sm font-medium text-blue-900">
                                                                {selectedEmployees.size} employee(s) selected
                                                            </p>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            )}
                                        </Card>

                                        {/* Requirements Section */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <FileText className="h-5 w-5" />
                                                    Requirements ({requirementTypes.length})
                                                </CardTitle>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                                    <Input
                                                        placeholder="Search by requirement..."
                                                        value={searchReqTerm}
                                                        onChange={(e) => setSearchReqTerm(e.target.value)}
                                                        className="pl-10"
                                                    />
                                                </div>
                                            </CardHeader>
                                            {loading ? (<Loading />) : (
                                                <CardContent>
                                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                                        {filteredRequirements.map((requirement) => {
                                                            const isLinkedToSelected = Array.from(selectedEmployees).some(empId =>
                                                                getEmployeeRequirements(empId).includes(requirement)
                                                            );

                                                            return (
                                                                <div
                                                                    key={requirement}
                                                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors bg-background ${selectedRequirements.has(requirement) || isLinkedToSelected
                                                                        ? "border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
                                                                        : "hover:border-gray-200 dark:hover:border-gray-600"
                                                                        }`}
                                                                    onClick={() => toggleRequirement(requirement)}
                                                                >
                                                                    <Checkbox
                                                                        checked={selectedRequirements.has(requirement)}
                                                                        onChange={() => toggleRequirement(requirement)}
                                                                    />
                                                                    <div className="flex-1">
                                                                        <p className="font-medium text-sm">
                                                                            {formatRequirementName(requirement)}
                                                                        </p>
                                                                        {isLinkedToSelected && (
                                                                            <p className="text-xs text-blue-600 mt-1">
                                                                                Already linked to selected employees
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                    <Badge variant={
                                                                        selectedRequirements.has(requirement) ? "default" :
                                                                            isLinkedToSelected ? "secondary" : "outline"
                                                                    }>
                                                                        {selectedRequirements.has(requirement) ? "Selected" :
                                                                            isLinkedToSelected ? "Linked" : "Select"}
                                                                    </Badge>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {selectedRequirements.size > 0 && (
                                                        <div className="mt-4 p-3 bg-green-50 rounded-lg">
                                                            <p className="text-sm font-medium text-green-900">
                                                                {selectedRequirements.size} requirement(s) selected
                                                            </p>
                                                        </div>
                                                    )}


                                                </CardContent>
                                            )}
                                        </Card>
                                    </div>
                                    {/* Action Section */}

                                    <Card className="mt-4">
                                        <CardContent className="pt-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold">Manage Employee Requirements</h3>
                                                    <p className="text-sm text-gray-600">
                                                        {selectedEmployees.size} employees × {selectedRequirements.size} requirements
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={handleUnlinkRequirements}
                                                        disabled={selectedEmployees.size === 0 || selectedRequirements.size === 0 || unlinkingLoading || linkingLoading}
                                                        variant="outline"
                                                        className="flex items-center gap-2"
                                                    >
                                                        {unlinkingLoading ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                                        ) : (
                                                            <Minus className="h-4 w-4" />
                                                        )}
                                                        {unlinkingLoading ? "Unlinking..." : "Unlink Requirements"}
                                                    </Button>
                                                    <Button
                                                        onClick={handleLinkRequirements}
                                                        disabled={selectedEmployees.size === 0 || selectedRequirements.size === 0 || linkingLoading || unlinkingLoading}
                                                        className="flex items-center gap-2"
                                                    >
                                                        {linkingLoading ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                                        ) : (
                                                            <Plus className="h-4 w-4" />
                                                        )}
                                                        {linkingLoading ? "Linking..." : "Link Requirements"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>

                                    </Card>
                                    <Card className="mt-2">
                                        <CardContent >
                                            {/* Notes Section */}

                                            <div className="mt-2 pt-4">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-sm font-medium">Compliance Notes</label>

                                                    {/* EDIT / SAVE / CANCEL BUTTONS */}
                                                    {!editingNotes ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setEditingNotes(true)}
                                                            className="text-blue-600 hover:text-blue-800"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    saveNotes();
                                                                }}
                                                                className="text-green-600 hover:text-green-800"
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </Button>

                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setNotes(complianceData?.notes || "");
                                                                    setEditingNotes(false);
                                                                }}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <Textarea
                                                    value={notes}
                                                    onChange={handleNotesChange}
                                                    disabled={!editingNotes}
                                                    className={`min-h-[80px] text-sm resize-vertical ${!editingNotes ? "bg-muted cursor-not-allowed" : ""
                                                        }`}
                                                    placeholder="Additional notes about site compliance..."
                                                />
                                            </div>

                                        </CardContent>
                                    </Card>
                                    <SiteAdditional complianceData={complianceData} complianceexistingdocs={existingdocs} loading={loading} />
                                </TabsContent>

                                <TabsContent value="viewdocs">
                                    <PrimaryDoc employees={employees} complianceData={complianceData} />
                                </TabsContent>
                                <TabsContent value="vehicledocs">
                                    <VehicleDocs vehicles={vehicles} complianceData={complianceData} onComplianceUpdate={(updatedData) => setComplianceData(updatedData)} />

                                </TabsContent>
                                <TabsContent value="history">
                                    <TabsHistory customerSiteId={customerSiteId} />

                                </TabsContent>

                            </Tabs>
                        </div>
                    </div>
                </div>
                {show && (
                    <ResponseModal
                        successful={successful}
                        message={message}
                        setShow={setShow}
                    />
                )}

            </main>
            <Footer />
        </div>
    );
}


