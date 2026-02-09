import { client } from "@/services/schema";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Trash2, ArrowLeft, Car, Loader2, X } from "lucide-react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Fleet } from "@/types/vifForm.types";
import { PDFUpload } from "@/app/vehicleinspectionform/components/pdfupload";
import { getUrl } from "aws-amplify/storage";
import { formatDateForAmplify } from "@/utils/helper/time";

export default function FleetEditPage() {
    const navigate = useNavigate();
    const params = useParams();
    const fleetId = decodeURIComponent(params.id as string);
    const editFormRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [fleet, setFleet] = useState<Fleet | null>(null);
    const [editedFleet, setEditedFleet] = useState<Partial<Fleet>>({});
    const [saving, setSaving] = useState(false);
    const [opendelete, setOpendelete] = useState(false);

    const [history, setHistory] = useState("");

    // function to convert S3 keys to URLs for PDFs
    const getS3DocumentUrls = async (s3Keys: string[]): Promise<string[]> => {
        if (!s3Keys || s3Keys.length === 0) return [];

        const urls = await Promise.all(
            s3Keys.map(async (key) => {
                try {
                    const { url } = await getUrl({
                        path: key
                    });
                    return url.toString();
                } catch (error) {
                    console.error('Error getting URL for document', key, error);
                    return '';
                }
            })
        );
        return urls.filter(url => url !== '');
    };


    useEffect(() => {
        const fetchFleet = async () => {
            try {

                const { data: fleetData } = await client.models.Fleet.get({ id: fleetId });

                if (fleetData) {

                    // Convert S3 keys to actual URLs for documents
                    const s3Keys = fleetData.breakandLuxTest ? [fleetData.breakandLuxTest] : [];
                    const documentUrls = await getS3DocumentUrls(s3Keys);

                    const mappedFleet: Fleet = {
                        id: fleetData.id,
                        vehicleVin: fleetData.vehicleVin,
                        vehicleReg: fleetData.vehicleReg,
                        vehicleMake: fleetData.vehicleMake,
                        vehicleModel: fleetData.vehicleModel,
                        transmitionType: fleetData.transmitionType,
                        ownershipStatus: fleetData.ownershipStatus,
                        fleetIndex: fleetData.fleetIndex,
                        fleetNumber: fleetData.fleetNumber,
                        lastServicedate: fleetData.lastServicedate,
                        lastServicekm: fleetData.lastServicekm,
                        lastRotationdate: fleetData.lastRotationdate,
                        lastRotationkm: fleetData.lastRotationkm,
                        servicePlanStatus: fleetData.servicePlanStatus ?? false,
                        servicePlan: fleetData.servicePlan,
                        currentDriver: fleetData.currentDriver,
                        currentkm: fleetData.currentkm,
                        codeRequirement: fleetData.codeRequirement,
                        pdpRequirement: fleetData.pdpRequirement ?? false,
                        breakandLuxTest: documentUrls[0] || '',
                        serviceplankm: fleetData.serviceplankm,
                        breakandLuxExpirey: fleetData.breakandLuxExpirey,
                        liscenseDiscExpirey: fleetData.liscenseDiscExpirey,

                    };

                    // fetch latest 20 record
                    const employeeHistory = await client.models.History.getHistoryByEntityId({
                        entityId: fleetData.id,

                    }, {
                        sortDirection: 'DESC',
                        limit: 20
                    });
                    // Convert to string format
                    const historyString = employeeHistory.data
                        .map(entry => entry.details)
                        .join('');
                    setHistory(historyString);


                    setFleet(mappedFleet);
                    setEditedFleet({ ...mappedFleet });
                }
            } catch (error) {
                console.error("Error fetching fleet:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFleet();
    }, [fleetId]);

    useEffect(() => {
        if (editFormRef.current) {
            editFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, []);

    // Handle save
    const handleSave = async () => {
        if (!fleet) return;

        try {
            setSaving(true);
            // Get user from localStorage
            let storedName = "Unknown User";
            try {
                const userData = localStorage.getItem("user");
                if (userData) {
                    storedName = userData.replace(/^"|"$/g, '').trim();
                }
            } catch (error) {
                console.error("Error getting user from localStorage:", error);
            }

            const johannesburgTime = new Date().toLocaleString("en-ZA", {
                timeZone: "Africa/Johannesburg"
            });

            let historyEntries = "";

            // Clean function that works for both create and delete
            const cleanValueForHistory = (value: any): string => {
                if (!value || value === "") return "empty";

                const str = String(value);

                // Handle comma-separated values (multiple files)
                if (str.includes(',')) {
                    return str.split(',').map(item => {
                        const part = item.trim();
                        // Extract just the filename from any path or URL
                        const filename = part.split('/').pop() || 'document';
                        return filename.split('?')[0]; // Remove query params
                    }).join(', ');
                }

                // Handle single value - just get the filename
                const filename = str.split('/').pop() || 'document';
                return filename.split('?')[0]; // Remove query params
            };

            // Create history for changes
            Object.keys(editedFleet).forEach(key => {
                const typedKey = key as keyof Fleet;
                if (editedFleet[typedKey] !== fleet[typedKey]) {
                    const oldValue = cleanValueForHistory(fleet[typedKey]);
                    const newValue = cleanValueForHistory(editedFleet[typedKey]);
                    historyEntries += `${storedName} updated ${typedKey} from ${oldValue} to ${newValue} at ${johannesburgTime}\n`;
                }
            });


            const fleetData = {
                ...fleet,
                ...editedFleet,
                lastServicedate: formatDateForAmplify(editedFleet.lastServicedate || fleet.lastServicedate),
                lastRotationdate: formatDateForAmplify(editedFleet.lastRotationdate || fleet.lastRotationdate),
                breakandLuxExpirey: formatDateForAmplify(editedFleet.breakandLuxExpirey || fleet.breakandLuxExpirey),
                liscenseDiscExpirey: formatDateForAmplify(editedFleet.liscenseDiscExpirey || fleet.liscenseDiscExpirey),
            };

            // Update existing fleet
            await client.models.Fleet.update({
                id: fleetData.id,
                vehicleVin: fleetData.vehicleVin || null,
                vehicleReg: fleetData.vehicleReg || null,
                vehicleMake: fleetData.vehicleMake || null,
                vehicleModel: fleetData.vehicleModel || null,
                transmitionType: fleetData.transmitionType || null,
                ownershipStatus: fleetData.ownershipStatus || null,
                fleetIndex: fleetData.fleetIndex || null,
                fleetNumber: fleetData.fleetNumber || null,
                lastServicedate: fleetData.lastServicedate,
                lastServicekm: fleetData.lastServicekm || null,
                lastRotationdate: fleetData.lastRotationdate,
                lastRotationkm: fleetData.lastRotationkm || null,
                servicePlanStatus: fleetData.servicePlanStatus,
                servicePlan: fleetData.servicePlan || null,
                currentDriver: fleetData.currentDriver || null,
                currentkm: fleetData.currentkm || null,
                codeRequirement: fleetData.codeRequirement || null,
                pdpRequirement: fleetData.pdpRequirement,
                breakandLuxTest: fleetData.breakandLuxTest || null,
                serviceplankm: fleetData.serviceplankm || null,
                breakandLuxExpirey: fleetData.breakandLuxExpirey,
                liscenseDiscExpirey: fleetData.liscenseDiscExpirey,
            });
            try {

                // Add History table entry
                await client.models.History.create({
                    entityType: "FLEET",
                    entityId: fleetData.id,
                    action: "UPDATE",
                    timestamp: new Date().toISOString(),
                    details: historyEntries
                });
            } catch (error) {
                console.log('Updating fleet history error ', error);
            }

            // Navigate back to list page
            navigate('/fleetmanagementsystem');

        } catch (error) {
            console.error("Error saving fleet:", error);

        } finally {
            setSaving(false);
        }
    };
    // Handle delete
    const handleDelete = async () => {
        try {
            await client.models.Fleet.delete({
                id: fleetId
            });
            setOpendelete(false);
            // Navigate back to list page after delete
            navigate('/fleetmanagementsystem');
        } catch (error) {
            console.error("Error deleting fleet:", error);
        }
    };

    const handleDeleteClick = () => {
        setOpendelete(true);
    };

    const handleConfirmWrapper = () => {
        handleDelete();
    };

    // Handle change
    const handleChange = (field: keyof Fleet, value: string | number | boolean | string[]) => {
        setEditedFleet(prev => ({ ...prev, [field]: value }));
    };



    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-background text-foreground">
                <Navbar />
                <Loading />
                <Footer />
            </div>
        );
    }

    if (!fleet) {
        return (
            <div className="flex flex-col min-h-screen bg-background text-foreground">
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <p>Vehicle not found</p>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />

            <main className="flex-1 px-2 sm:px-4 mt-20 pb-20">
                <div className="container mx-auto max-w-7xl mt-5">
                    {/* Header */}
                    <div className="mb-4 sm:mb-6">
                        <div className="flex items-center gap-3 mb-2">

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate('/fleetmanagementsystem')}
                                className="h-9 w-9 p-0 relative hover:scale-105 active:scale-95 transition-transform duration-150">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <Car className="h-5 w-5 text-primary" />
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold">
                                    {fleet.vehicleReg || fleet.fleetNumber}
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Fleet Management System
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Edit Form */}
                    <Card ref={editFormRef} className="mb-4 sm:mb-6">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <span className="text-base sm:text-lg">
                                    Edit Vehicle
                                </span>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="h-8 text-xs cursor-pointer bg-[#165b8c] text-white hover:bg-[#1e6fae] flex-1 sm:flex-none"
                                    >
                                        <Save className="h-3 w-3 mr-1" />
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            "Save"
                                        )}
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate('/fleetmanagementsystem')}
                                        className="h-8 text-xs cursor-pointer flex-1 sm:flex-none"
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Cancel
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={handleDeleteClick}
                                        className="h-8 text-xs cursor-pointer flex-1 sm:flex-none"
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {/* Basic Information */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Fleet Number *</label>
                                    <Input
                                        value={editedFleet.fleetNumber ?? fleet.fleetNumber ?? ''}
                                        onChange={(e) => handleChange("fleetNumber", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Vehicle Registration *</label>
                                    <Input
                                        value={editedFleet.vehicleReg ?? fleet.vehicleReg ?? ''}
                                        onChange={(e) => handleChange("vehicleReg", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Vehicle VIN</label>
                                    <Input
                                        value={editedFleet.vehicleVin ?? fleet.vehicleVin ?? ''}
                                        onChange={(e) => handleChange("vehicleVin", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Vehicle Make</label>
                                    <Input
                                        value={editedFleet.vehicleMake ?? fleet.vehicleMake ?? ''}
                                        onChange={(e) => handleChange("vehicleMake", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Vehicle Model</label>
                                    <Input
                                        value={editedFleet.vehicleModel ?? fleet.vehicleModel ?? ''}
                                        onChange={(e) => handleChange("vehicleModel", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Transmission Type</label>
                                    <Select
                                        value={editedFleet.transmitionType ?? fleet.transmitionType ?? ''}
                                        onValueChange={(value) => handleChange("transmitionType", value)}
                                    >
                                        <SelectTrigger className="h-9 text-sm cursor-pointer">
                                            <SelectValue placeholder="Select transmission" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Automatic" className="cursor-pointer">Automatic</SelectItem>
                                            <SelectItem value="Manual" className="cursor-pointer">Manual</SelectItem>
                                            <SelectItem value="Hybrid" className="cursor-pointer">Hybrid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ownership Status</label>
                                    <Select
                                        value={editedFleet.ownershipStatus ?? fleet.ownershipStatus ?? ''}
                                        onValueChange={(value) => handleChange("ownershipStatus", value)}
                                    >
                                        <SelectTrigger className="h-9 text-sm cursor-pointer">
                                            <SelectValue placeholder="Select ownership" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Owned" className="cursor-pointer">Owned</SelectItem>
                                            <SelectItem value="Leased" className="cursor-pointer">Leased</SelectItem>
                                            <SelectItem value="Rented" className="cursor-pointer">Rented</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* New Missing Fields */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Fleet Index</label>
                                    <Input
                                        value={editedFleet.fleetIndex ?? fleet.fleetIndex ?? ''}
                                        onChange={(e) => handleChange("fleetIndex", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Last Rotation KM</label>
                                    <Input
                                        type="number"
                                        value={editedFleet.lastRotationkm ?? fleet.lastRotationkm ?? ''}
                                        onChange={(e) => handleChange("lastRotationkm", parseFloat(e.target.value) || 0)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Service Plan</label>
                                    <Input
                                        value={editedFleet.servicePlan ?? fleet.servicePlan ?? ''}
                                        onChange={(e) => handleChange("servicePlan", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Code Requirement</label>
                                    <Input
                                        value={editedFleet.codeRequirement ?? fleet.codeRequirement ?? ''}
                                        onChange={(e) => handleChange("codeRequirement", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">PDP Requirement</label>
                                    <Select
                                        value={editedFleet.pdpRequirement?.toString() ?? fleet.pdpRequirement?.toString() ?? 'false'}
                                        onValueChange={(value) => handleChange("pdpRequirement", value === 'true')}
                                    >
                                        <SelectTrigger className="h-9 text-sm cursor-pointer">
                                            <SelectValue placeholder="Select PDP requirement" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true" className="cursor-pointer">True</SelectItem>
                                            <SelectItem value="false" className="cursor-pointer">False</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Service Plan KM</label>
                                    <Input
                                        type="number"
                                        value={editedFleet.serviceplankm ?? fleet.serviceplankm ?? ''}
                                        onChange={(e) => handleChange("serviceplankm", parseFloat(e.target.value) || 0)}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                {/* Existing Fields */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Current Driver</label>
                                    <Input
                                        value={editedFleet.currentDriver ?? fleet.currentDriver ?? ''}
                                        onChange={(e) => handleChange("currentDriver", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Current KM</label>
                                    <Input
                                        type="number"
                                        value={editedFleet.currentkm ?? fleet.currentkm ?? ''}
                                        onChange={(e) => handleChange("currentkm", parseFloat(e.target.value) || 0)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Service Plan Status</label>
                                    <Select
                                        value={editedFleet.servicePlanStatus?.toString() ?? fleet.servicePlanStatus?.toString() ?? 'false'}
                                        onValueChange={(value) => handleChange("servicePlanStatus", value === 'true')}
                                    >
                                        <SelectTrigger className="h-9 text-sm cursor-pointer">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true" className="cursor-pointer">True</SelectItem>
                                            <SelectItem value="false" className="cursor-pointer">False</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Last Service Date</label>
                                    <Input
                                        type="date"
                                        value={editedFleet.lastServicedate ?? fleet.lastServicedate ?? ''}
                                        onChange={(e) => handleChange("lastServicedate", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Last Rotation Date</label>
                                    <Input
                                        type="date"
                                        value={editedFleet.lastRotationdate ?? fleet.lastRotationdate ?? ''}
                                        onChange={(e) => handleChange("lastRotationdate", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Brake & Lux Expiry</label>
                                    <Input
                                        type="date"
                                        value={editedFleet.breakandLuxExpirey ?? fleet.breakandLuxExpirey ?? ''}
                                        onChange={(e) => handleChange("breakandLuxExpirey", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Liscense Disc Expiry</label>
                                    <Input
                                        type="date"
                                        value={editedFleet.liscenseDiscExpirey ?? fleet.liscenseDiscExpirey ?? ''}
                                        onChange={(e) => handleChange("liscenseDiscExpirey", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Last Service KM</label>
                                    <Input
                                        type="number"
                                        value={editedFleet.lastServicekm ?? fleet.lastServicekm ?? ''}
                                        onChange={(e) => handleChange("lastServicekm", parseFloat(e.target.value) || 0)}
                                        className="h-9 text-sm"
                                    />
                                </div>

                            </div>

                            {/* Brake and Lux Test (Single file field) */}
                            <div className="col-span-full">
                                <PDFUpload
                                    vehicleReg={editedFleet.vehicleReg || fleet.vehicleReg || ''}
                                    existingFiles={fleet.breakandLuxTest ? [fleet.breakandLuxTest] : []}
                                    onPDFsChange={(pdfs) => {
                                        const pdfUrls = pdfs.map(pdf => pdf.s3Key);
                                        handleChange("breakandLuxTest", pdfUrls[0] || '');
                                    }}
                                />
                            </div>


                            {/* History */}
                            <div className="mt-4 space-y-2">
                                <label className="text-sm font-medium">History</label>
                                <Textarea
                                    value={history || ''}
                                    className="min-h-[80px] text-sm resize-vertical"
                                    placeholder="Vehicle history and maintenance records..."
                                    readOnly
                                />
                            </div>


                        </CardContent>
                    </Card>
                </div>

                <ConfirmDialog
                    open={opendelete}
                    setOpen={setOpendelete}
                    handleConfirm={handleConfirmWrapper}
                />
            </main>
            <Footer />
        </div>
    );
}



