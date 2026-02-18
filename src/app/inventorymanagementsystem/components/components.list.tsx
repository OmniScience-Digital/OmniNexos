// components/components-list.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ResponseModal from "@/components/widgets/response";
import {
  Edit2,
  Save,
  X,
  Search,
  Package,
  Warehouse,
  Trash2,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import type { Component } from "@/types/ims.types";
import { client } from "@/services/schema";
import { useAuth } from "@/contexts/auth-context";
import Loading from "@/components/widgets/loading";

interface ComponentsListProps {
  subcategoryid: string
  setComponentIconLoading: () => void
  setComponentsLength: (val: number) => void
}

export function ComponentsList({
  subcategoryid, setComponentIconLoading, setComponentsLength
}: ComponentsListProps) {

  const { user } = useAuth();
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);


  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [editedComponent, setEditedComponent] = useState<Partial<Component>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  // Add state to track the component to be deleted
  const [componentToDelete, setComponentToDelete] = useState<{ id: string, name: string } | null>(null);

  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  const [writePermissions, setWritePermissions] = useState(false);
  const itemsPerPage = 10;
  const { permission } = useAuth();
  const [components, setComponents] = useState<Component[]>([]);
  const [showmoreButton, setshowmoreButton] = useState(false);
  const [paginationToken, setPaginationToken] = useState<string | null | undefined>(null);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [nextfetching, setNextFetching] = useState(false);

  const [opendelete, setOpendelete] = useState(false); // Dialog visibility state for deleting dashboard
  const [history, setHistory] = useState("");

  useEffect(() => {
    setComponentsLoading(true);
    // Initial load with pagination
    const loadInitialData = async () => {
      const { nextToken, data } = await client.models.Component.listComponentsBySubCategoryId({
        subcategoryId: subcategoryid
      }, {
        limit: 10,
        selectionSet: [
          'id',
          'componentId',
          'componentName',
          'description',
          'primarySupplierId',
          'primarySupplier',
          'primarySupplierItemCode',
          'secondarySupplierId',
          'secondarySupplier',
          'secondarySupplierItemCode',
          'minimumStock',
          'currentStock',
          'notes',
          'subcategoryId'
        ]
      });

      if (data) {
        setComponentsLoading(false);
        setComponentIconLoading();
        setComponentsLength(data.length)
        setComponents(data as Component[]);
      }

      setPaginationToken(nextToken);
      setshowmoreButton(!!nextToken);
    };


    loadInitialData();
  }, []);


  const getMoreData = async () => {
    setNextFetching(true);
    const nextPage = currentPage + 1;
    const neededItems = nextPage * itemsPerPage;


    // If we already have the data, just navigate
    if (components.length >= neededItems) {
      setCurrentPage(nextPage);
      setNextFetching(false);
      return;
    }

    // Otherwise fetch more data
    if (!paginationToken) {
      setNextFetching(false);
      return;

    }

    console.log("Current page before fetch:", currentPage);
    console.log("Total pages before fetch:", Math.ceil(components.length / itemsPerPage));

    const { nextToken, data } = await client.models.Component.listComponentsBySubCategoryId({
      subcategoryId: subcategoryid
    }, {
      limit: 10,
      nextToken: paginationToken,
      selectionSet: [
        'id',
        'componentId',
        'componentName',
        'description',
        'primarySupplierId',
        'primarySupplier',
        'primarySupplierItemCode',
        'secondarySupplierId',
        'secondarySupplier',
        'secondarySupplierItemCode',
        'minimumStock',
        'currentStock',
        'notes',
        'subcategoryId'
      ]
    });

    let newComponentsLength = 0;

    if (data && data.length > 0) {
      const newComponents = data.map(item => ({
        id: item.id,
        componentId: item.componentId,
        componentName: item.componentName,
        description: item.description,
        primarySupplierId: item.primarySupplierId,
        primarySupplier: item.primarySupplier,
        primarySupplierItemCode: item.primarySupplierItemCode,
        secondarySupplierId: item.secondarySupplierId,
        secondarySupplier: item.secondarySupplier,
        secondarySupplierItemCode: item.secondarySupplierItemCode,
        minimumStock: item.minimumStock,
        currentStock: item.currentStock,
        notes: item.notes,
        subcategoryId: item.subcategoryId
      })) as Component[];

      newComponentsLength = newComponents.length;
      setComponentsLength(components.length + newComponents.length);

      setComponents(prevComponents => [
        ...prevComponents,
        ...newComponents
      ]);
    }else{
      newComponentsLength;
    }

    setPaginationToken(nextToken);
    setCurrentPage(prev => prev + 1);
    setNextFetching(false);

    if (!nextToken) {
      setshowmoreButton(false);
    }
  };

  const goToPreviousPage = () => {
    console.log("Current Page ", currentPage)
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };


  useEffect(() => {
    if (permission?.permissions?.includes('ims.edit') || permission?.isAdmin) {
      setWritePermissions(true);
    } else {
      setWritePermissions(false);
    }
  }, [permission]);


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



  const filteredComponents = useMemo(() => {
    // console.log(components);
    return components.filter(component => {
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in-stock' && (component.currentStock >= component.minimumStock)) ||
        (stockFilter === 'out-of-stock' && (component.currentStock < component.minimumStock));

      return matchesStock;
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


  const handleCancel = () => {
    setEditingComponent(null);
    setEditedComponent({});
  };


  // Create a wrapper function with NO parameters
  const handleConfirmWrapper = () => {
    if (componentToDelete) {
      handleDelete(componentToDelete.id, componentToDelete.name);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setCurrentPage(1);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!term.trim()) {
      setComponentsLoading(true);
      console.log('Searching on empty search');
      setCurrentPage(1);
      const { nextToken, data } = await client.models.Component.listComponentsBySubCategoryId({
        subcategoryId: subcategoryid
      }, {
        limit: 10,
        selectionSet: [
          'id',
          'componentId',
          'componentName',
          'description',
          'primarySupplierId',
          'primarySupplier',
          'primarySupplierItemCode',
          'secondarySupplierId',
          'secondarySupplier',
          'secondarySupplierItemCode',
          'minimumStock',
          'currentStock',
          'notes',
          'subcategoryId'
        ]
      });

      setComponents(data as Component[]);
      setPaginationToken(nextToken);
      setshowmoreButton(!!nextToken);
      setComponentsLoading(false);
      return;
    }

    console.log(`Searching ${term}`);

    if (term.length < 3) return;

    // Set new timeout
    searchTimeout.current = setTimeout(async () => {
      let allResults: any[] = [];
      let nextToken: string | null = null;
      setComponentsLoading(true);

      do {
        const result: any = await client.models.Component.list({
          filter: {
            subcategoryId: { eq: subcategoryid },
            and: [{
              or: [
                { componentId: { contains: term } },
                { componentName: { contains: term } },
                { description: { contains: term } },
                { primarySupplier: { contains: term } },
                { secondarySupplier: { contains: term } }
              ]
            }]
          },
          nextToken: nextToken,
          limit: 100,
          selectionSet: [
            'id',
            'componentId',
            'componentName',
            'description',
            'primarySupplierId',
            'primarySupplier',
            'primarySupplierItemCode',
            'secondarySupplierId',
            'secondarySupplier',
            'secondarySupplierItemCode',
            'minimumStock',
            'currentStock',
            'notes',
            'subcategoryId'
          ]
        });

        if (result.data && result.data.length > 0) {
          allResults = [...allResults, ...result.data];
        }
        nextToken = result.nextToken;
      } while (nextToken);

      console.log(`Running ${term}`);
      setComponents(allResults as Component[]);
      setPaginationToken(null);
      setshowmoreButton(false);
      setComponentsLoading(false);
    }, 300);
  };
  const handleComponentDelete = async (componentId: string) => {
    try {
      await client.models.Component.delete({
        id: componentId
      });
    } catch (error) {
      console.error("Error deleting component:", error);
    }
  };

  const handleComponentUpdate = async (updatedComponent: Component) => {
    try {
      await client.models.Component.update({
        id: updatedComponent.id,
        componentId: updatedComponent.componentId,
        componentName: updatedComponent.componentName,
        description: updatedComponent.description,
        primarySupplier: updatedComponent.primarySupplier,
        primarySupplierItemCode: updatedComponent.primarySupplierItemCode,
        secondarySupplier: updatedComponent.secondarySupplier,
        secondarySupplierItemCode: updatedComponent.secondarySupplierItemCode,
        minimumStock: updatedComponent.minimumStock,
        currentStock: updatedComponent.currentStock,
        notes: updatedComponent.notes,
      });
    } catch (error) {
      console.error("Error updating component:", error);
    }
  };

  const handleSave = async () => {
    if (!writePermissions) {
      setShow(true);
      setSuccessful(false)
      setMessage("⛔ No edit permission")

      return;
    }
    if (editingComponent && editedComponent) {
      // Get Johannesburg time
      const johannesburgTime = new Date().toLocaleString("en-ZA", {
        timeZone: "Africa/Johannesburg"
      });

      let historyEntries = "";

      // Check if minimumStock changed
      if (editedComponent.minimumStock !== undefined &&
        editedComponent.minimumStock !== editingComponent.minimumStock) {
        historyEntries += `IMS Dashboard: ${user?.preferred_username} updated minimumStock from ${editingComponent.minimumStock} to ${editedComponent.minimumStock} at ${johannesburgTime}\n`;
      }

      // Check if currentStock changed
      if (editedComponent.currentStock !== undefined &&
        editedComponent.currentStock !== editingComponent.currentStock) {
        historyEntries += `IMS Dashboard: ${user?.preferred_username} updated currentStock from ${editingComponent.currentStock} to ${editedComponent.currentStock} at ${johannesburgTime}\n`;
      }

      // Create the updated component with history
      const updatedComponent = {
        ...editingComponent,
        ...editedComponent,
      };


      handleComponentUpdate(updatedComponent);


      // Save to new History DB if there were changes
      if (historyEntries.trim() !== "") {
        try {
          await client.models.History.create({
            entityType: "COMPONENT",
            entityId: editingComponent.id,
            action: "UPDATE",
            timestamp: new Date().toISOString(),
            updatedBy: user?.preferred_username || user?.email,
            details: historyEntries,
          });
          setHistory(historyEntries);

        } catch (error) {
          console.log(error)
        }

      }

      setEditingComponent(null);
      setEditedComponent({});
    }
  };

  const handleChange = (field: keyof Component, value: string | number) => {
    if (!writePermissions) {
      setShow(true);
      setSuccessful(false)
      setMessage("⛔ No edit permission")

      return;
    }
    // For all fields, update normally w
    setEditedComponent(prev => ({ ...prev, [field]: value }));
  };


  // Modify your delete handler
  const handleDelete = (componentId: string, componentName: string) => {
    try {
      setOpendelete(false);
      console.log("Deleting component:", componentId, componentName);

      if (!componentId) {
        console.warn("No ID provided for deletion.");
        return;
      }

      handleComponentDelete(componentId);
      setComponentToDelete(null); // Clear after deletion
    } catch (error) {
      console.error("Error deleting component:", error);
    }
  };


  // Update your delete button click handler
  const handleDeleteClick = (componentId: string, componentName: string) => {
    if (!writePermissions) {
      setShow(true);
      setSuccessful(false)
      setMessage("⛔ No edit permission");

      return;
    }

    setComponentToDelete({ id: componentId, name: componentName });
    setOpendelete(true);
  };


  return (
    <Card className={componentsLoading ? "p-6 min-h-[400px]" : ""}>
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
                placeholder="Search components (3+ letters)"
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

      <CardContent className={componentsLoading ? "p-6 min-h-[500]" : "pt-0"}>     
      {componentsLoading ? (
        <Loading />
      ) : (
        <>
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
          <div className="flex items-center justify-between border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(!searchTerm) ? (currentPage * 10) : (filteredComponents.length)} of {filteredComponents.length} components
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className="h-8 text-sm cursor-pointer"
              >
                Previous
              </Button>

              {/* Add this line to see what page you're on */}
              <span className="text-sm font-medium mx-2">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={getMoreData}
                disabled={!showmoreButton}
                className="h-8 text-sm cursor-pointer"
              >
                {nextfetching ? "Loading..." : "Next"}
              </Button>
            </div>
          </div>

        </>

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



