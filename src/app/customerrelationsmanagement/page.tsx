import { useNavigate } from "react-router-dom";
import { pageContainer } from "@/components/shell/page-container";
import { useState } from "react";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import Loading from "@/components/widgets/loading";
import { type ColumnDef } from "@tanstack/react-table";
import { Edit, Plus, MoreVertical, ShieldCheck } from "lucide-react";
import { DataGrid } from "@/components/shell/data-grid";
import { PageHeader } from "@/components/shell/page-header";
import { Toolbar, SearchField } from "@/components/shell/toolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermission } from "@/hooks/usePermission";
import ResponseModal from "@/components/widgets/response";
import { useListCustomerSitesQuery } from "@/state/api";


export default function CustomerRelationsManagement() {
    const navigate = useNavigate();
    // Sole consumer today, migrated for consistency with the rest of the
    // app's data layer (and to fix this read having no pagination before).
    const { data: filteredCustomerSites = [], isLoading: loading } = useListCustomerSitesQuery();
    const crmPermissions = usePermission("crm.edit");

    const [searchTerm, setSearchTerm] = useState("");
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

    const customerColumns: ColumnDef<any, any>[] = [
        {
            accessorKey: "siteName",
            header: "Site Name",
            cell: ({ row }: { row: any }) => <span className="font-medium">{row.original.siteName || "-"}</span>,
        },
        {
            accessorKey: "customerName",
            header: "Customer",
            cell: ({ row }: { row: any }) => <span>{row.original.customerName || "-"}</span>,
        },
        {
            accessorKey: "siteLocation",
            header: () => <span className="hidden lg:inline">Location</span>,
            cell: ({ row }: { row: any }) => (
                <span className="hidden lg:inline">{row.original.siteLocation || "-"}</span>
            ),
        },
        {
            accessorKey: "vendorNumber",
            header: () => <span className="hidden lg:inline">Vendor No.</span>,
            cell: ({ row }: { row: any }) => (
                <span className="hidden lg:inline">{row.original.vendorNumber || "-"}</span>
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
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => navigate(`/customerrelationsmanagement/edit/${row.original.id}`)}
                            >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => navigate(`/customerrelationsmanagement/compliance/${row.original.id}`)}
                            >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Compliance
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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

    const shown = data.filter((row) =>
        (row.siteName ?? "").toLowerCase().includes(searchTerm.trim().toLowerCase()),
    );

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
            <main className="flex-1 mt-25 pb-20">
                <div className={pageContainer()}>
                    <PageHeader
                        title="Customers"
                        description="Manage all customers in your organization."
                        actions={
                            <Button onClick={() => addCustomer()} className="cursor-pointer bg-green-600 hover:bg-green-700">
                                <Plus className="h-4 w-4 mr-1" />
                                Add Customer
                            </Button>
                        }
                    />
                    <Toolbar>
                        <SearchField
                            aria-label="Search customers"
                            placeholder="Search by site name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </Toolbar>
                    <DataGrid
                        data={shown}
                        columns={customerColumns}
                        pageSize={10}
                        storageKey="customerTablePagination"
                        noun="sites"
                        emptyMessage="No customers found."
                    />
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