import { client } from "@/services/schema";
import {  useState } from "react";
import { Save, X, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { handleUpload } from "@/services/s3.service";
import {type PDFState } from "@/types/schema";
import { FileUpload } from "@/components/widgets/fileUpload";


interface ASSETPROPS {
    customerSiteId: string;
    folder: string;
     onAssetCreated?: () => void;
}

export default function AssetCreate({ customerSiteId,onAssetCreated  }: ASSETPROPS) {
    const [saving, setSaving] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [scaleDatasheetFiles, setScaleDatasheetFiles] = useState<PDFState[]>([]);
    const [maintPlanFiles, setMaintPlanFiles] = useState<PDFState[]>([]);

    // Form state
    const [assetData, setAssetData] = useState({
        assetName: "",
        assetPlant: "",
        scaleTag: "",
        scaleOEM: "",
        beltwidth: "",
        troughAngle: "",
        scaleModel: "",
        weighIdlerQTY: "",
        approachIdlerQTY: "",
        retreatIdlerQTY: "",
        centerRollSize: "",
        wingRollSize: "",
        loadcellType: "",
        loadcellQTY: "",
        loadcellSize: "",
        integratorOEM: "",
        integratorModel: "",
        ssrOEM: "",
        ssrModel: "",
        scaledatasheetAttach: "",
        submittedmaintplanAttach: "",
        notes: "",
    });


    // Handle input changes
    const handleChange = (field: keyof typeof assetData, value: string) => {
        setAssetData(prev => ({ ...prev, [field]: value }));
    };


    // Handle save
    const handleSave = async () => {
        try {
            setSaving(true);

            // Upload files in parallel instead of sequentially
             await Promise.all([
                scaleDatasheetFiles.length > 0 ? handleUpload(scaleDatasheetFiles[0]) : Promise.resolve(""),
                maintPlanFiles.length > 0 ? handleUpload(maintPlanFiles[0]) : Promise.resolve("")
            ]);


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

            const historyEntries = `${storedName} created new asset ${assetData.assetName} at ${johannesburgTime}.\n`;

            const result = await client.models.Asset.create({
                ...assetData,
                scaledatasheetAttach: scaleDatasheetFiles[0]?.s3Key || "",
                submittedmaintplanAttach: maintPlanFiles[0]?.s3Key || "",
                customerSiteId: customerSiteId
            });

            if (result.data) {
                try {
                    await client.models.History.create({
                        entityType: "ASSET",
                        entityId: result.data.id,
                        action: "CREATE",
                        timestamp: new Date().toISOString(),
                        details: historyEntries
                    });
                } catch (error) {
                    console.log('Creating asset history error', error);
                }

                // Reset form
                setAssetData({
                    assetName: "",
                    assetPlant: "",
                    scaleTag: "",
                    scaleOEM: "",
                    beltwidth: "",
                    troughAngle: "",
                    scaleModel: "",
                    weighIdlerQTY: "",
                    approachIdlerQTY: "",
                    retreatIdlerQTY: "",
                    centerRollSize: "",
                    wingRollSize: "",
                    loadcellType: "",
                    loadcellQTY: "",
                    loadcellSize: "",
                    integratorOEM: "",
                    integratorModel: "",
                    ssrOEM: "",
                    ssrModel: "",
                    scaledatasheetAttach: "",
                    submittedmaintplanAttach: "",
                    notes: "",
                });
                setIsCreating(false);

                  if (onAssetCreated) {
                    onAssetCreated();
                }
            }

        } catch (error) {
            console.error("Error creating asset:", error);
        } finally {
            setSaving(false);
        }
    };


    // Handle cancel
    const handleCancel = () => {
        setAssetData({
            assetName: "",
            assetPlant: "",
            scaleTag: "",
            scaleOEM: "",
            beltwidth: "",
            troughAngle: "",
            scaleModel: "",
            weighIdlerQTY: "",
            approachIdlerQTY: "",
            retreatIdlerQTY: "",
            centerRollSize: "",
            wingRollSize: "",
            loadcellType: "",
            loadcellQTY: "",
            loadcellSize: "",
            integratorOEM: "",
            integratorModel: "",
            ssrOEM: "",
            ssrModel: "",
            scaledatasheetAttach: "",
            submittedmaintplanAttach: "",
            notes: "",
        });
        setIsCreating(false);
    };

    // Start creating
    const handleCreateNew = () => {
        setIsCreating(true);
    };

    return (
        <div className="w-full">
            {!isCreating ? (
                <div className="flex justify-end mb-3">
                    <Button
                        onClick={handleCreateNew}
                        className="h-8 cursor-pointer bg-green-600 hover:bg-green-700 flex-end"
                    >
                        <Plus className="h-3 w-3" />
                        Add New Asset
                    </Button>
                </div>
            ) : (
                <Card className="mb-4 sm:mb-6">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <span className="text-base sm:text-lg">
                                Add New Asset
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
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {/* Basic Information */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Asset Name *</label>
                                <Input
                                    value={assetData.assetName}
                                    onChange={(e) => handleChange("assetName", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter asset name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Asset Plant</label>
                                <Input
                                    value={assetData.assetPlant}
                                    onChange={(e) => handleChange("assetPlant", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter plant"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Scale Tag</label>
                                <Input
                                    value={assetData.scaleTag}
                                    onChange={(e) => handleChange("scaleTag", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter scale tag"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Scale OEM</label>
                                <Input
                                    value={assetData.scaleOEM}
                                    onChange={(e) => handleChange("scaleOEM", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter scale OEM"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Belt Width</label>
                                <Input
                                    value={assetData.beltwidth}
                                    onChange={(e) => handleChange("beltwidth", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter belt width"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Trough Angle</label>
                                <Input
                                    value={assetData.troughAngle}
                                    onChange={(e) => handleChange("troughAngle", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter trough angle"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Scale Model</label>
                                <Input
                                    value={assetData.scaleModel}
                                    onChange={(e) => handleChange("scaleModel", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter scale model"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Weigh Idler QTY</label>
                                <Input
                                    value={assetData.weighIdlerQTY}
                                    onChange={(e) => handleChange("weighIdlerQTY", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter quantity"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Approach Idler QTY</label>
                                <Input
                                    value={assetData.approachIdlerQTY}
                                    onChange={(e) => handleChange("approachIdlerQTY", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter quantity"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Retreat Idler QTY</label>
                                <Input
                                    value={assetData.retreatIdlerQTY}
                                    onChange={(e) => handleChange("retreatIdlerQTY", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter quantity"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Center Roll Size</label>
                                <Input
                                    value={assetData.centerRollSize}
                                    onChange={(e) => handleChange("centerRollSize", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter size"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Wing Roll Size</label>
                                <Input
                                    value={assetData.wingRollSize}
                                    onChange={(e) => handleChange("wingRollSize", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter size"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Loadcell Type</label>
                                <Input
                                    value={assetData.loadcellType}
                                    onChange={(e) => handleChange("loadcellType", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter type"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Loadcell QTY</label>
                                <Input
                                    value={assetData.loadcellQTY}
                                    onChange={(e) => handleChange("loadcellQTY", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter quantity"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Loadcell Size</label>
                                <Input
                                    value={assetData.loadcellSize}
                                    onChange={(e) => handleChange("loadcellSize", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter size"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Integrator OEM</label>
                                <Input
                                    value={assetData.integratorOEM}
                                    onChange={(e) => handleChange("integratorOEM", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter OEM"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Integrator Model</label>
                                <Input
                                    value={assetData.integratorModel}
                                    onChange={(e) => handleChange("integratorModel", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter model"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">SSR OEM</label>
                                <Input
                                    value={assetData.ssrOEM}
                                    onChange={(e) => handleChange("ssrOEM", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter SSR OEM"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">SSR Model</label>
                                <Input
                                    value={assetData.ssrModel}
                                    onChange={(e) => handleChange("ssrModel", e.target.value)}
                                    className="h-9 text-sm"
                                    placeholder="Enter SSR model"
                                />
                            </div>
                        </div>

                        {/* PDF Uploaders */}
                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <FileUpload
                                    assetName={assetData.assetName}
                                    title={"Scale Datasheet Attachment"}
                                    folder="scale-datasheets"
                                    onFilesChange={setScaleDatasheetFiles}
                                />
                            </div>

                            <div className="space-y-4">
                                <FileUpload
                                    assetName={assetData.assetName}
                                    title={"Submitted Maintenance Plan Attachment"}
                                    folder="maintenance-plans"
                                    onFilesChange={setMaintPlanFiles}
                                />
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="mt-6 space-y-2">
                            <label className="text-sm font-medium">Notes</label>
                            <Textarea
                                value={assetData.notes}
                                onChange={(e) => handleChange("notes", e.target.value)}
                                className="min-h-[80px] text-sm resize-vertical"
                                placeholder="Additional notes about the asset..."
                            />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}