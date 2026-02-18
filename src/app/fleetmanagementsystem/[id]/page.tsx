import { client } from "@/services/schema";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable } from "@/components/table/datatable";
import { EditIcon, ArrowUpDown, MoreVertical, Car, ArrowLeft } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getUrl } from 'aws-amplify/storage';
import type { Inspection } from "@/types/inspection.type";

export default function InspectionsPage() {
    const navigate = useNavigate();
    const params = useParams();
    const fleetId = decodeURIComponent(params.id as string);

    const [loading, setLoading] = useState(true);
    const [inspections, setInspections] = useState<Inspection[]>([]);
    const [fleetInfo, setFleetInfo] = useState<any>(null);

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
        // Fetch fleet information
        const fetchFleetInfo = async () => {
            try {
                const { data: fleet } = await client.models.Fleet.get({ id: fleetId });
                setFleetInfo(fleet);
            } catch (error) {
                console.error("Error fetching fleet info:", error);
            }
        };

        fetchFleetInfo();

        // Subscribe to real-time updates for inspections
        const subscription = client.models.Inspection.observeQuery({
            filter: { fleetid: { eq: fleetId } },
        }).subscribe({
            next: async ({ items, isSynced }) => {
                const mappedInspections: Inspection[] = await Promise.all(
                    (items || []).map(async (item) => {
                        // Convert S3 keys to actual URLs
                        const s3Keys = (item.photo ?? []).filter((x): x is string => x !== null);
                        const photoUrls = await getS3ImageUrls(s3Keys);

                        return {
                            id: item.id,
                            fleetid: item.fleetid,
                            inspectionNo: item.inspectionNo,
                            vehicleVin: item.vehicleVin,
                            inspectionDate: item.inspectionDate,
                            inspectionTime: item.inspectionTime,
                            odometerStart: item.odometerStart,
                            vehicleReg: item.vehicleReg,
                            inspectorOrDriver: item.inspectorOrDriver,
                            oilAndCoolant: item.oilAndCoolant,
                            fuelLevel: item.fuelLevel,
                            seatbeltDoorsMirrors: item.seatbeltDoorsMirrors,
                            handbrake: item.handbrake,
                            tyreCondition: item.tyreCondition,
                            spareTyre: item.spareTyre,
                            numberPlate: item.numberPlate,
                            licenseDisc: item.licenseDisc,
                            leaks: item.leaks,
                            lights: item.lights,
                            defrosterAircon: item.defrosterAircon,
                            emergencyKit: item.emergencyKit,
                            clean: item.clean,
                            warnings: item.warnings,
                            windscreenWipers: item.windscreenWipers,
                            serviceBook: item.serviceBook,
                            siteKit: item.siteKit,
                            photo: photoUrls,
                            history: item.history
                        };
                    })
                );
                // Sort inspections by inspectionNo descending (highest first)
                const sortedInspections = mappedInspections.sort((a, b) => {
                    const aNo = a.inspectionNo || 0;
                    const bNo = b.inspectionNo || 0;
                    return bNo - aNo;
                });

                setInspections(sortedInspections);

                if (isSynced) {
                    setLoading(false);
                }
            },
            error: (error) => {
                console.error("Error subscribing to inspections:", error);
                setLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [fleetId]);

    // Handle edit - navigate to edit page
    const handleEdit = (inspection: any) => {
        navigate(`/fleetmanagementsystem/${fleetId}/edit/${inspection.id}`);
    };

    // Mobile-friendly columns
    const columns: ColumnDef<object, any>[] = [
        {
            accessorKey: "inspectionNo",
            header: ({ column }: { column: any }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="p-0 h-auto font-medium"
                >
                    Inspect No
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
            ),
            cell: ({ row }: { row: any }) => (
                <div className="font-medium text-sm">
                    #{row.original.inspectionNo}
                </div>
            ),
        },
        {
            accessorKey: "inspectionDate",
            header: "Date",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm">{row.original.inspectionDate}</div>
            ),
        },
        {
            accessorKey: "inspectorOrDriver",
            header: "Inspector",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm hidden lg:block">{row.original.inspectorOrDriver}</div>
            ),
        },
        {
            accessorKey: "odometerStart",
            header: "Odometer",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm hidden md:block">{row.original.odometerStart?.toLocaleString()}</div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }: { row: any }) => {
                const passed = [
                    row.original.oilAndCoolant,
                    row.original.fuelLevel,
                    row.original.lights,
                    row.original.tyreCondition
                ].filter(Boolean).length;

                return (
                    <Badge
                        variant={passed >= 3 ? "default" : "destructive"}
                        className="text-xs"
                    >
                        {passed >= 3 ? "Pass" : "Fail"}
                    </Badge>
                );
            },
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: any }) => (
                <div className="flex justify-start">
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
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ),
        },
    ];

    const data = Array.isArray(inspections)
        ? inspections.map((inspection) => {
            return {
                id: inspection.id || "",
                inspectionNo: inspection.inspectionNo || 0,
                inspectionDate: inspection.inspectionDate || "",
                inspectorOrDriver: inspection.inspectorOrDriver || "",
                odometerStart: inspection.odometerStart || 0,
                oilAndCoolant: inspection.oilAndCoolant || false,
                fuelLevel: inspection.fuelLevel || false,
                lights: inspection.lights || false,
                tyreCondition: inspection.tyreCondition || false,
            };
        })
        : [];

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />

            {loading ? (
                <Loading />
            ) : (
                <main className="flex-1 px-2 sm:px-4 mt-25 pb-20">
                    <div className="container mx-auto max-w-7xl">
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
                                        {fleetInfo?.vehicleReg || 'Vehicle'} Inspections
                                    </h1>
                                    <p className="text-sm text-muted-foreground">
                                        {fleetInfo?.fleetNumber} • {fleetInfo?.vehicleMake} {fleetInfo?.vehicleModel}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Inspections List */}
                        <div className="bg-white rounded-lg border">
                            <DataTable
                                title={"Vehicle Inspections"}
                                data={data}
                                columns={columns}
                                pageSize={10}
                                storageKey="inspectionsTablePagination"
                                searchColumn="inspectionDate"
                            />
                        </div>
                    </div>
                </main>
            )}
            <Footer />
        </div>
    )
}

