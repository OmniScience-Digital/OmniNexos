// components/components-list.tsx
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
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import type { Component } from "@/types/ims.types";
import { client } from "@/services/schema";

interface ComponentsListProps {
  components: Component[];
  onComponentUpdate: (component: Component) => void;
  onComponentDelete: (componentId: string) => void;
}

export function ComponentsList({
  components,
  onComponentUpdate,
  onComponentDelete
}: ComponentsListProps) {
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [editedComponent, setEditedComponent] = useState<Partial<Component>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  const itemsPerPage = 10;

  const [opendelete, setOpendelete] = useState(false); // Dialog visibility state for deleting dashboard
  const [history, setHistory] = useState("");

  useEffect(() => {
    const getHistory = async () => {
      if (!editedComponent?.id) return;

      const employeeHistory = await client.models.History.getHistoryByEntityId(
        { entityId: editedComponent.id },
        { sortDirection: 'DESC', limit: 20 }
      );

      const historyString = employeeHistory.data
        .map(entry => entry.details)
        .join('');

      setHistory(historyString);
    };

    getHistory();
  }, [editedComponent?.id]);

  // useEffect(() => {
  //   // Initial load with pagination
  //   const loadInitialData = async () => {
  //     if (!subcategoryId) {
  //       setComponents([]);
  //       return;
  //     }

  //     try {
  //       setComponentsLoading(true);
  //       const { nextToken, data } = await client.models.Component.list({
  //         filter: { subcategoryId: { eq: subcategoryId} },
  //         limit: 10,
  //         selectionSet: ['id', 'componentId', 'componentName', 'description', 'primarySupplierId', 'primarySupplier', 'primarySupplierItemCode', 'secondarySupplierId', 'secondarySupplier', 'secondarySupplierItemCode', 'minimumStock', 'currentStock', 'notes', 'subcategoryId']
  //       });

  //       console.log(data);
  //       if (data) {
  //         setComponents(
  //           data.map(item => ({
  //             id: item.id,
  //             componentId: item.componentId,
  //             componentName: item.componentName || "",
  //             description: item.description || "",
  //             primarySupplierId: item.primarySupplierId || "",
  //             primarySupplier: item.primarySupplier || "",
  //             primarySupplierItemCode: item.primarySupplierItemCode || "",
  //             secondarySupplierId: item.secondarySupplierId || "",
  //             secondarySupplier: item.secondarySupplier || "",
  //             secondarySupplierItemCode: item.secondarySupplierItemCode || "",
  //             minimumStock: item.minimumStock || 0,
  //             currentStock: item.currentStock || 0,
  //             notes: item.notes || "",
  //             subcategoryId: item.subcategoryId,
  //           }))
  //         );
  //       }

  //       setPaginationToken(nextToken);
  //       setshowmoreButton(!!nextToken);
  //       setComponentsLoading(false);
  //     } catch (error) {
  //       console.error("Error fetching components:", error);
  //       setComponentsLoading(false);
  //     }
  //   }

  //   loadInitialData();
  // }, []);
  const filteredComponents = useMemo(() => {
    return components.filter(component => {
      const matchesSearch =
        component.componentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.componentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.secondarySupplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        component.primarySupplier?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in-stock' && (component.currentStock >= component.minimumStock)) ||
        (stockFilter === 'out-of-stock' && (component.currentStock < component.minimumStock));

      return matchesSearch && matchesStock;
    });
  }, [components, searchTerm, stockFilter]);

  const totalPages = Math.ceil(filteredComponents.length / itemsPerPage);
  const paginatedComponents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredComponents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredComponents, currentPage, itemsPerPage]);

  const handleEdit = (component: Component) => {
    setEditingComponent(component);
    setEditedComponent({ ...component });
  };

  const handleSave = async () => {
    if (editingComponent && editedComponent) {
      // Get user from localStorage - proper way to handle it
      const storedName = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";

      // Get Johannesburg time
      const johannesburgTime = new Date().toLocaleString("en-ZA", {
        timeZone: "Africa/Johannesburg"
      });

      let historyEntries = "";

      // Check if minimumStock changed
      if (editedComponent.minimumStock !== undefined &&
        editedComponent.minimumStock !== editingComponent.minimumStock) {
        historyEntries += `${storedName} updated minimumStock from ${editingComponent.minimumStock} to ${editedComponent.minimumStock} at ${johannesburgTime}\n`;
      }

      // Check if currentStock changed
      if (editedComponent.currentStock !== undefined &&
        editedComponent.currentStock !== editingComponent.currentStock) {
        historyEntries += `${storedName} updated currentStock from ${editingComponent.currentStock} to ${editedComponent.currentStock} at ${johannesburgTime}\n`;
      }

      // Create the updated component with history
      const updatedComponent = {
        ...editingComponent,
        ...editedComponent,
      };

      console.log("Saving component with history:", updatedComponent); // Debug log

      onComponentUpdate(updatedComponent);

      console.log(historyEntries);
      // Save to new History DB if there were changes
      if (historyEntries.trim() !== "") {
        try {
          await client.models.History.create({
            entityType: "COMPONENT",
            entityId: editingComponent.id,
            action: "UPDATE",
            timestamp: new Date().toISOString(),
            details: historyEntries,
          });
          setHistory(historyEntries);

        } catch (error) {
          console.log("Saving History ", error)
        }

      }

      setEditingComponent(null);
      setEditedComponent({});
    }
  };

  const handleCancel = () => {
    setEditingComponent(null);
    setEditedComponent({});
  };
  const handleChange = (field: keyof Component, value: string | number) => {
    // For all fields, update normally w
    setEditedComponent(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Add state to track the component to be deleted
  const [componentToDelete, setComponentToDelete] = useState<{ id: string, name: string } | null>(null);

  // Modify your delete handler
  const handleDelete = (componentId: string, componentName: string) => {
    try {
      setOpendelete(false);
      console.log("Deleting component:", componentId, componentName);

      if (!componentId) {
        console.warn("No ID provided for deletion.");
        return;
      }

      onComponentDelete(componentId);
      setComponentToDelete(null); // Clear after deletion
    } catch (error) {
      console.error("Error deleting component:", error);
    }
  };

  // Create a wrapper function with NO parameters
  const handleConfirmWrapper = () => {
    if (componentToDelete) {
      handleDelete(componentToDelete.id, componentToDelete.name);
    }
  };

  // Update your delete button click handler
  const handleDeleteClick = (componentId: string, componentName: string) => {
    setComponentToDelete({ id: componentId, name: componentName });
    setOpendelete(true);
  };




  if (components.length === 0) {
    return (
      <Card className="h-48">
        <CardContent className="p-6 h-full flex items-center justify-center">
          <p className="text-muted-foreground text-center">No components found</p>
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
            Components
            <Badge variant="secondary" className="text-xs">
              {filteredComponents.length}
            </Badge>
          </CardTitle>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search components..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-8 h-9 text-sm"
              />
            </div>

            <div className="flex gap-1">
              <Button
                variant={stockFilter === 'all' ? "default" : "outline"}
                size="sm"
                onClick={() => setStockFilter('all')}
                className="h-9 text-xs  cursor-pointer"
              >
                All
              </Button>
              <Button
                variant={stockFilter === 'in-stock' ? "default" : "outline"}
                size="sm"
                onClick={() => setStockFilter('in-stock')}
                className="h-9 text-xs  cursor-pointer"
              >
                In Stock
              </Button>
              <Button
                variant={stockFilter === 'out-of-stock' ? "default" : "outline"}
                size="sm"
                onClick={() => setStockFilter('out-of-stock')}
                className="h-9 text-xs  cursor-pointer"
              >
                Out of Stock
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Components Table */}
        <div className="space-y-2">
          {paginatedComponents.map((component) => (
            <div key={component.id} className="border rounded-lg p-4 text-sm">
              {editingComponent?.id === component.id ? (
                // Edit Mode - Enhanced Form with Textareas
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-base">Editing Component</h4>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave}
                        className="h-8 text-xs cursor-pointer bg-[#165b8c] text-white hover:bg-[#1e6fae] transition-colors duration-200">
                        <Save className="h-3 w-3 mr-1 " />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 text-xs cursor-pointer">
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Component ID *</label>
                      <Input
                        value={editedComponent.componentId || ""}
                        onChange={(e) => handleChange("componentId", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Component Name</label>
                      <Input
                        value={editedComponent.componentName || ""}
                        onChange={(e) => handleChange("componentName", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Primary Supplier</label>
                      <Input
                        value={editedComponent.primarySupplier || ""}
                        onChange={(e) => handleChange("primarySupplier", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Primary Supplier Item Code</label>
                      <Input
                        value={editedComponent.primarySupplierItemCode || ""}
                        onChange={(e) => handleChange("primarySupplierItemCode", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Secondary Supplier</label>
                      <Input
                        value={editedComponent.secondarySupplier || ""}
                        onChange={(e) => handleChange("secondarySupplier", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Secondary Supplier Item Code</label>
                      <Input
                        value={editedComponent.secondarySupplierItemCode || ""}
                        onChange={(e) => handleChange("secondarySupplierItemCode", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Min Stock</label>
                      <Input
                        type="number"
                        value={editedComponent.minimumStock || 0}
                        onChange={(e) => handleChange("minimumStock", parseInt(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Current Stock</label>
                      <Input
                        type="number"
                        value={editedComponent.currentStock || 0}
                        onChange={(e) => handleChange("currentStock", parseInt(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  {/* Textareas for longer text fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Textarea
                        value={editedComponent.description || ""}
                        onChange={(e) => handleChange("description", e.target.value)}
                        className="min-h-[100px] text-sm resize-vertical"
                        placeholder="Enter detailed component description..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        value={editedComponent.notes || ""}
                        onChange={(e) => handleChange("notes", e.target.value)}
                        className="min-h-[100px] text-sm resize-vertical"
                        placeholder="Enter any additional notes, specifications, or important information..."
                      />
                    </div>
                  </div>

                  {/* History Textarea */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">History</label>
                    <Textarea
                      value={history}
                      className="min-h-[80px] text-sm resize-vertical"
                      placeholder="Component history, changes, or maintenance records..."
                      readOnly
                    />
                  </div>
                </div>
              ) : (
                // View Mode - Enhanced Display
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Header with component info */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-base truncate">
                            {component.componentName || "Unnamed Component"}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            {component.componentId}
                          </Badge>
                        </div>
                        {component.description && (
                          <div className="mb-2">
                            <p className="text-sm text-muted-foreground mb-1 font-medium">Description:</p>
                            <p className="text-sm bg-muted/50 p-2 rounded-md whitespace-nowrap overflow-hidden text-ellipsis">
                              {component.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Supplier Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div>
                          <span className="text-muted-foreground text-sm">Primary Supplier: </span>
                          <span className="font-medium">{component.primarySupplier || "N/A"}</span>
                          {component.primarySupplierItemCode && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({component.primarySupplierItemCode})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground text-sm">Secondary Supplier: </span>
                          <span className="font-medium">{component.secondarySupplier || "N/A"}</span>
                          {component.secondarySupplierItemCode && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({component.secondarySupplierItemCode})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stock Information */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Warehouse className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground text-sm">Min Stock: </span>
                            <span className={component.minimumStock > 0 ? "text-green-600 font-medium" : "text-red-600"}>
                              {component.minimumStock}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">Current: </span>
                            <span className={component.currentStock > 0 ? "text-green-600 font-medium" : "text-red-600"}>
                              {component.currentStock}
                            </span>
                          </div>
                        </div>
                        {component.notes && (
                          <div>
                            <p className="text-muted-foreground text-sm mb-1">Notes:</p>
                            <p className="text-sm bg-muted/50 p-2 rounded-md whitespace-nowrap overflow-hidden text-ellipsis">
                              {component.notes}
                            </p>
                          </div>
                        )}

                        {/* {history && (
                          <div>
                            <p className="text-muted-foreground text-sm mb-1">History:</p>
                            <p className="bg-muted/50 p-2 rounded-md whitespace-pre-wrap text-xs">
                              {history.split('\n').filter(line => line.trim()).slice(-1)[0]}
                            </p>
                          </div>
                        )} */}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 lg:flex-col lg:self-start">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(component)}
                      className="h-8 text-xs flex-1 lg:flex-none  cursor-pointer"
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteClick(component.id, component.componentName || component.componentId)}
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
              Showing {paginatedComponents.length} of {filteredComponents.length} components
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 text-sm  cursor-pointer"
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
                className="h-8 text-sm  cursor-pointer"
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
    </Card>
  );
}



