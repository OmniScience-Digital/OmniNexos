import { client } from "@/services/schema";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Category } from "@/types/form.types";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/table/datatable";
import { EditIcon, ArrowUpDown, FileArchive, Download, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import { mapApiCategoryToCategory } from "../stockcontrolform/Components/map.categories.helper";
import Loading from "@/components/widgets/loading";
import PropLoading from "@/components/widgets/prop_loading";
import { Button } from "@/components/ui/button";



//add type declaration for autoTable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
        lastAutoTable?: {
            finalY: number;
        };
    }
}

// Helper function to convert data to CSV
const convertToCSV = (categoryData: CategoryWithRelations): string => {
    const rows: string[] = [];

    // First row: Category
    rows.push(`Category,${categoryData.categoryName}`);
    rows.push(''); // Empty row for spacing

    categoryData.subcategories.forEach((subcategory) => {
        // Third row: Sub Category
        rows.push(`Sub Category,${subcategory.subcategoryName}`);
        rows.push(''); // Empty row for spacing

        // Fifth row: Headers for components
        const headers = [
            'Component ID',
            'Component Name',
            'Description',
            'Primary Supplier',
            'Primary Supplier Item Code',
            'Secondary Supplier',
            'Secondary Supplier Item Code',
            'Quantity Ex Stock',
            'Current Stock',
            'Notes'
        ];
        rows.push(headers.join(','));

        // Component data
        subcategory.components.forEach(component => {
            const row = [
                component.componentId || '',
                component.componentName || '',
                component.description || '',
                component.primarySupplier || '',
                component.primarySupplierItemCode || '',
                component.secondarySupplier || '',
                component.secondarySupplierItemCode || '',
                component.qtyExStock?.toString() || '0',
                component.currentStock?.toString() || '0',
                component.notes || ''
            ];

            // Escape CSV values
            const escapedRow = row.map(value => {
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });

            rows.push(escapedRow.join(','));
        });

        // Add spacing between subcategories
        rows.push('');
        rows.push('');
    });

    return rows.join('\n');
};

// Helper function to download CSV
const downloadCSV = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Helper function to generate PDF

