import { client } from "@/services/schema";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Trash2, ArrowLeft, Car } from "lucide-react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import { InspectionImageGallery } from "@/components/inspection/inspection-image-gallery";
import { InspectionImageViewer } from "@/components/inspection/inspection-image-viewer";
import { getUrl } from 'aws-amplify/storage';
import type { Inspection } from "@/types/vifForm.types";


export default function InspectionEditPage() {
    const navigate = useNavigate();
    const params = useParams();
    const fleetId = decodeURIComponent(params.id as string);
    const inspectionId = decodeURIComponent(params.inspectionId as string);
    const editFormRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [inspection, setInspection] = useState<Inspection | null>(null);
    const [fleetInfo, setFleetInfo] = useState<any>(null);
    const [editedInspection, setEditedInspection] = useState<Partial<Inspection>>({});
    const [saving, setSaving] = useState(false);
    const [opendelete, setOpendelete] = useState(false);

    // Image viewer states
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [currentImages, setCurrentImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Function to convert S3 keys to actual URLs
    const getS3ImageUrls = async (s3Keys: string[]): Promise<string[]> => {
        if (!s3Keys || s3Keys.length === 0) return [];

        const urls = await Promise.all(
            s3Keys.map(async (key) => {
                try {
                    const { url } = await getUrl({
                        path: key
                    });
                    return url.toString();
                } catch (error) {
                    console.error('Error getting URL for', key, error);
                    return '';
                }
            })
        );
        return urls.filter(url => url !== '');
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch fleet information
                const { data: fleet } = await client.models.Fleet.get({ id: fleetId });
                setFleetInfo(fleet);

                // Fetch inspection data
                const { data: inspectionData } = await client.models.Inspection.get({ id: inspectionId });

                if (inspectionData) {
                    // Convert S3 keys to actual URLs
                    const s3Keys = (inspectionData.photo ?? []).filter((x): x is string => x !== null);
                    const photoUrls = await getS3ImageUrls(s3Keys);

                    const mappedInspection: Inspection = {
                        id: inspectionData.id,
                        fleetid: inspectionData.fleetid,
                        inspectionNo: inspectionData.inspectionNo,
                        vehicleVin: inspectionData.vehicleVin,
                        inspectionDate: inspectionData.inspectionDate,
                        inspectionTime: inspectionData.inspectionTime,
                        odometerStart: inspectionData.odometerStart,
                        vehicleReg: inspectionData.vehicleReg,
                        inspectorOrDriver: inspectionData.inspectorOrDriver,
                        oilAndCoolant: inspectionData.oilAndCoolant,
                        fuelLevel: inspectionData.fuelLevel,
                        seatbeltDoorsMirrors: inspectionData.seatbeltDoorsMirrors,
                        handbrake: inspectionData.handbrake,
                        tyreCondition: inspectionData.tyreCondition,
                        spareTyre: inspectionData.spareTyre,
                        numberPlate: inspectionData.numberPlate,
                        licenseDisc: inspectionData.licenseDisc,
                        leaks: inspectionData.leaks,
                        lights: inspectionData.lights,
                        defrosterAircon: inspectionData.defrosterAircon,
                        emergencyKit: inspectionData.emergencyKit,
                        clean: inspectionData.clean,
                        warnings: inspectionData.warnings,
                        windscreenWipers: inspectionData.windscreenWipers,
                        serviceBook: inspectionData.serviceBook,
                        siteKit: inspectionData.siteKit,
                        photo: photoUrls,
                        history: inspectionData.history
                    };

                    setInspection(mappedInspection);
                    setEditedInspection({ ...mappedInspection });
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [fleetId, inspectionId]);

    useEffect(() => {
        if (editFormRef.current) {
            editFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, []);

    // Handle image viewing from gallery
    const handleViewImage = (imageUrl: string, allImages: string[]) => {
        const index = allImages.indexOf(imageUrl);
        setCurrentImages(allImages);
        setCurrentImageIndex(index);
        setImageViewerOpen(true);
    };

    // Handle save
    const handleSave = async () => {
        if (!inspection) return;

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

            // Create history for changes
            Object.keys(editedInspection).forEach(key => {
                const typedKey = key as keyof Inspection;
                if (editedInspection[typedKey] !== inspection[typedKey]) {
                    historyEntries += `${storedName} updated ${typedKey} from ${inspection[typedKey]} to ${editedInspection[typedKey]} at ${johannesburgTime}\n`;
                }
            });

            // Helper function to handle date fields for AWS Amplify
            const formatDateForAmplify = (dateValue: string | null): string | null => {
                if (!dateValue || dateValue.trim() === "") return null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
                if (dateValue.includes('T')) return dateValue.split('T')[0];
                try {
                    const date = new Date(dateValue);
                    if (isNaN(date.getTime())) return null;
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                } catch {
                    return null;
                }
            };

            const inspectionData = {
                ...inspection,
                ...editedInspection,
                inspectionDate: formatDateForAmplify(editedInspection.inspectionDate || inspection.inspectionDate),
                history: historyEntries ? (inspection.history || "") + historyEntries : inspection.history
            };

            console.log("Saving inspection data:", inspectionData);

            // Update existing inspection
            await client.models.Inspection.update({
                id: inspectionData.id,
                fleetid: inspectionData.fleetid,
                inspectionNo: inspectionData.inspectionNo,
                vehicleVin: inspectionData.vehicleVin || null,
                inspectionDate: inspectionData.inspectionDate,
                inspectionTime: inspectionData.inspectionTime || null,
                odometerStart: inspectionData.odometerStart || null,
                vehicleReg: inspectionData.vehicleReg || null,
                inspectorOrDriver: inspectionData.inspectorOrDriver || null,
                oilAndCoolant: inspectionData.oilAndCoolant || false,
                fuelLevel: inspectionData.fuelLevel || false,
                seatbeltDoorsMirrors: inspectionData.seatbeltDoorsMirrors || false,
                handbrake: inspectionData.handbrake || false,
                tyreCondition: inspectionData.tyreCondition || false,
                spareTyre: inspectionData.spareTyre || false,
                numberPlate: inspectionData.numberPlate || false,
                licenseDisc: inspectionData.licenseDisc || false,
                leaks: inspectionData.leaks || false,
                lights: inspectionData.lights || false,
                defrosterAircon: inspectionData.defrosterAircon || false,
                emergencyKit: inspectionData.emergencyKit || false,
                clean: inspectionData.clean || false,
                warnings: inspectionData.warnings || false,
                windscreenWipers: inspectionData.windscreenWipers || false,
                serviceBook: inspectionData.serviceBook || false,
                siteKit: inspectionData.siteKit || false,
                history: inspectionData.history || null
            });

            // Navigate back to list page
            navigate(`/inspections/${fleetId}`);

        } catch (error) {
            console.error("Error saving inspection:", error);
        } finally {
            setSaving(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        try {
            await client.models.Inspection.delete({
                id: inspectionId
            });
            setOpendelete(false);
            // Navigate back to list page after delete
            navigate(`/inspections/${fleetId}`);
        } catch (error) {
            console.error("Error deleting inspection:", error);
        }
    };

    const handleDeleteClick = () => {
        setOpendelete(true);
    };

    const handleConfirmWrapper = () => {
        handleDelete();
    };

    // Handle change
    const handleChange = (field: keyof Inspection, value: string | number | boolean) => {
        setEditedInspection(prev => ({ ...prev, [field]: value }));
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

    if (!inspection) {
        return (
            <div className="flex flex-col min-h-screen bg-background text-foreground">
                <Navbar />
                <div className="flex-1 flex items-center justify-center">
                    <p>Inspection not found</p>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />

            <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
                <div className="container mx-auto max-w-7xl">
                    {/* Header */}
                    <div className="mb-4 sm:mb-6">
                        <div className="flex items-center gap-3 mb-2">

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/fleetmanagementsystem/${fleetId}`)}
                                className="h-9 w-9 p-0 relative hover:scale-105 active:scale-95 transition-transform duration-150">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <Car className="h-5 w-5 text-primary" />
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold">
                                    Inspection #{inspection.inspectionNo}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {fleetInfo?.fleetNumber} • {fleetInfo?.vehicleMake} {fleetInfo?.vehicleModel}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Edit Form */}
                    <Card ref={editFormRef} className="mb-4 sm:mb-6">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <span className="text-base sm:text-lg">
                                    Edit Inspection
                                </span>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="h-8 text-xs cursor-pointer bg-[#165b8c] text-white hover:bg-[#1e6fae] flex-1 sm:flex-none"
                                    >
                                        <Save className="h-3 w-3 mr-1" />
                                        {saving ? "Saving..." : "Save"}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate(`/fleetmanagementsystem/${fleetId}`)}
                                        className="h-8 text-xs cursor-pointer flex-1 sm:flex-none"
                                    >
                                        <ArrowLeft className="h-3 w-3 mr-1" />
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
                                    <label className="text-sm font-medium">Vehicle Registration</label>
                                    <Input
                                        value={editedInspection.vehicleReg ?? inspection.vehicleReg ?? ''}
                                        onChange={(e) => handleChange("vehicleReg", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Vehicle VIN</label>
                                    <Input
                                        value={editedInspection.vehicleVin ?? inspection.vehicleVin ?? ''}
                                        onChange={(e) => handleChange("vehicleVin", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Inspection Date</label>
                                    <Input
                                        type="date"
                                        value={editedInspection.inspectionDate ?? inspection.inspectionDate ?? ''}
                                        onChange={(e) => handleChange("inspectionDate", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Inspection Time</label>
                                    <Input
                                        type="time"
                                        value={editedInspection.inspectionTime ?? inspection.inspectionTime ?? ''}
                                        onChange={(e) => handleChange("inspectionTime", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Odometer Start</label>
                                    <Input
                                        type="number"
                                        value={editedInspection.odometerStart ?? inspection.odometerStart ?? ''}
                                        onChange={(e) => handleChange("odometerStart", parseFloat(e.target.value) || 0)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Inspector/Driver</label>
                                    <Input
                                        value={editedInspection.inspectorOrDriver ?? inspection.inspectorOrDriver ?? ''}
                                        onChange={(e) => handleChange("inspectorOrDriver", e.target.value)}
                                        className="h-9 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Inspection Checklist */}
                            <div className="mt-6">
                                <h3 className="text-lg font-semibold mb-4">Inspection Checklist</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        { key: 'oilAndCoolant', label: 'Oil & Coolant' },
                                        { key: 'fuelLevel', label: 'Fuel Level' },
                                        { key: 'seatbeltDoorsMirrors', label: 'Seatbelts, Doors & Mirrors' },
                                        { key: 'handbrake', label: 'Handbrake' },
                                        { key: 'tyreCondition', label: 'Tyre Condition' },
                                        { key: 'spareTyre', label: 'Spare Tyre' },
                                        { key: 'numberPlate', label: 'Number Plate' },
                                        { key: 'licenseDisc', label: 'License Disc' },
                                        { key: 'leaks', label: 'No Leaks' },
                                        { key: 'lights', label: 'Lights' },
                                        { key: 'defrosterAircon', label: 'Defroster & Aircon' },
                                        { key: 'emergencyKit', label: 'Emergency Kit' },
                                        { key: 'clean', label: 'Clean' },
                                        { key: 'warnings', label: 'No Warning Lights' },
                                        { key: 'windscreenWipers', label: 'Windscreen & Wipers' },
                                        { key: 'serviceBook', label: 'Service Book' },
                                        { key: 'siteKit', label: 'Site Kit' },
                                    ].map((item) => (
                                        <div key={item.key} className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={!!(editedInspection[item.key as keyof Inspection] ?? inspection[item.key as keyof Inspection])}
                                                onChange={(e) => handleChange(item.key as keyof Inspection, e.target.checked)}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <label className="text-sm font-medium">{item.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Image Gallery */}
                            <div className="mt-6">
                                <InspectionImageGallery
                                    images={inspection.photo || []}
                                    onImageClick={handleViewImage}
                                    title="Inspection Photos"
                                />
                            </div>

                            {/* History */}
                            <div className="mt-4 space-y-2">
                                <label className="text-sm font-medium">History</label>
                                <Textarea
                                    value={editedInspection.history || inspection.history || ''}
                                    onChange={(e) => handleChange("history", e.target.value)}
                                    className="min-h-[80px] text-sm resize-vertical"
                                    placeholder="Inspection history and notes..."
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

                {/* Image Viewer Modal */}
                <InspectionImageViewer
                    images={currentImages}
                    isOpen={imageViewerOpen}
                    onClose={() => setImageViewerOpen(false)}
                    initialIndex={currentImageIndex}
                />
            </main>
            <Footer />
        </div>
    );
}

