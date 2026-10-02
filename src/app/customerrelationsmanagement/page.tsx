import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import Loading from "@/components/widgets/loading";
import { type ColumnDef } from "@tanstack/react-table";
import { Edit, Plus } from "lucide-react";
import { DataTable } from "@/components/table/datatable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermission } from "@/hooks/usePermission";
import ResponseModal from "@/components/widgets/response";
import { useListCustomerSitesQuery } from "@/state/api";


export default function CustomerRelationsManagement() {
    const navigate = useNavigate();
    // Sole consumer today, migrated for consistency with the rest of the
    // app's data layer (and to fix this read having no pagination before).
    const { data: filteredCustomerSites = [], isLoading: loading } = useListCustomerSitesQuery();
    const crmPermissions = usePermission("crm.edit");

    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");




    const addCustomer = () => {
        if (!crmPermissions) {
            setShow(true);
            setSuccessful(false)
            setMessage("⛔ No crm edit permission")

            return;
        }
        navigate('/customerrelationsmanagement/create')

    }

    // Mobile-friendly columns
    const customerColumns: ColumnDef<object, any>[] = [
        {
            accessorKey: "siteName",
            header: "Site Name",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm font-medium text-slate-700">
                    {row.original.siteName || "-"}
                </div>
            ),
        },
        {
            accessorKey: "customerName",
            header: "Customer Name",
            cell: ({ row }: { row: any }) => (
                <div className="text-sm font-medium text-slate-700">
                    {row.original.customerName || "-"}
                </div>
            ),
        },
        {
            accessorKey: "siteLocation",
            header: () => <div className="hidden lg:block">Site Location</div>,
            cell: ({ row }: { row: any }) => (
                <div className="text-sm font-medium text-slate-700 hidden lg:block">
                    {row.original.siteLocation || "-"}
                </div>
            ),
        },
        {
            accessorKey: "vendorNumber",
            header: () => <div className="hidden lg:block">Vendor Number</div>,
            cell: ({ row }: { row: any }) => (
                <div className="text-sm font-medium text-slate-700 hidden lg:block">
                    {row.original.vendorNumber || "-"}
                </div>
            ),
        },
        {
            id: "edit",
            header: "Edit",
            cell: ({ row }: { row: any }) => (
                <div
                    onClick={() => navigate(`/customerrelationsmanagement/edit/${row.original.id}`)}

                >
                    <Edit className="
                    h-4 w-4 mr-2
                    cursor-pointer
                    hover:bg-slate-100
                    active:bg-slate-200
                    active:scale-95
                    rounded
                    transition
                    inline-block
                "/>
                </div>
            ),
        },
        {
            id: "compliance",
            header: "Compliance",
            cell: ({ row }: { row: any }) => (
                <div>
                    <Edit
                        onClick={() =>
                            navigate(`/customerrelationsmanagement/compliance/${row.original.id}`)
                        }
                        className="
                        h-4 w-4 mr-2
                        cursor-pointer
                        hover:bg-slate-100
                        active:bg-slate-200
                        active:scale-95
                        rounded
                        transition
                        inline-block
                    "
                    />
                </div>


            ),
        },
    ];

    const data = Array.isArray(filteredCustomerSites)
        ? filteredCustomerSites.map((customer) => ({
            id: customer.id,
            siteName: customer.siteName,
            customerName: customer.customerName,
            siteLocation: customer.siteLocation,
            vendorNumber: customer.vendorNumber,
            registrationNo: customer.registrationNo,
            vatNo: customer.vatNo,
            siteContactName: customer.siteContactName,
            siteContactNumber: customer.siteContactNumber,
        }))
        : [];

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-background from-slate-50 to-blue-50/30">
                <Navbar />
                <Loading />
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background from-slate-50 to-blue-50/30">
            <Navbar />
            <main className="flex-1 px-4 sm:px-6 mt-25 pb-20">
                <div className="container mx-auto max-w-7xl mt-8">
                    {/* Header Section */}

                    <Card className="border-slate-200 shadow-sm bg-background">
                        <CardHeader className="pb-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-background">
                                <div>
                                    <CardTitle className="text-xl text-shadow-slate-400 bg-background">Customer Management</CardTitle>
                                    <CardDescription>
                                        Manage all customers in your organization
                                    </CardDescription>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => addCustomer()}
                                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg shadow-blue-500/25"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add customer
                                    </Button>
                                </div>


                            </div>
                        </CardHeader>

                        <CardContent className="p-0">
                            {/* Data Table */}
                            <div className="border-t border-slate-200">
                                <DataTable
                                    title={"Customer"}
                                    data={data}
                                    columns={customerColumns}
                                    pageSize={10}
                                    storageKey={"customerTablePagination"}
                                    searchColumn={"siteName"}
                                />
                            </div>
                        </CardContent>
                    </Card>
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