const generatePDF = (categoryData: CategoryWithRelations) => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 15);


    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`Category: ${categoryData.categoryName}`, 14, 22);


    let startY = 30;

    categoryData.subcategories.forEach((subcategory) => {
        // Add subcategory header
        if (startY > 270) {
            doc.addPage();
            startY = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(50);
        doc.text(`Subcategory: ${subcategory.subcategoryName}`, 14, startY);
        startY += 8;

        if (subcategory.components.length === 0) {
            doc.setFontSize(10);
            doc.setTextColor(120);
            doc.text('No components found', 20, startY);
            startY += 15;
            return;
        }

        // Prepare table data
        const tableData = subcategory.components.map(component => [
            component.componentId || '-',
            component.componentName || '-',
            component.currentStock?.toString() || '0',
            component.qtyExStock?.toString() || '0',
            component.primarySupplier || '-',
            component.secondarySupplier || '-'
        ]);

        // Add table using the imported autoTable function
        autoTable(doc, {
            startY: startY,
            head: [['Component ID', 'Name', 'Current Stock', 'Ex Stock', 'Primary Supplier', 'Secondary Supplier']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [66, 66, 66],
                textColor: 255,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 8,
                cellPadding: 2
            },
            margin: { left: 14, right: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 10;
    });

    return doc;
};

export default function IMS() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [prop_loading, propsetLoading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [printMenu, setPrintMenu] = useState<{
        isOpen: boolean;
        categoryId: string | null;
        position: { top: number; left: number };
    }>({
        isOpen: false,
        categoryId: null,
        position: { top: 0, left: 0 }
    });

    useEffect(() => {
        // Subscribe to real-time updates
        const subscription = client.models.Category.observeQuery().subscribe({
            next: ({ items, isSynced }) => {
                // Map API data to our Category type
                const mappedCategories: Category[] = (items || []).map(mapApiCategoryToCategory);
                setCategories(mappedCategories);

                if (isSynced) {
                    setLoading(false);
                }
            },
            error: (error) => {
                console.error("Error subscribing to categories:", error);
                setLoading(false);
            }
        });

        // Cleanup subscription on unmount
        return () => {
            subscription.unsubscribe();
        };
    }, [categories]);


    //table data
    const columns: ColumnDef<object, any>[] = [
        {
            accessorKey: "catname",
            header: ({ column }: { column: any }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Category
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
        },
        {
            accessorKey: "edit",
            header: "Edit",
            cell: ({ row }: { row: any }) => (
                <Button
                    className="ml-auto cursor-pointer"
                    onClick={() => redirectToDashboard(row.original.catname, row.original.id)}
                >
                    <EditIcon />
                </Button>
            ),
        },
        {
            accessorKey: "print",
            header: "Print",
            cell: ({ row }: { row: any }) => (
                <div className="relative">
                    <Button
                        className="bg-gray-500 ml-auto cursor-pointer"
                        onClick={(e) => handlePrintClick(e, row.original.id)}
                    >
                        <FileArchive />
                    </Button>
                </div>
            ),
        },
    ];

    const data = Array.isArray(categories)
        ? categories.map((cat) => {
            return {
                id: cat.id || "",
                catname: cat.categoryName || "",
                edit: <EditIcon id={cat.id} key={`edit-${cat.id}`} />,
                manage: <FileArchive id={cat.id} key={`download-${cat.id}`} />,
            };
        })
        : [];

    // Redirect to dashboard
    const redirectToDashboard = (name: string, id: string) => {
        const catname = name;
        localStorage.setItem('categoryName', catname.toUpperCase());
        navigate(`/subcategories/${id}`);
    };

    // Handle print button click to show menu
    const handlePrintClick = (event: React.MouseEvent, id: string) => {
        const button = event.currentTarget as HTMLElement;
        const rect = button.getBoundingClientRect();

        setPrintMenu({
            isOpen: true,
            categoryId: id,
            position: {
                top: rect.bottom,
                left: rect.left
            }
        });
    };

    // Close print menu
    const closePrintMenu = () => {
        setPrintMenu(prev => ({ ...prev, isOpen: false }));
    };

    const fetchCategoriesWithRelations = async (categoryId: string): Promise<CategoryWithRelations | null> => {
        try {
            // Fetch category with its subcategories and their components
            const { data: category, errors } = await client.models.Category.get(
                { id: categoryId },
                {
                    selectionSet: [
                        'id',
                        'categoryName',
                        'subcategories.*',
                        'subcategories.components.*'
                    ]
                }
            );

            if (errors || !category) {
                console.error("Error fetching category with relations:", errors);
                return null;
            }


            return category as unknown as CategoryWithRelations;


        } catch (error) {
            console.error("Error in fetchCategoriesWithRelations:", error);
            return null;
        }
    }

    // Download CSV function
    const handleDownloadCSV = async () => {
        const categoryId = printMenu.categoryId;
        if (!categoryId) return;

        try {
            propsetLoading(true);
            const categoryData = await fetchCategoriesWithRelations(categoryId);

            if (categoryData) {
                const csvContent = convertToCSV(categoryData);
                const filename = `${categoryData.categoryName.replace(/\s+/g, '_')}_inventory_${new Date().toISOString().split('T')[0]}.csv`;
                downloadCSV(csvContent, filename);
            } else {
                console.error("No category data found");
            }
        } catch (error) {
            console.error("Error downloading CSV:", error);
        } finally {
            propsetLoading(false);
        }
    };

    // Download PDF function
    const handleDownloadPDF = async () => {
        const categoryId = printMenu.categoryId;
        if (!categoryId) return;

        try {
            propsetLoading(true);
            const categoryData = await fetchCategoriesWithRelations(categoryId);

            if (categoryData) {
                const pdf = generatePDF(categoryData);
                const filename = `${categoryData.categoryName.replace(/\s+/g, '_')}_inventory_${new Date().toISOString().split('T')[0]}.pdf`;
                pdf.save(filename);
            } else {
                console.error("No category data found");
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            propsetLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />

            {loading ? (
                <Loading />
            ) : (

                <main className="flex-1 p-1 mt-20 pb-20">
                    <DataTable
                        title={"Category Selection"}
                        data={data}
                        columns={columns}
                        pageSize={10}
                        storageKey="categoriesTablePagination"
                    />
                    {prop_loading && <PropLoading name="Downloading file" />}

                    {/* Print Menu */}
                    <PrintMenu
                        isOpen={printMenu.isOpen}
                        onClose={closePrintMenu}
                        onDownloadCSV={handleDownloadCSV}
                        onDownloadPDF={handleDownloadPDF}
                        position={printMenu.position}
                    />
                </main>
            )}
            <Footer />
        </div>
    )
}



interface PrintMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onDownloadCSV: () => void;
    onDownloadPDF: () => void;
    position: { top: number; left: number };
}

interface CategoryWithRelations {
    id: string;
    categoryName: string;
    subcategories: Array<{
        id: string;
        subcategoryName: string;
        categoryId: string;
        components: Array<{
            id: string;
            componentId: string;
            componentName: string | null;
            description: string | null;
            primarySupplierId: string | null;
            primarySupplier: string | null;
            primarySupplierItemCode: string | null;
            secondarySupplierId: string | null;
            secondarySupplier: string | null;
            secondarySupplierItemCode: string | null;
            qtyExStock: number | null;
            currentStock: number | null;
            notes: string | null;
            history: string | null;
            subcategoryId: string;
            createdAt: string;
            updatedAt: string;
        }>;
    }>;
}

const PrintMenu: React.FC<PrintMenuProps> = ({
    isOpen,
    onClose,
    onDownloadCSV,
    onDownloadPDF,
    position
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-48"
            style={{
                top: position.top,
                left: position.left,
            }}
        >
            <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-700">Download As</span>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-6 w-6 p-0 hover:bg-gray-100 cursor-pointer"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <button
                onClick={() => {
                    onDownloadCSV();
                    onClose();
                }}
                className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
                <Download className="h-4 w-4 mr-3 text-green-600" />
                <span>Download CSV</span>
            </button>

            <button
                onClick={() => {
                    onDownloadPDF();
                    onClose();
                }}
                className="w-full flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
                <FileArchive className="h-4 w-4 mr-3 text-red-600" />
                <span>Download PDF</span>
            </button>
        </div>
    );
};
