import { client } from "@/services/schema";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/table/datatable";
import { EditIcon, ArrowUpDown, X, Car, Search, Plus, Save, Trash2, MoreVertical, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Fleet } from "@/types/vifForm.types";
import { formatDateForAmplify } from "@/utils/helper/time";
import { useAuth } from "@/contexts/auth-context";
import ResponseModal from "@/components/widgets/response";


export default function FleetPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fleets, setFleets] = useState<Fleet[]>([]);
    const [filteredFleets, setFilteredFleets] = useState<Fleet[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"reg" | "driver">("reg");
    const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
    const [editedFleet, setEditedFleet] = useState<Partial<Fleet>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [opendelete, setOpendelete] = useState(false);
    const [fleetToDelete, setFleetToDelete] = useState<{ id: string, name: string } | null>(null);

    const { permission } = useAuth();
    const [writePermissions, setWritePermissions] = useState(false);
    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (permission?.permissions?.includes('fms.edit') || permission?.isAdmin) {
            setWritePermissions(true);
        } else {
            setWritePermissions(false);
        }
    }, [permission]);



    useEffect(() => {

        // Subscribe to real-time updates
        const subscription = client.models.Fleet.observeQuery().subscribe({
            next: ({ items, isSynced }) => {

                const mappedFleets: Fleet[] = (items || []).map(item => ({
                    id: item.id,
                    vehicleVin: item.vehicleVin ?? null,
                    vehicleReg: item.vehicleReg ?? null,
                    vehicleMake: item.vehicleMake ?? null,
                    vehicleModel: item.vehicleModel ?? null,
                    transmitionType: item.transmitionType ?? null,
                    ownershipStatus: item.ownershipStatus ?? null,
                    fleetIndex: item.fleetIndex ?? null,
                    fleetNumber: item.fleetNumber ?? null,
                    lastServicedate: item.lastServicedate ?? null,
                    lastServicekm: item.lastServicekm ?? null,
                    lastRotationdate: item.lastRotationdate ?? null,
                    lastRotationkm: item.lastRotationkm ?? null,
                    servicePlanStatus: item.servicePlanStatus ?? false,
                    servicePlan: item.servicePlan ?? null,
                    currentDriver: item.currentDriver ?? null,
                    currentkm: item.currentkm ?? null,
                    codeRequirement: item.codeRequirement ?? null,
                    pdpRequirement: item.pdpRequirement ?? false,
                    breakandLuxTest: item.breakandLuxTest ?? null,
                    serviceplankm: item.serviceplankm ?? null,
                    breakandLuxExpirey: item.breakandLuxExpirey ?? null,
                    liscenseDiscExpirey: item.liscenseDiscExpirey ?? null,
                }));


                setFleets(mappedFleets);
                setFilteredFleets(mappedFleets);

                if (isSynced) {
                    setLoading(false);

                }
            },
            error: (error) => {
                console.error("Error subscribing to fleets:", error);
                setLoading(false);
            }
        });

        return () => {

            subscription.unsubscribe();
        };
    }, []);

    // Filter fleets based on search
    useEffect(() => {
        if (!searchTerm) {
            setFilteredFleets(fleets);
            return;
        }

        const filtered = fleets.filter(fleet => {
            if (searchType === "reg") {
                return fleet.vehicleReg?.toLowerCase().includes(searchTerm.toLowerCase());
            } else {
                return fleet.currentDriver?.toLowerCase().includes(searchTerm.toLowerCase());
            }
        });

        setFilteredFleets(filtered);
    }, [searchTerm, searchType, fleets]);

    // Mobile-friendly columns
    const columns: ColumnDef<object, any>[] = [
        {
            accessorKey: "fleetNumber",
            header: ({ column }: { column: any }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="p-0 h-auto font-medium"
                >
                    Fleet No
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }: { row: any }) => (
                <div className="font-medium text-sm">
                    {row.original.fleetNumber}
                </div>
            ),
        },
        {
            accessorKey: "vehicleReg",
            header: "Reg",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm">{row.original.vehicleReg}</div>
            ),
        },
        {
            accessorKey: "vehicleMake",
            header: "Make",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm hidden sm:block">{row.original.vehicleMake}</div>
            ),
        },
        {
            accessorKey: "vehicleModel",
            header: "Model",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm hidden md:block">{row.original.vehicleModel}</div>
            ),
        },
        {
            accessorKey: "currentDriver",
            header: "Driver",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm hidden lg:block">{row.original.currentDriver}</div>
            ),
        },
        {
            accessorKey: "servicePlanStatus",
            header: "Service",
            cell: ({ row }: { row: any }) => (
                <Badge
                    variant={row.original.servicePlanStatus ? "default" : "destructive"}
                    className="text-xs"
                >
                    {row.original.servicePlanStatus ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: any }) => (
                <div className="flex justify-start cursor-pointer">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => handleEdit(row.original)}
                                className="cursor-pointer"
                            >
                                <EditIcon className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => redirectToInspections(row.original.id)}
                                className="cursor-pointer"
                            >
                                <Car className="h-4 w-4 mr-2" />
                                Inspections
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ];

    const data = Array.isArray(filteredFleets)
        ? filteredFleets.map((fleet) => {
            return {
                id: fleet.id || "",
                fleetNumber: fleet.fleetNumber || "",
                vehicleReg: fleet.vehicleReg || "",
                vehicleMake: fleet.vehicleMake || "",
                vehicleModel: fleet.vehicleModel || "",
                currentDriver: fleet.currentDriver || "",
                currentkm: fleet.currentkm || 0,
                servicePlanStatus: fleet.servicePlanStatus || false,
            };
        })
        : [];

    const handleEdit = (fleet: any) => {
        navigate(`/fleetmanagementsystem/edit/${fleet.id}`);
    };

    // Handle create new
    const handleCreateNew = () => {
        if (!writePermissions) {
            setShow(true);
            setSuccessful(false)
            setMessage("⛔ No edit permission")

            return;
        }
        setEditingFleet({
            id: '',
            vehicleVin: null,
            vehicleReg: null,
            vehicleMake: null,
            vehicleModel: null,
            transmitionType: null,
            ownershipStatus: null,
            fleetIndex: null,
            fleetNumber: null,
            lastServicedate: null,
            lastServicekm: null,
            lastRotationdate: null,
            lastRotationkm: null,
            servicePlanStatus: false,
            servicePlan: null,
            currentDriver: null,
            currentkm: null,
            codeRequirement: null,
            pdpRequirement: false,
            breakandLuxTest: null,
            serviceplankm: null,
            breakandLuxExpirey: null,
            liscenseDiscExpirey: null,
        });
        setEditedFleet({});
        setIsCreating(true);
    };

    // Handle save
    const handleSave = async () => {
        if (!editingFleet) return;

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
            if (isCreating) {
                historyEntries = `${storedName} created new fleet vehicle at ${johannesburgTime}.\n`;
            }

            const fleetData = {
                ...editingFleet,
                ...editedFleet,
                lastServicedate: formatDateForAmplify(editedFleet.lastServicedate || editingFleet.lastServicedate),
                lastRotationdate: formatDateForAmplify(editedFleet.lastRotationdate || editingFleet.lastRotationdate),
                breakandLuxExpirey: formatDateForAmplify(editedFleet.breakandLuxExpirey || editingFleet.breakandLuxExpirey),
                liscenseDiscExpirey: formatDateForAmplify(editedFleet.liscenseDiscExpirey || editingFleet.liscenseDiscExpirey),
            };




            if (isCreating) {
                const { id, ...createData } = fleetData;
                const result = await client.models.Fleet.create(createData);

                if (result.data) {
                    try {
                        await client.models.History.create({
                            entityType: "FLEET",
                            entityId: result.data.id,
                            action: "CREATE",
                            timestamp: new Date().toISOString(),
                            details: historyEntries
                        });
                    } catch (error) {
                        console.log('Creating history error', error);
                    }
                }


            } else {

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
            }

            setEditingFleet(null);
            setEditedFleet({});
            setIsCreating(false);

        } catch (error) {
            console.error("Error saving fleet:", error);
            alert("Error saving vehicle. Check console for details.");
        } finally {
            setSaving(false);
        }
    };

    // Handle cancel
    const handleCancel = () => {
        setEditingFleet(null);
        setEditedFleet({});
        setIsCreating(false);
    };

    // Handle change
    const handleChange = (field: keyof Fleet, value: string | number | boolean | null) => {
        setEditedFleet(prev => ({ ...prev, [field]: value }));
    };


    // Handle delete
    const handleDelete = async (fleetId: string) => {
        try {
            await client.models.Fleet.delete({
                id: fleetId
            });
            setFleetToDelete(null);
            setOpendelete(false);
        } catch (error) {
            console.error("Error deleting fleet:", error);
        }
    };

    const handleDeleteClick = (fleetId: string, fleetName: string) => {
        setFleetToDelete({ id: fleetId, name: fleetName });
        setOpendelete(true);
    };

    const handleConfirmWrapper = () => {
        if (fleetToDelete) {
            handleDelete(fleetToDelete.id);
        }
    };

    // Redirect to inspections
    const redirectToInspections = (id: string) => {
        localStorage.setItem('fleetId', id);
        navigate(`/fleetmanagementsystem/${id}`);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };




    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />

            {loading ? (
                <Loading />
            ) : (
                <main className="flex-1 px-2 sm:px-4 mt-20 pb-20">
                    <div className="container mx-auto max-w-7xl mt-5">
                        {/* Search Card */}
                        <Card className="mb-4">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Car className="h-4 w-4" />
                                        Fleet
                                        <Badge variant="secondary" className="text-xs">{filteredFleets.length}</Badge>
                                    </CardTitle>
                                    <Button onClick={handleCreateNew} className="h-9 cursor-pointer bg-green-600 hover:bg-green-700 text-xs">
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Vehicle
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-3">
                                <div className="flex gap-2">
                                    <Button
                                        variant={searchType === "reg" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSearchType("reg")}
                                        className="h-8 text-xs cursor-pointer flex-1"
                                    >
                                        Registration
                                    </Button>
                                    <Button
                                        variant={searchType === "driver" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setSearchType("driver")}
                                        className="h-8 text-xs cursor-pointer flex-1"
                                    >
                                        Driver
                                    </Button>
                                </div>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={searchType === "reg" ? "Search registration..." : "Search driver..."}
                                        value={searchTerm}
                                        onChange={handleSearch}
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                                {searchTerm && (
                                    <p className="text-xs text-muted-foreground">
                                        {filteredFleets.length} of {fleets.length} vehicles
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Edit/Create Form */}
                        {editingFleet && (
                            <Card className="mb-4 sm:mb-6">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <span className="text-base sm:text-lg">
                                            {isCreating ? "Add New Vehicle" : "Edit Vehicle"}
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
                                                onClick={handleCancel}
                                                className="h-8 text-xs cursor-pointer flex-1 sm:flex-none"
                                            >
                                                <X className="h-3 w-3 mr-1" />
                                                Cancel
                                            </Button>
                                            {!isCreating && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDeleteClick(editingFleet.id, editingFleet.vehicleReg || editingFleet.fleetNumber || 'Vehicle')}
                                                    className="h-8 text-xs cursor-pointer flex-1 sm:flex-none"
                                                >
                                                    <Trash2 className="h-3 w-3 mr-1" />
                                                    Delete
                                                </Button>
                                            )}
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                        {/* Basic Information */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Fleet Index</label>
                                            <Input
                                                value={editedFleet.fleetIndex ?? editingFleet.fleetIndex ?? ''}
                                                onChange={(e) => handleChange("fleetIndex", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Fleet Number *</label>
                                            <Input
                                                value={editedFleet.fleetNumber ?? editingFleet.fleetNumber ?? ''}
                                                onChange={(e) => handleChange("fleetNumber", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Vehicle Registration *</label>
                                            <Input
                                                value={editedFleet.vehicleReg ?? editingFleet.vehicleReg ?? ''}
                                                onChange={(e) => handleChange("vehicleReg", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Vehicle VIN</label>
                                            <Input
                                                value={editedFleet.vehicleVin ?? editingFleet.vehicleVin ?? ''}
                                                onChange={(e) => handleChange("vehicleVin", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Vehicle Make</label>
                                            <Input
                                                value={editedFleet.vehicleMake ?? editingFleet.vehicleMake ?? ''}
                                                onChange={(e) => handleChange("vehicleMake", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Vehicle Model</label>
                                            <Input
                                                value={editedFleet.vehicleModel ?? editingFleet.vehicleModel ?? ''}
                                                onChange={(e) => handleChange("vehicleModel", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Transmission Type</label>
                                            <Select
                                                value={editedFleet.transmitionType ?? editingFleet.transmitionType ?? ''}
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
                                                value={editedFleet.ownershipStatus ?? editingFleet.ownershipStatus ?? ''}
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
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Current Driver</label>
                                            <Input
                                                value={editedFleet.currentDriver ?? editingFleet.currentDriver ?? ''}
                                                onChange={(e) => handleChange("currentDriver", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Current KM</label>
                                            <Input
                                                type="number"
                                                value={editedFleet.currentkm ?? editingFleet.currentkm ?? ''}
                                                onChange={(e) => handleChange("currentkm", parseFloat(e.target.value) || 0)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Service Plan Status</label>
                                            <Select
                                                value={editedFleet.servicePlanStatus?.toString() ?? editingFleet.servicePlanStatus?.toString() ?? 'false'}
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
                                                value={editedFleet.lastServicedate ?? editingFleet.lastServicedate ?? ''}
                                                onChange={(e) => handleChange("lastServicedate", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Last Rotation Date</label>
                                            <Input
                                                type="date"
                                                value={editedFleet.lastRotationdate ?? editingFleet.lastRotationdate ?? ''}
                                                onChange={(e) => handleChange("lastRotationdate", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Brake & Lux Expiry</label>
                                            <Input
                                                type="date"
                                                value={editedFleet.breakandLuxExpirey ?? editingFleet.breakandLuxExpirey ?? ''}
                                                onChange={(e) => handleChange("breakandLuxExpirey", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Liscense Disc Expiry</label>
                                            <Input
                                                type="date"
                                                value={editedFleet.liscenseDiscExpirey ?? editingFleet.liscenseDiscExpirey ?? ''}
                                                onChange={(e) => handleChange("liscenseDiscExpirey", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Last Service KM</label>
                                            <Input
                                                type="number"
                                                value={editedFleet.lastServicekm ?? editingFleet.lastServicekm ?? ''}
                                                onChange={(e) => handleChange("lastServicekm", parseFloat(e.target.value) || 0)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Last Rotation KM</label>
                                            <Input
                                                type="number"
                                                value={editedFleet.lastRotationkm ?? editingFleet.lastRotationkm ?? ''}
                                                onChange={(e) => handleChange("lastRotationkm", parseFloat(e.target.value) || 0)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Service Plan</label>
                                            <Input
                                                value={editedFleet.servicePlan ?? editingFleet.servicePlan ?? ''}
                                                onChange={(e) => handleChange("servicePlan", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Code Requirement</label>
                                            <Input
                                                value={editedFleet.codeRequirement ?? editingFleet.codeRequirement ?? ''}
                                                onChange={(e) => handleChange("codeRequirement", e.target.value)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">PDP Requirement</label>
                                            <Select
                                                value={editedFleet.pdpRequirement?.toString() ?? editingFleet.pdpRequirement?.toString() ?? 'false'}
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
                                                value={editedFleet.serviceplankm ?? editingFleet.serviceplankm ?? ''}
                                                onChange={(e) => handleChange("serviceplankm", parseFloat(e.target.value) || 0)}
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                    </div>

                                </CardContent>
                            </Card>
                        )}

                        <div className="bg-white rounded-lg border">
                            <DataTable
                                title={"Fleet Vehicles"}
                                data={data}
                                columns={columns}
                                pageSize={10}
                                storageKey="fleetTablePagination"
                                searchColumn="vehicleReg"
                            />
                        </div>
                    </div>

                    <ConfirmDialog
                        open={opendelete}
                        setOpen={setOpendelete}
                        handleConfirm={handleConfirmWrapper}
                    />
                </main>
            )}
            {show && (
                <ResponseModal
                    successful={successful}
                    message={message}
                    setShow={setShow}
                />
            )}
            <Footer />

        </div>
    )
}