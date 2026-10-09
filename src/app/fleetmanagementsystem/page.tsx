import { client } from "@/services/schema";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataGrid } from "@/components/shell/data-grid";
import { PageHeader } from "@/components/shell/page-header";
import { Toolbar, SearchField } from "@/components/shell/toolbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { EditIcon, ArrowUpDown, X, Car, Plus, Save, Trash2, MoreVertical, Loader2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Fleet } from "@/types/vifForm.types";
import { formatDateForAmplify } from "@/utils/helper/time";
import { useAuth } from "@/contexts/auth-context";
import { usePermission } from "@/hooks/usePermission";
import { useListFleetsQuery } from "@/state/api";
import ResponseModal from "@/components/widgets/response";


const EMPTY_FLEETS: Fleet[] = [];

export default function FleetPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Shared with vehicleinspectionform/page.tsx via one cache entry and one
    // live subscription (src/state/sync.ts), instead of each page running its
    // own observeQuery on the whole Fleet table.
    const { data, isLoading: loading } = useListFleetsQuery();
    const fleets = data ?? EMPTY_FLEETS;

    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchType, setSearchType] = useState<"reg" | "driver">("reg");
    const [editingFleet, setEditingFleet] = useState<Fleet | null>(null);
    const [editedFleet, setEditedFleet] = useState<Partial<Fleet>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [opendelete, setOpendelete] = useState(false);
    const [fleetToDelete, setFleetToDelete] = useState<{ id: string, name: string } | null>(null);

    const writePermissions = usePermission("fms.edit");
    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");

    // Derived, not stored in state — recomputes during render.
    const filteredFleets = useMemo(() => {
        if (!searchTerm) return fleets;
        const term = searchTerm.toLowerCase();
        return fleets.filter((fleet) =>
            searchType === "reg"
                ? fleet.vehicleReg?.toLowerCase().includes(term)
                : fleet.currentDriver?.toLowerCase().includes(term)
        );
    }, [fleets, searchTerm, searchType]);

    // Mobile-friendly columns
    const columns: ColumnDef<any, any>[] = [
        {
            accessorKey: "fleetNumber",
            header: ({ column }: { column: any }) => (
                <button
                    type="button"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wide"
                >
                    Fleet No
                    <ArrowUpDown className="h-3 w-3" />
                </button>
            ),
            cell: ({ row }: { row: any }) => (
                <span className="font-medium">{row.original.fleetNumber}</span>
            ),
        },
        {
            accessorKey: "vehicleReg",
            header: "Registration",
            cell: ({ row }: { row: any }) => <span>{row.original.vehicleReg}</span>,
        },
        {
            id: "vehicle",
            accessorFn: (r: any) => `${r.vehicleMake} ${r.vehicleModel}`,
            header: "Vehicle",
            cell: ({ row }: { row: any }) => (
                <div className="leading-tight">
                    <div className="font-medium">{row.original.vehicleMake}</div>
                    <div className="text-xs text-muted-foreground">{row.original.vehicleModel}</div>
                </div>
            ),
        },
        {
            accessorKey: "currentDriver",
            header: "Driver",
            cell: ({ row }: { row: any }) => {
                const name: string = row.original.currentDriver || "";
                const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
                return name ? (
                    <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                            {initials}
                        </span>
                        <span>{name}</span>
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                );
            },
        },
        {
            accessorKey: "servicePlanStatus",
            header: "Service",
            cell: ({ row }: { row: any }) => (
                <Badge
                    variant="outline"
                    className={
                        row.original.servicePlanStatus
                            ? "border-transparent bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                            : "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    }
                >
                    {row.original.servicePlanStatus ? "Active" : "Inactive"}
                </Badge>
            ),
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }: { row: any }) => (
                <div className="flex justify-end">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 cursor-pointer p-0" aria-label="Row actions">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(row.original)} className="cursor-pointer">
                                <EditIcon className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => redirectToInspections(row.original.id)} className="cursor-pointer">
                                <Car className="h-4 w-4 mr-2" />
                                Inspections
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ];

    const rows = Array.isArray(filteredFleets)
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

            const johannesburgTime = new Date().toLocaleString("en-ZA", {
                timeZone: "Africa/Johannesburg"
            });

            let historyEntries = "";

            // Create history for changes
            if (isCreating) {
                historyEntries = `FMS Dashboard: ${user?.preferred_username} created new fleet vehicle at ${johannesburgTime}.\n`;
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
                            updatedBy:user?.preferred_username||user?.email,
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
                <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
                    <div className="container mx-auto max-w-7xl mt-5">
                        <PageHeader
                            title="Fleet Management"
                            description={
                                searchTerm
                                    ? `${filteredFleets.length} of ${fleets.length} vehicles`
                                    : "Manage your vehicles and assigned drivers."
                            }
                            actions={
                                <Button onClick={handleCreateNew} className="cursor-pointer bg-green-600 hover:bg-green-700">
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Vehicle
                                </Button>
                            }
                        />

                        <Toolbar>
                            <SearchField
                                aria-label="Search vehicles"
                                placeholder={searchType === "reg" ? "Search by registration..." : "Search by driver..."}
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                            <div role="group" aria-label="Search by" className="flex overflow-hidden rounded-lg border border-border">
                                {(["reg", "driver"] as const).map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        aria-pressed={searchType === t}
                                        onClick={() => setSearchType(t)}
                                        className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                                            searchType === t ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                                        }`}
                                    >
                                        {t === "reg" ? "Registration" : "Driver"}
                                    </button>
                                ))}
                            </div>
                        </Toolbar>

                        {/* Edit/Create Form */}
                        {editingFleet && (
                            <Sheet open onOpenChange={(open) => { if (!open) handleCancel(); }}>
                              <SheetContent className="sm:max-w-2xl">
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                              </SheetContent>
                            </Sheet>
                        )}

                        <DataGrid
                            data={rows}
                            columns={columns}
                            pageSize={10}
                            storageKey="fleetTablePagination"
                            noun="vehicles"
                            emptyMessage="No vehicles found."
                        />
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