// components/assets-list.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Edit2,
    Save,
    X,
    Search,
    Package,
    Warehouse,
    Trash2,
    Loader2,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import { client } from "@/services/schema";
import Loading from "@/components/widgets/loading";
import { handleUpload } from "@/services/s3.service";
import { remove } from 'aws-amplify/storage';
import { FileUploadUpdate } from "@/components/widgets/fileupdate";
import type { Asset } from "@/types/assets.type";
import { useAuth } from "@/contexts/auth-context";
import ResponseModal from "@/components/widgets/response";

interface AssetsListProps {
    customerSiteId: string;
    refreshTrigger?: number;
}

export default function AssetsList({ customerSiteId, refreshTrigger = 0 }: AssetsListProps) {
    const { user, permission } = useAuth();//auth context
    const [assetPermissions, setassetPermissions] = useState(false);

    const [assets, setAssets] = useState<Asset[]>([]);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [editedAsset, setEditedAsset] = useState<Partial<Asset>>({});
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [loading, setLoading] = useState(true);
    const itemsPerPage = 10;

    const [opendelete, setOpendelete] = useState(false);
    const [history, setHistory] = useState("");
    const [assetToDelete, setAssetToDelete] = useState<{ id: string, name: string } | null>(null);
    const [filesToDelete, setFilesToDelete] = useState<string[]>([]);

    const [saving, setSaving] = useState(false);

    //pdfs
    const [scaleDatasheetFiles, setScaleDatasheetFiles] = useState<any[]>([]);
    const [maintPlanFiles, setMaintPlanFiles] = useState<any[]>([]);

    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");

    // Fetch assets based on customerSiteId
    useEffect(() => {
        const fetchAssets = async () => {
            try {
                setLoading(true); // Set loading to true when starting fetch

                const { data: assetsData } = await client.models.Asset.listAssetByCustomerSiteId({
                    customerSiteId: customerSiteId,
                });

                // Convert schema assets to our Asset type
                const convertedAssets: Asset[] = (assetsData || []).map(item => ({
                    id: item.id,
                    assetName: item.assetName,
                    assetPlant: item.assetPlant || undefined,
                    scaleTag: item.scaleTag || undefined,
                    scaleOEM: item.scaleOEM || undefined,
                    beltwidth: item.beltwidth || undefined,
                    troughAngle: item.troughAngle || undefined,
                    scaleModel: item.scaleModel || undefined,
                    weighIdlerQTY: item.weighIdlerQTY || undefined,
                    approachIdlerQTY: item.approachIdlerQTY || undefined,
                    retreatIdlerQTY: item.retreatIdlerQTY || undefined,
                    centerRollSize: item.centerRollSize || undefined,
                    wingRollSize: item.wingRollSize || undefined,
                    loadcellType: item.loadcellType || undefined,
                    loadcellQTY: item.loadcellQTY || undefined,
                    loadcellSize: item.loadcellSize || undefined,
                    integratorOEM: item.integratorOEM || undefined,
                    integratorModel: item.integratorModel || undefined,
                    ssrOEM: item.ssrOEM || undefined,
                    ssrModel: item.ssrModel || undefined,
                    scaledatasheetAttach: item.scaledatasheetAttach || undefined,
                    submittedmaintplanAttach: item.submittedmaintplanAttach || undefined,
                    notes: item.notes || undefined,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                })).sort((a, b) =>
                    a.assetName.localeCompare(b.assetName),
                );

                setAssets(convertedAssets);
            } catch (error) {
                console.error("Error fetching assets:", error);
                setAssets([]);
            } finally {
                setLoading(false); // Set loading to false when done (success or error)
            }
        };

        fetchAssets();
    }, [customerSiteId, refreshTrigger]);

    useEffect(() => {

        if (permission?.permissions?.includes('crm.assets.edit') || permission?.isAdmin) {
            setassetPermissions(true);
        } else {
            setassetPermissions(false);
        }

    }, [permission]);


    useEffect(() => {
        const getHistory = async () => {
            if (!editedAsset?.id) return;

            const assetHistory = await client.models.History.getHistoryByEntityId(
                { entityId: editedAsset.id },
                { sortDirection: 'DESC', limit: 20 }
            );

            const historyString = assetHistory.data
                .map(entry => entry.details)
                .join('');

            setHistory(historyString);
        };

        getHistory();
    }, [editedAsset?.id]);


    const handleAssetUpdate = async (updatedAsset: Asset) => {
        try {
            // Convert back to schema format for update
            const updateData = {
                id: updatedAsset.id,
                assetName: updatedAsset.assetName,
                assetPlant: updatedAsset.assetPlant || null,
                scaleTag: updatedAsset.scaleTag || null,
                scaleOEM: updatedAsset.scaleOEM || null,
                beltwidth: updatedAsset.beltwidth || null,
                troughAngle: updatedAsset.troughAngle || null,
                scaleModel: updatedAsset.scaleModel || null,
                weighIdlerQTY: updatedAsset.weighIdlerQTY || null,
                approachIdlerQTY: updatedAsset.approachIdlerQTY || null,
                retreatIdlerQTY: updatedAsset.retreatIdlerQTY || null,
                centerRollSize: updatedAsset.centerRollSize || null,
                wingRollSize: updatedAsset.wingRollSize || null,
                loadcellType: updatedAsset.loadcellType || null,
                loadcellQTY: updatedAsset.loadcellQTY || null,
                loadcellSize: updatedAsset.loadcellSize || null,
                integratorOEM: updatedAsset.integratorOEM || null,
                integratorModel: updatedAsset.integratorModel || null,
                ssrOEM: updatedAsset.ssrOEM || null,
                ssrModel: updatedAsset.ssrModel || null,
                scaledatasheetAttach: scaleDatasheetFiles[0]?.s3Key || null,
                submittedmaintplanAttach: maintPlanFiles[0]?.s3Key || null,
                notes: updatedAsset.notes || null,
                customerSiteId: customerSiteId,
            };

            const result = await client.models.Asset.update(updateData);
            if (result.data) {
                setAssets(prev => prev.map(asset =>
                    asset.id === updatedAsset.id ? updatedAsset : asset
                ));
            }
        } catch (error) {
            console.error("Error updating asset:", error);
        }
    };

    const handleAssetDelete = async (assetId: string) => {
        try {
            await client.models.Asset.delete({ id: assetId });
            setAssets(prev => prev.filter(asset => asset.id !== assetId));
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    };

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const matchesSearch =
                asset.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.scaleTag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.scaleModel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.scaleOEM?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.assetPlant?.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesSearch;
        });
    }, [assets, searchTerm, statusFilter]);

    const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
    const paginatedAssets = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAssets.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAssets, currentPage, itemsPerPage]);

    const handleEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setEditedAsset({ ...asset });
    };

    const handleSave = async () => {
        try {
            if (!assetPermissions) {
                setShow(true);
                setSuccessful(false)
                setMessage("⛔ No crm asset edit permission")

                return;
            }
            setSaving(true);

            if (editingAsset && editedAsset) {
                // Delete S3 files first
                if (filesToDelete.length > 0) {
                    await Promise.all(filesToDelete.map(s3Key => remove({ path: s3Key })));
                }

                // Upload files in parallel
                const [scaledatasheetUrl, submittedmaintplanUrl] = await Promise.all([
                    scaleDatasheetFiles.length > 0 ? handleUpload(scaleDatasheetFiles[0]) : Promise.resolve(editedAsset.scaledatasheetAttach || ""),
                    maintPlanFiles.length > 0 ? handleUpload(maintPlanFiles[0]) : Promise.resolve(editedAsset.submittedmaintplanAttach || "")
                ]);

                // Check if files were deleted (no new file selected AND old file was marked for deletion)
                scaleDatasheetFiles.length === 0 && filesToDelete.some(key => key === editedAsset.scaledatasheetAttach)
                    ? ""
                    : scaledatasheetUrl;

                maintPlanFiles.length === 0 && filesToDelete.some(key => key === editedAsset.submittedmaintplanAttach)
                    ? ""
                    : submittedmaintplanUrl;

                const johannesburgTime = new Date().toLocaleString("en-ZA", {
                    timeZone: "Africa/Johannesburg"
                });

                let historyEntries = "";

                // Check if important fields changed
                if (editedAsset.assetName !== undefined && editedAsset.assetName !== editingAsset.assetName) {
                    historyEntries += `CRM Asset Dashboard :${user?.preferred_username} updated assetName from ${editingAsset.assetName} to ${editedAsset.assetName} at ${johannesburgTime}\n`;
                }

                if (editedAsset.scaleTag !== undefined && editedAsset.scaleTag !== editingAsset.scaleTag) {
                    historyEntries += `CRM Asset Dashboard :${user?.preferred_username} updated scaleTag from ${editingAsset.scaleTag} to ${editedAsset.scaleTag} at ${johannesburgTime}\n`;
                }

                if (editedAsset.scaleOEM !== undefined && editedAsset.scaleOEM !== editingAsset.scaleOEM) {
                    historyEntries += `$CRM Asset Dashboard :{user?.preferred_username} updated scaleOEM from ${editingAsset.scaleOEM} to ${editedAsset.scaleOEM} at ${johannesburgTime}\n`;
                }

                // Create the updated asset with uploaded file URLs
                const updatedAsset = {
                    ...editingAsset,
                    ...editedAsset,
                    scaledatasheetAttach: scaleDatasheetFiles[0]?.s3Key || "",
                    submittedmaintplanAttach: maintPlanFiles[0]?.s3Key || ""
                };

                // USE INTERNAL HANDLER
                await handleAssetUpdate(updatedAsset);

                // Save to new History DB if there were changes
                if (historyEntries.trim() !== "") {
                    try {
                        await client.models.History.create({
                            entityType: "ASSET",
                            entityId: editingAsset.id,
                            action: "UPDATE",
                            timestamp: new Date().toISOString(),
                            updatedBy: user?.preferred_username || user?.email,
                            details: historyEntries,
                        });
                        setHistory(historyEntries);
                    } catch (error) {
                        console.log("Saving History ", error)
                    }
                }

                setEditingAsset(null);
                setEditedAsset({});
                setScaleDatasheetFiles([]);
                setMaintPlanFiles([]);
                setFilesToDelete([]);
            }
        } catch (error) {
            console.error("Error saving asset:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditingAsset(null);
        setEditedAsset({});
    };

    const handleChange = (field: keyof Asset, value: string | number | boolean) => {
        if (!assetPermissions) {
            setShow(true);
            setSuccessful(false)
            setMessage("⛔ No crm asset edit permission")

            return;
        }
        setEditedAsset(prev => ({ ...prev, [field]: value }));
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleDelete = async (assetId: string, assetName: string) => {
        try {
            setOpendelete(false);
            console.log("Deleting asset:", assetId, assetName);

            if (!assetId) {
                console.warn("No ID provided for deletion.");
                return;
            }

            // USE INTERNAL HANDLER
            await handleAssetDelete(assetId);
            setAssetToDelete(null);
        } catch (error) {
            console.error("Error deleting asset:", error);
        }
    };

    const handleConfirmWrapper = () => {
        if (assetToDelete) {
            handleDelete(assetToDelete.id, assetToDelete.name);
        }
    };

    const handleDeleteClick = (assetId: string, assetName: string) => {
        if (!assetPermissions) {
            setShow(true);
            setSuccessful(false)
            setMessage("⛔ No crm asset edit permission")

            return;
        }
        setAssetToDelete({ id: assetId, name: assetName });
        setOpendelete(true);
    };



    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-background from-slate-50 to-blue-50/30">
                <Loading />
            </div>
        );
    }
    if (assets.length === 0) {
        return (
            <Card className="h-48">
                <CardContent className="p-6 h-full flex items-center justify-center">
                    <p className="text-muted-foreground text-center">No assets found</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Assets
                        <Badge variant="secondary" className="text-xs">
                            {filteredAssets.length}
                        </Badge>
                    </CardTitle>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search assets..."
                                value={searchTerm}
                                onChange={handleSearch}
                                className="pl-8 h-9 text-sm"
                            />
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                {/* Assets Table */}
                <div className="space-y-2">
                    {paginatedAssets.map((asset) => (
                        <div key={asset.id} className="border rounded-lg p-4 text-sm">
                            {editingAsset?.id === asset.id ? (
                                // Edit Mode - Enhanced Form with Textareas
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-base">Editing Asset</h4>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="h-8 text-xs cursor-pointer bg-[#165b8c] text-white hover:bg-[#1e6fae] flex-1 sm:flex-none"
                                            >
                                                {saving ? (
                                                    <>
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        Saving ...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Save className="h-3 w-3 mr-1" />
                                                        Save
                                                    </>
                                                )}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 text-xs cursor-pointer">
                                                <X className="h-3 w-3 mr-1" />
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {/* Asset Information */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Asset Name *</label>
                                            <Input
                                                value={editedAsset.assetName || ""}
                                                onChange={(e) => handleChange("assetName", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Asset Plant</label>
                                            <Input
                                                value={editedAsset.assetPlant || ""}
                                                onChange={(e) => handleChange("assetPlant", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Scale Tag</label>
                                            <Input
                                                value={editedAsset.scaleTag || ""}
                                                onChange={(e) => handleChange("scaleTag", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>

                                        {/* Scale Information */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Scale OEM</label>
                                            <Input
                                                value={editedAsset.scaleOEM || ""}
                                                onChange={(e) => handleChange("scaleOEM", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Scale Model</label>
                                            <Input
                                                value={editedAsset.scaleModel || ""}
                                                onChange={(e) => handleChange("scaleModel", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>

                                        {/* Belt/Conveyor Specifications */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Belt Width</label>
                                            <Input
                                                value={editedAsset.beltwidth || ""}
                                                onChange={(e) => handleChange("beltwidth", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Trough Angle</label>
                                            <Input
                                                value={editedAsset.troughAngle || ""}
                                                onChange={(e) => handleChange("troughAngle", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>

                                        {/* Idler Information */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Weigh Idler QTY</label>
                                            <Input
                                                value={editedAsset.weighIdlerQTY || ""}
                                                onChange={(e) => handleChange("weighIdlerQTY", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Approach Idler QTY</label>
                                            <Input
                                                value={editedAsset.approachIdlerQTY || ""}
                                                onChange={(e) => handleChange("approachIdlerQTY", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Retreat Idler QTY</label>
                                            <Input
                                                value={editedAsset.retreatIdlerQTY || ""}
                                                onChange={(e) => handleChange("retreatIdlerQTY", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Center Roll Size</label>
                                            <Input
                                                value={editedAsset.centerRollSize || ""}
                                                onChange={(e) => handleChange("centerRollSize", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Wing Roll Size</label>
                                            <Input
                                                value={editedAsset.wingRollSize || ""}
                                                onChange={(e) => handleChange("wingRollSize", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>

                                        {/* Load Cell Information */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Load Cell Type</label>
                                            <Input
                                                value={editedAsset.loadcellType || ""}
                                                onChange={(e) => handleChange("loadcellType", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Load Cell QTY</label>
                                            <Input
                                                value={editedAsset.loadcellQTY || ""}
                                                onChange={(e) => handleChange("loadcellQTY", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Load Cell Size</label>
                                            <Input
                                                value={editedAsset.loadcellSize || ""}
                                                onChange={(e) => handleChange("loadcellSize", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>

                                        {/* Integrator Information */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Integrator OEM</label>
                                            <Input
                                                value={editedAsset.integratorOEM || ""}
                                                onChange={(e) => handleChange("integratorOEM", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Integrator Model</label>
                                            <Input
                                                value={editedAsset.integratorModel || ""}
                                                onChange={(e) => handleChange("integratorModel", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>

                                        {/* SSR Information */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">SSR OEM</label>
                                            <Input
                                                value={editedAsset.ssrOEM || ""}
                                                onChange={(e) => handleChange("ssrOEM", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">SSR Model</label>
                                            <Input
                                                value={editedAsset.ssrModel || ""}
                                                onChange={(e) => handleChange("ssrModel", e.target.value)}
                                                className="h-9"
                                            />
                                        </div>
                                    </div>


                                    {/* Textareas for longer text fields */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Notes</label>
                                            <Textarea
                                                value={editedAsset.notes || ""}
                                                onChange={(e) => handleChange("notes", e.target.value)}
                                                className="min-h-[100px] text-sm resize-vertical"
                                                placeholder="Enter asset specifications, maintenance details, or important information..."
                                            />
                                        </div>

                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Scale Datasheet</label>

                                            <FileUploadUpdate
                                                assetName={editedAsset.assetName || ""}
                                                title="Scale Datasheet"
                                                folder="scale-datasheets"
                                                existingFiles={editedAsset.scaledatasheetAttach ? [editedAsset.scaledatasheetAttach] : []}
                                                onFilesChange={setScaleDatasheetFiles}
                                                onFileRemove={() => {
                                                    if (editedAsset.scaledatasheetAttach) {
                                                        setFilesToDelete(prev => [...prev, editedAsset.scaledatasheetAttach!]);
                                                    }
                                                }}
                                            />


                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Maintenance Plan</label>
                                            <FileUploadUpdate
                                                assetName={editedAsset.assetName || ""}
                                                title="Maintenance Plan"
                                                folder="maintenance-plans"
                                                existingFiles={editedAsset.submittedmaintplanAttach ? [editedAsset.submittedmaintplanAttach] : []}
                                                onFilesChange={setMaintPlanFiles}
                                                onFileRemove={() => {
                                                    if (editedAsset.submittedmaintplanAttach) {
                                                        setFilesToDelete(prev => [...prev, editedAsset.submittedmaintplanAttach!]);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* History Textarea */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">History</label>
                                        <Textarea
                                            value={history}
                                            className="min-h-[80px] text-sm resize-vertical"
                                            placeholder="Asset history, changes, or maintenance records..."
                                            readOnly
                                        />
                                    </div>
                                </div>
                            ) : (
                                // View Mode - Enhanced Display


                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                    <div className="flex-1 min-w-0 space-y-3">
                                        {/* Header with asset info */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h4 className="font-semibold text-base truncate">
                                                        {asset.assetPlant || "Unnamed Plant"}
                                                    </h4>
                                                    <Badge variant="outline" className="text-xs">
                                                        {asset.assetName || "Unnamed Asset"}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {asset.scaleTag || "No Tag"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Asset Information */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-muted-foreground text-sm">Scale:</span>
                                                    <span className="font-medium text-xs"> {asset.scaleOEM || "N/A"}</span>
                                                    {asset.scaleModel && (
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            ({asset.scaleModel})
                                                        </span>
                                                    )}
                                                    {asset.beltwidth && (
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            ({asset.beltwidth} BW)
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground text-sm">Intergrator: </span>
                                                    <span className="font-medium text-xs">{asset.integratorOEM || "N/A"}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">({asset.integratorModel || "N/A"})</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground text-sm">Speed Sensor: </span>
                                                    <span className="font-medium text-xs">{asset.ssrOEM || "N/A"}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">({asset.ssrModel || "N/A"})</span>
                                                </div>
                                            </div>

                                            {/* Technical Information */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <Warehouse className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-muted-foreground text-sm">Load Cells: </span>
                                                        <span className={asset.loadcellQTY ? "text-green-600 font-medium" : "text-red-600"}>
                                                            {asset.loadcellQTY || "N/A"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground text-sm">Type: </span>
                                                        <span className={asset.loadcellType ? "text-green-600 font-medium" : "text-red-600"}>
                                                            {asset.loadcellType || "N/A"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-muted-foreground text-sm">Size: </span>
                                                        <span className={asset.loadcellSize ? "text-green-600 font-medium" : "text-red-600"}>
                                                            {asset.loadcellSize || "N/A"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>

                                                </div>

                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 lg:flex-col lg:self-start">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleEdit(asset)}
                                            className="h-8 text-xs flex-1 lg:flex-none cursor-pointer"
                                        >
                                            <Edit2 className="h-3 w-3 mr-1" />
                                            Edit
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleDeleteClick(asset.id, asset.assetName || asset.scaleTag || "Unnamed Asset")}
                                            className="h-8 text-xs flex-1 lg:flex-none cursor-pointer"
                                        >
                                            <Trash2 className="h-3 w-3 mr-1 cursor-pointer" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>


                            )}
                        </div>
                    ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t pt-4 mt-4">
                        <p className="text-sm text-muted-foreground">
                            Showing {paginatedAssets.length} of {filteredAssets.length} assets
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="h-8 text-sm cursor-pointer"
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground min-w-[100px] text-center">
                                Page {currentPage} of {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="h-8 text-sm cursor-pointer"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
            <ConfirmDialog
                open={opendelete}
                setOpen={setOpendelete}
                handleConfirm={handleConfirmWrapper}
            />
            {show && (
                <ResponseModal
                    successful={successful}
                    message={message}
                    setShow={setShow}
                />
            )}
        </Card>
    );
}
