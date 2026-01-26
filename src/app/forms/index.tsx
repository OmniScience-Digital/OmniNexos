import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Loading from "@/components/widgets/loading";
import { client } from "@/services/schema";
import type { Dashboard } from "@/types/dashboard.types";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, LayoutDashboard, MoreVertical, Search } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/widgets/deletedialog";

export default function FormsLanding() {
    const navigate = useNavigate();
    const [dashboards, setDashboards] = useState<Dashboard[]>([]);
    const [loading, setLoading] = useState(true);
    const [dashboardToDelete, setDashboardToDelete] = useState<number | null>(null);
    const [opendelete, setOpendelete] = useState(false);
    //search forms
    const [searchQuery, setSearchQuery] = useState("");



    // Fetch dashboards
    useEffect(() => {

        const subscription = client.models.Landing.observeQuery().subscribe({
            next: (data) => {

                const dashboardData = data.items
                    .filter(item => item.items)
                    .sort((a, b) => (a.items || "").localeCompare(b.items || ""));

                const cleanDashboardData: Dashboard[] = dashboardData
                    .filter(d => /form$/i.test((d.items ?? "").trim())) // keeps items ending with 'Form'
                    .map(d => ({
                        ...d,
                        key: d.key ?? "",
                        items: d.items ?? ""
                    }));

                setDashboards(cleanDashboardData);
                setLoading(false);
            },
            error: (error) => {
                console.error('🔴 DEBUG: Forms error:', error);
                setLoading(false);
            },
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Filter dashboards based on search query
    const filteredDashboards = dashboards.filter(dashboard =>
        dashboard.items?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get category from dashboard key - SIMPLE VERSION
    const getCategory = (key: string | null) => {
        if (!key) return "General";
        return key;
    };

    // Get category color
    const getCategoryColor = (category: string) => {
        const colors: { [key: string]: string } = {
            IMS: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
            SCF: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
            MRKT: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
            Finance: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
            Project: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
            HR: "bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
            General: "bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
        };
        return colors[category] || "bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300";
    };

    // Redirect to dashboard
    const redirectToDashboard = (name: Dashboard) => {
        const path = (name.items.toLocaleLowerCase()).replace(/\s+/g, "");
        navigate(`/${path}`);
    };

    // Delete dashboard at a specific index
    const deleteDashboard = async (index: number) => {
        const dashboard = dashboards[index];
        console.log('🗑️ Deleting form:', dashboard);
        setLoading(true);

        const { errors } = await client.models.Landing.delete({
            id: dashboard.id,
        });

        if (errors) {
            console.error("Error deleting form:", errors);
        } else {
            const updatedDashboards = dashboards.filter((_, i) => i !== index);
            setDashboards(updatedDashboards);

        }
        setLoading(false);
    };

    // Handle delete confirmation
    const handleDeleteConfirmation = () => {
        if (dashboardToDelete !== null) {
            deleteDashboard(dashboardToDelete);
            setDashboardToDelete(null);
            setOpendelete(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            {loading ? (
                <Loading />
            ) : (
                <main className="flex-1 p-1 mt-20 pb-20">
                    <div className="max-w-4xl mx-auto">
                        <div className="mt-4">
                            <div className="flex items-center gap-3 mb-2">
                                <FolderOpen className="h-5 w-5 text-primary" />
                                <h1 className="text-l font-bold">Forms Dashboard</h1>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="mb-3 sm:mb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search forms..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 sm:pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                                />
                            </div>
                        </div>

                        {/* Forms List */}
                        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                            <CardContent className="p-1 sm:p-2">
                                <div className="space-y-1">
                                    {filteredDashboards.map((dashboard, index) => (
                                        <React.Fragment key={dashboard.id}>
                                            <div className="group p-2 sm:p-3 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors duration-200 cursor-pointer rounded-lg border border-transparent hover:border-blue-200 dark:hover:border-blue-800">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                                        {/* Icon */}
                                                        <div className="hidden xs:block p-1.5 sm:p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                                            <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0" onClick={() => redirectToDashboard(dashboard)}>
                                                            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                                                                <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate text-xs sm:text-sm">
                                                                    {dashboard.items}
                                                                </h3>
                                                                <Badge
                                                                    variant="secondary"
                                                                    className={`${getCategoryColor(dashboard.key)} text-xs font-normal px-1.5 py-0 hidden sm:inline-flex`}
                                                                >
                                                                    {getCategory(dashboard.key)}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-0.5 sm:gap-1">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="opacity-70 group-hover:opacity-100 transition-opacity duration-200 h-6 w-6 sm:h-7 sm:w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                                                    onMouseDown={(e) => e.preventDefault()}
                                                                    onClick={(e) => e.preventDefault()}
                                                                >
                                                                    <MoreVertical className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent
                                                                align="end"
                                                                className="text-xs w-28 sm:w-32"
                                                                onCloseAutoFocus={(e) => e.preventDefault()}
                                                            >
                                                                <DropdownMenuItem
                                                                    className="text-red-600 focus:text-red-600 text-xs cursor-pointer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDashboardToDelete(index);
                                                                        setOpendelete(true);
                                                                    }}
                                                                    onSelect={(e) => e.preventDefault()}
                                                                >
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="my-2 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent dark:via-gray-600" />
                                        </React.Fragment>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <ConfirmDialog
                            open={opendelete}
                            setOpen={setOpendelete}
                            handleConfirm={handleDeleteConfirmation}
                        />
                    </div>
                </main>
            )}
        </div>
    );
}