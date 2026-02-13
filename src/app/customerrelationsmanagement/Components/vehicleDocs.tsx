"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search, Truck, FileText, Plus, Minus, Eye, Calendar, X } from "lucide-react";
import { formatDate, getDocumentStatus } from "@/utils/helper/time";
import { client } from "@/services/schema";
import { viewDoc } from "@/utils/helper/helper";
import { useAuth } from "@/contexts/auth-context";

interface VehicleDocsProps {
    vehicles: any[];
    complianceData: any;
    onComplianceUpdate?: (updatedData: any) => void;
}

export default function VehicleDocs({ vehicles, complianceData, onComplianceUpdate }: VehicleDocsProps) {

      const { user } = useAuth();
    const [selectedVehicles, setSelectedVehicles] = useState<Set<string>>(new Set());
    const [vehicleSearchTerm, setVehicleSearchTerm] = useState("");
    const [linkedVehicles, setLinkedVehicles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize selected vehicles with linked vehicles
    useEffect(() => {
        if (complianceData?.linkedVehicles) {
            const linkedIds = complianceData.linkedVehicles;
            const linked = vehicles.filter(vehicle => linkedIds.includes(vehicle.id));
            setLinkedVehicles(linked);

            // Auto-select linked vehicles
            setSelectedVehicles(new Set(linkedIds.filter((id: string | null) => id !== null)));
        } else {
            setLinkedVehicles([]);
            setSelectedVehicles(new Set());
        }
    }, [complianceData, vehicles]);

    const toggleVehicle = (vehicleId: string) => {
        const newSelected = new Set(selectedVehicles);
        if (newSelected.has(vehicleId)) {
            newSelected.delete(vehicleId);
        } else {
            newSelected.add(vehicleId);
        }
        setSelectedVehicles(newSelected);
    };

    // Get vehicles to display in dashboard (only selected ones)
    const dashboardVehicles = vehicles.filter(vehicle =>
        selectedVehicles.has(vehicle.id)
    );

    const filteredVehicles = vehicles.filter(vehicle =>
        vehicle.vehicleReg?.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
        vehicle.vehicleMake?.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
        vehicle.vehicleModel?.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
        vehicle.fleetNumber?.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
    );

    const clearSearch = () => {
        setVehicleSearchTerm("");
        inputRef.current?.focus();
    };


    const handleLinkVehicles = async () => {
        if (selectedVehicles.size === 0) return;
        setLoading(true);

        try {
            const { data: existingCompliance } = await client.models.Compliance.list({
                filter: { customerSiteId: { eq: complianceData.customerSiteId } }
            });

            // Get vehicle details for history BEFORE processing
            const vehicleDetails: string[] = [];
            Array.from(selectedVehicles).forEach(vehicleId => {
                const vehicle = vehicles.find(v => v.id === vehicleId);
                if (vehicle) {
                    vehicleDetails.push(`${vehicle.vehicleReg} - ${vehicle.vehicleMake} ${vehicle.vehicleModel}`);
                }
            });

            const newLinkedVehicles = Array.from(selectedVehicles);

            // UPDATE LOCAL STATE IMMEDIATELY - This fixes the UI for linking
            const newlyLinkedVehicles = vehicles.filter(vehicle =>
                selectedVehicles.has(vehicle.id) && !linkedVehicles.some(linked => linked.id === vehicle.id)
            );
            setLinkedVehicles(prev => [...prev, ...newlyLinkedVehicles]);


            if (existingCompliance?.[0]?.id) {
                await client.models.Compliance.update({
                    id: existingCompliance[0].id!,
                    linkedVehicles: newLinkedVehicles
                });
            } else {
                await client.models.Compliance.create({
                    customerSiteId: complianceData.customerSiteId,
                    linkedVehicles: newLinkedVehicles
                });
            }

            // UPDATE PARENT STATE - FIXED: Only call once
            if (onComplianceUpdate) {
                const updatedCompliance = {
                    ...complianceData,
                    linkedVehicles: newLinkedVehicles
                };
                onComplianceUpdate(updatedCompliance);
            }

            // After successful link, add history
            const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

            const historyEntry = `\nCRM Compliance Dashboard :${user?.preferred_username} linked vehicles: ${vehicleDetails.join(', ')} to site at ${johannesburgTime}`;

            // Save to database
            await client.models.History.create({
                entityType: "COMPLIANCE",
                entityId: complianceData.customerSiteId,
                action: "LINK_VEHICLES",
                timestamp: new Date().toISOString(),
                updatedBy:user?.preferred_username||user?.email,
                details: historyEntry
            });

            // Clear selection
            setSelectedVehicles(new Set());
            setVehicleSearchTerm("");

        } catch (error) {
            console.error("Error linking vehicles:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnlinkVehicles = async () => {
        if (selectedVehicles.size === 0) return;
        setLoading(true);

        try {
            const { data: existingCompliance } = await client.models.Compliance.list({
                filter: { customerSiteId: { eq: complianceData.customerSiteId } }
            });

            if (!existingCompliance?.[0]?.id) return;

            // Get vehicle details for history BEFORE processing
            const vehicleDetails: string[] = [];
            Array.from(selectedVehicles).forEach(vehicleId => {
                const vehicle = vehicles.find(v => v.id === vehicleId);
                if (vehicle) {
                    vehicleDetails.push(`${vehicle.vehicleReg} - ${vehicle.vehicleMake} ${vehicle.vehicleModel}`);
                }
            });

            // Remove selected vehicles from linked vehicles
            const currentLinkedVehicles = existingCompliance[0].linkedVehicles || [];
            const newLinkedVehicles = currentLinkedVehicles.filter((id: string | null) =>
                id !== null && !selectedVehicles.has(id)
            );

            // UPDATE LOCAL STATE IMMEDIATELY - This is what fixes the UI
            const updatedLinkedVehicles = linkedVehicles.filter(vehicle =>
                !selectedVehicles.has(vehicle.id)
            );
            setLinkedVehicles(updatedLinkedVehicles);

            await client.models.Compliance.update({
                id: existingCompliance[0].id!,
                linkedVehicles: newLinkedVehicles
            });

            // UPDATE PARENT STATE - ADD THIS FOR UNLINKING
            if (onComplianceUpdate) {
                const updatedCompliance = {
                    ...complianceData,
                    linkedVehicles: newLinkedVehicles
                };
                onComplianceUpdate(updatedCompliance);
            }

            // After successful unlink, add history
            const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

            const historyEntry = `\nCRM Compliance Dashboard :${user?.preferred_username} unlinked vehicles: ${vehicleDetails.join(', ')} from site at ${johannesburgTime}`;

            // Save to database
            await client.models.History.create({
                entityType: "COMPLIANCE",
                entityId: complianceData.customerSiteId,
                action: "UNLINK_VEHICLES",
                timestamp: new Date().toISOString(),
                 updatedBy:user?.preferred_username||user?.email,
                details: historyEntry
            });

            // Clear selection
            setSelectedVehicles(new Set());

        } catch (error) {
            console.error("Error unlinking vehicles:", error);
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="space-y-6">
            {/* Vehicle Selection and Compliance Dashboard Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vehicle Selection Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            Manage Vehicle Links ({vehicles.length})
                        </CardTitle>
                        <CardDescription>
                            Select vehicles to view in dashboard and link to site
                        </CardDescription>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                ref={inputRef}
                                type="text"
                                placeholder="Search vehicles by reg, make, model, or fleet number..."
                                value={vehicleSearchTerm}
                                onChange={(e) => setVehicleSearchTerm(e.target.value)}
                                className="pl-10 pr-5"
                            />
                            {vehicleSearchTerm && (
                                <button
                                    onClick={clearSearch}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4 cursor-pointer" />
                                </button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {filteredVehicles.map((vehicle) => {
                                const isLinked = linkedVehicles.some(linked => linked.id === vehicle.id);
                                const isSelected = selectedVehicles.has(vehicle.id);

                                return (
                                    <div
                                        key={vehicle.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isSelected
                                            ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                                            : "border-border hover:border-gray-200 dark:hover:border-gray-700"
                                            } ${isLinked ? 'border-l-4 border-l-green-500 dark:border-l-green-400' : ''}`}
                                        onClick={() => toggleVehicle(vehicle.id)}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onChange={() => toggleVehicle(vehicle.id)}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm text-foreground">
                                                    {vehicle.vehicleReg} - {vehicle.vehicleMake} {vehicle.vehicleModel}
                                                </p>
                                                {isLinked && (
                                                    <Badge variant="default" className="text-xs">
                                                        Linked
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2 text-xs text-muted-foreground">
                                                <span>Fleet: {vehicle.fleetNumber}</span>
                                                <span>• Driver: {vehicle.currentDriver}</span>
                                                <span>• KM: {vehicle.currentkm?.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <Badge variant={isSelected ? "default" : "outline"}>
                                            {isSelected ? "Selected" : "Select"}
                                        </Badge>
                                    </div>
                                );
                            })}
                        </div>

                        {selectedVehicles.size > 0 && (
                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    {selectedVehicles.size} vehicle(s) selected for dashboard • {linkedVehicles.length} linked to site
                                </p>
                            </div>
                        )}

                        {filteredVehicles.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                No vehicles found
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Fleet Compliance Dashboard */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            Fleet Compliance Dashboard
                        </CardTitle>
                        <CardDescription>
                            Monitoring {dashboardVehicles.length} selected vehicle(s)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6 max-h-96 overflow-y-auto">
                            {dashboardVehicles.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Select vehicles to view compliance status
                                </div>
                            ) : (
                                dashboardVehicles.map((vehicle) => {
                                    const breakAndLuxStatus = getDocumentStatus(vehicle.breakandLuxExpirey);
                                    const licenseDiscStatus = getDocumentStatus(vehicle.liscenseDiscExpirey);
                                    const isLinked = linkedVehicles.some(linked => linked.id === vehicle.id);

                                    return (
                                        <div key={vehicle.id} className="border rounded-lg p-4 bg-card">
                                            {/* Vehicle Header with Quick Stats */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-semibold text-lg text-foreground">{vehicle.vehicleReg}</h3>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {vehicle.fleetNumber}
                                                        </Badge>
                                                        {isLinked && (
                                                            <Badge variant="default" className="text-xs">
                                                                Linked to Site
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {vehicle.vehicleMake} {vehicle.vehicleModel} • {vehicle.currentDriver}
                                                    </p>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span>📊 {vehicle.currentkm?.toLocaleString()} km</span>
                                                        <span>👤 {vehicle.currentDriver}</span>
                                                    </div>
                                                </div>

                                                {/* Overall Compliance Status */}
                                                <div className="text-right">
                                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${breakAndLuxStatus.variant === 'destructive' || licenseDiscStatus.variant === 'destructive'
                                                        ? 'bg-destructive/10 text-destructive-foreground border-destructive/20'
                                                        : 'bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
                                                        }`}>
                                                        <div className={`w-2 h-2 rounded-full ${breakAndLuxStatus.variant === 'destructive' || licenseDiscStatus.variant === 'destructive'
                                                            ? 'bg-destructive'
                                                            : 'bg-green-500'
                                                            }`} />
                                                        {breakAndLuxStatus.variant === 'destructive' || licenseDiscStatus.variant === 'destructive'
                                                            ? 'Non-Compliant'
                                                            : 'Compliant'
                                                        }
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Compliance Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {/* Break & Lux Test Card */}
                                                <div className={`p-3 rounded-lg border-2 ${breakAndLuxStatus.variant === 'destructive'
                                                    ? 'border-destructive/50 bg-destructive/10'
                                                    : breakAndLuxStatus.variant === 'secondary'
                                                        ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30'
                                                        : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
                                                    }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <FileText className={`h-4 w-4 ${breakAndLuxStatus.variant === 'destructive' ? 'text-destructive' :
                                                                breakAndLuxStatus.variant === 'secondary' ? 'text-orange-600 dark:text-orange-400' :
                                                                    'text-green-600 dark:text-green-400'
                                                                }`} />
                                                            <span className="font-medium text-sm text-foreground">Break & Lux Test</span>
                                                        </div>
                                                        <Badge variant={breakAndLuxStatus.variant}>
                                                            {breakAndLuxStatus.label}
                                                        </Badge>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground">Expiry:</span>
                                                            <span className={
                                                                breakAndLuxStatus.variant === 'destructive'
                                                                    ? 'text-destructive font-medium'
                                                                    : 'text-foreground'
                                                            }>
                                                                {vehicle.breakandLuxExpirey ? formatDate(vehicle.breakandLuxExpirey) : 'Not set'}
                                                            </span>
                                                        </div>

                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground">Document:</span>
                                                            {vehicle.breakandLuxTest ? (
                                                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => viewDoc(vehicle.breakandLuxTest)}>
                                                                    <Eye className="h-3 w-3 mr-1" />
                                                                    View
                                                                </Button>
                                                            ) : (
                                                                <span className="text-destructive font-medium">Missing</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* License Disc Card */}
                                                <div className={`p-3 rounded-lg border-2 ${licenseDiscStatus.variant === 'destructive'
                                                    ? 'border-destructive/50 bg-destructive/10'
                                                    : licenseDiscStatus.variant === 'secondary'
                                                        ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30'
                                                        : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
                                                    }`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className={`h-4 w-4 ${licenseDiscStatus.variant === 'destructive' ? 'text-destructive' :
                                                                licenseDiscStatus.variant === 'secondary' ? 'text-orange-600 dark:text-orange-400' :
                                                                    'text-green-600 dark:text-green-400'
                                                                }`} />
                                                            <span className="font-medium text-sm text-foreground">License Disc</span>
                                                        </div>
                                                        <Badge variant={licenseDiscStatus.variant}>
                                                            {licenseDiscStatus.label}
                                                        </Badge>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground">Expiry:</span>
                                                            <span className={
                                                                licenseDiscStatus.variant === 'destructive'
                                                                    ? 'text-destructive font-medium'
                                                                    : 'text-foreground'
                                                            }>
                                                                {vehicle.liscenseDiscExpirey ? formatDate(vehicle.liscenseDiscExpirey) : 'Not set'}
                                                            </span>
                                                        </div>

                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground">Status:</span>
                                                            <span className="text-blue-600 dark:text-blue-400 font-medium">Physical Date</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Action Buttons */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">Manage Site Links</h3>
                            <p className="text-sm text-gray-600">
                                {selectedVehicles.size} selected • {linkedVehicles.length} linked to site
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleUnlinkVehicles}
                                disabled={selectedVehicles.size === 0 || loading}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                ) : (
                                    <Minus className="h-4 w-4" />
                                )}
                                {loading ? "Processing..." : "Unlink from Site"}
                            </Button>
                            <Button
                                onClick={handleLinkVehicles}
                                disabled={selectedVehicles.size === 0 || loading}
                                className="flex items-center gap-2"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                ) : (
                                    <Plus className="h-4 w-4" />
                                )}
                                {loading ? "Processing..." : "Link to Site"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}