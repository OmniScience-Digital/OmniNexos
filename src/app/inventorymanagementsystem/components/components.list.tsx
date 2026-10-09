// components/components-list.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Toolbar, SearchField, TableSurface, TableFooter } from "@/components/shell/toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ResponseModal from "@/components/widgets/response";
import {
  Edit2,
  MoreVertical,
  Save,
  X,
  Trash2,
  Loader2,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { ConfirmDialog } from "@/components/widgets/deletedialog";
import type { Component } from "@/types/ims.types";
import { client } from "@/services/schema";
import { useAuth } from "@/contexts/auth-context";
import { usePermission } from "@/hooks/usePermission";
import Loading from "@/components/widgets/loading";

interface ComponentsListProps {
  subcategoryid: string;
  setComponentIconLoading: () => void;
  setComponentsLength: (val: number) => void;
}

export function ComponentsList({
  subcategoryid,
  setComponentIconLoading,
  setComponentsLength,
}: ComponentsListProps) {
  const { user } = useAuth();
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);
  const [fullComponentCache, setFullComponentCache] = useState<
    Component[] | null
  >(null);

  const [editingComponent, setEditingComponent] = useState<Component | null>(
    null,
  );
  const [editedComponent, setEditedComponent] = useState<Partial<Component>>(
    {},
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [stockFilter, setStockFilter] = useState<
    "all" | "in-stock" | "out-of-stock"
  >("all");
  // Add state to track the component to be deleted
  const [componentToDelete, setComponentToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  const writePermissions = usePermission("ims.edit");
  const itemsPerPage = 10;
  const [components, setComponents] = useState<Component[]>([]);
  const [showmoreButton, setshowmoreButton] = useState(false);
  const [paginationToken, setPaginationToken] = useState<
    string | null | undefined
  >(null);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [nextfetching, setNextFetching] = useState(false);

  const [opendelete, setOpendelete] = useState(false); // Dialog visibility state for deleting dashboard
  const [history, setHistory] = useState("");

  useEffect(() => {
    setComponentsLoading(true);
    // Initial load with pagination
    const loadInitialData = async () => {
      const { nextToken, data } =
        await client.models.Component.listComponentsBySubCategoryId(
          {
            subcategoryId: subcategoryid,
          },
          {
            limit: 10,
            selectionSet: [
              "id",
              "componentId",
              "componentName",
              "description",
              "primarySupplierId",
              "primarySupplier",
              "primarySupplierItemCode",
              "secondarySupplierId",
              "secondarySupplier",
              "secondarySupplierItemCode",
              "minimumStock",
              "currentStock",
              "notes",
              "subcategoryId",
            ],
          },
        );

      if (data) {
        setComponentsLoading(false);
        setComponentIconLoading();
        setComponentsLength(data.length);
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
    console.log(
      "Total pages before fetch:",
      Math.ceil(components.length / itemsPerPage),
    );

    const { nextToken, data } =
      await client.models.Component.listComponentsBySubCategoryId(
        {
          subcategoryId: subcategoryid,
        },
        {
          limit: 10,
          nextToken: paginationToken,
          selectionSet: [
            "id",
            "componentId",
            "componentName",
            "description",
            "primarySupplierId",
            "primarySupplier",
            "primarySupplierItemCode",
            "secondarySupplierId",
            "secondarySupplier",
            "secondarySupplierItemCode",
            "minimumStock",
            "currentStock",
            "notes",
            "subcategoryId",
          ],
        },
      );

    let newComponentsLength = 0;

    if (data && data.length > 0) {
      const newComponents = data.map((item) => ({
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
        subcategoryId: item.subcategoryId,
      })) as Component[];

      newComponentsLength = newComponents.length;
      setComponentsLength(components.length + newComponents.length);

      setComponents((prevComponents) => [...prevComponents, ...newComponents]);
    } else {
      newComponentsLength;
    }

    setPaginationToken(nextToken);
    setCurrentPage((prev) => prev + 1);
    setNextFetching(false);

    if (!nextToken) {
      setshowmoreButton(false);
    }
  };

  const goToPreviousPage = () => {
    console.log("Current Page ", currentPage);
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  useEffect(() => {
    const getHistory = async () => {
      if (!editedComponent?.id) return;

      const employeeHistory = await client.models.History.getHistoryByEntityId(
        { entityId: editedComponent.id },
        { sortDirection: "DESC", limit: 20 },
      );
      console.log("history result:", editedComponent.id, employeeHistory);
      const historyString = (employeeHistory.data || [])
        .filter((entry) => entry && entry.details) // skip null or entries without details
        .map((entry) => entry.details)
        .join("");

      setHistory(historyString);
    };

    getHistory();
  }, [editedComponent?.id]);

  const filteredComponents = useMemo(() => {
    return components.filter((component) => {
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "in-stock" &&
          component.currentStock >= component.minimumStock) ||
        (stockFilter === "out-of-stock" &&
          component.currentStock < component.minimumStock);
      return matchesStock;
    });
  }, [components, stockFilter]); // searchTerm is no longer used here
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

  // const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const term = e.target.value;
  //   setSearchTerm(term);
  //   setCurrentPage(1);

  //   // Clear previous timeout
  //   if (searchTimeout.current) {
  //     clearTimeout(searchTimeout.current);
  //   }

  //   if (!term.trim()) {
  //     setComponentsLoading(true);
  //     console.log("Searching on empty search");
  //     setCurrentPage(1);
  //     const { nextToken, data } =
  //       await client.models.Component.listComponentsBySubCategoryId(
  //         {
  //           subcategoryId: subcategoryid,
  //         },
  //         {
  //           limit: 10,
  //           selectionSet: [
  //             "id",
  //             "componentId",
  //             "componentName",
  //             "description",
  //             "primarySupplierId",
  //             "primarySupplier",
  //             "primarySupplierItemCode",
  //             "secondarySupplierId",
  //             "secondarySupplier",
  //             "secondarySupplierItemCode",
  //             "minimumStock",
  //             "currentStock",
  //             "notes",
  //             "subcategoryId",
  //           ],
  //         },
  //       );

  //     setComponents(data as Component[]);
  //     setPaginationToken(nextToken);
  //     setshowmoreButton(!!nextToken);
  //     setComponentsLoading(false);
  //     return;
  //   }

  //   // console.log(`Searching ${term}`);

  //   if (term.length < 3) return;

  //   // Set new timeout
  //   searchTimeout.current = setTimeout(async () => {
  //     let allResults: any[] = [];
  //     let nextToken: string | null = null;
  //     setComponentsLoading(true);

  //     do {
  //       const result: any = await client.models.Component.list({
  //         filter: {
  //           subcategoryId: { eq: subcategoryid },
  //           and: [
  //             {
  //               or: [
  //                 { componentId: { contains: term } },
  //                 { componentName: { contains: term } },
  //                 { description: { contains: term } },
  //                 { primarySupplier: { contains: term } },
  //                 { secondarySupplier: { contains: term } },
  //               ],
  //             },
  //           ],
  //         },
  //         nextToken: nextToken,
  //         limit: 100,
  //         selectionSet: [
  //           "id",
  //           "componentId",
  //           "componentName",
  //           "description",
  //           "primarySupplierId",
  //           "primarySupplier",
  //           "primarySupplierItemCode",
  //           "secondarySupplierId",
  //           "secondarySupplier",
  //           "secondarySupplierItemCode",
  //           "minimumStock",
  //           "currentStock",
  //           "notes",
  //           "subcategoryId",
  //         ],
  //       });

  //       if (result.data && result.data.length > 0) {
  //         allResults = [...allResults, ...result.data];
  //       }
  //       nextToken = result.nextToken;
  //     } while (nextToken);

  //     console.log(`Running ${term}`);
  //     setComponents(allResults as Component[]);
  //     setPaginationToken(null);
  //     setshowmoreButton(false);
  //     setComponentsLoading(false);
  //   }, 300);
  // };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setCurrentPage(1);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // --- Empty search → load paginated list (requires nextToken) ---
    if (!term.trim()) {
      setComponentsLoading(true);
      const { nextToken, data } =
        await client.models.Component.listComponentsBySubCategoryId(
          { subcategoryId: subcategoryid },
          {
            limit: 10,
            selectionSet: [
              "id",
              "componentId",
              "componentName",
              "description",
              "primarySupplierId",
              "primarySupplier",
              "primarySupplierItemCode",
              "secondarySupplierId",
              "secondarySupplier",
              "secondarySupplierItemCode",
              "minimumStock",
              "currentStock",
              "notes",
              "subcategoryId",
            ],
          },
        );
      setComponents(data as Component[]);
      setPaginationToken(nextToken);
      setshowmoreButton(!!nextToken);
      setFullComponentCache(null);
      setComponentsLoading(false);
      return;
    }

    // --- Less than 3 letters → do nothing ---
    if (term.length < 3) return;

    // --- Search with 3+ letters → fetch all (no token loop) and filter client-side ---
    searchTimeout.current = setTimeout(async () => {
      setComponentsLoading(true);

      let allComponents = fullComponentCache;
      if (!allComponents) {
        // One single fetch – no pagination loop
        const { data } =
          await client.models.Component.listComponentsBySubCategoryId(
            { subcategoryId: subcategoryid },
            {
              limit: 10000, // large enough to get all components
              selectionSet: [
                "id",
                "componentId",
                "componentName",
                "description",
                "primarySupplierId",
                "primarySupplier",
                "primarySupplierItemCode",
                "secondarySupplierId",
                "secondarySupplier",
                "secondarySupplierItemCode",
                "minimumStock",
                "currentStock",
                "notes",
                "subcategoryId",
              ],
            },
          );
        allComponents = (data || []) as Component[];
        setFullComponentCache(allComponents);
      }

      const lowerTerm = term.toLowerCase();
      const filtered = allComponents.filter(
        (comp) =>
          comp.componentId?.toLowerCase().includes(lowerTerm) ||
          comp.componentName?.toLowerCase().includes(lowerTerm) ||
          comp.description?.toLowerCase().includes(lowerTerm) ||
          comp.primarySupplier?.toLowerCase().includes(lowerTerm) ||
          comp.secondarySupplier?.toLowerCase().includes(lowerTerm),
      );

      setComponents(filtered);
      setPaginationToken(null); // disable pagination while searching
      setshowmoreButton(false);
      setComponentsLoading(false);
    }, 300);
  };

  const handleComponentDelete = async (componentId: string) => {
    try {
      await client.models.Component.delete({
        id: componentId,
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
    setSuccessful(false);
    setMessage("⛔ No edit permission");

    return;
  }
  setSaving(true);
  if (editingComponent && editedComponent) {
    // Get Johannesburg time
    const johannesburgTime = new Date().toLocaleString("en-ZA", {
      timeZone: "Africa/Johannesburg",
    });

    let historyEntries = "";

    // Check if minimumStock changed
    if (
      editedComponent.minimumStock !== undefined &&
      editedComponent.minimumStock !== editingComponent.minimumStock
    ) {
      historyEntries += `IMS Dashboard: ${user?.preferred_username} updated minimumStock from ${editingComponent.minimumStock} to ${editedComponent.minimumStock} at ${johannesburgTime}\n`;
    }

    // Check if currentStock changed
    if (
      editedComponent.currentStock !== undefined &&
      editedComponent.currentStock !== editingComponent.currentStock
    ) {
      historyEntries += `IMS Dashboard: ${user?.preferred_username} updated currentStock from ${editingComponent.currentStock} to ${editedComponent.currentStock} at ${johannesburgTime}\n`;
    }

    // Create the updated component with history
    const updatedComponent = {
      ...editingComponent,
      ...editedComponent,
    };

    handleComponentUpdate(updatedComponent);
    setComponents((prev) =>
      prev.map((comp) =>
        comp.id === updatedComponent.id ? updatedComponent : comp,
      ),
    );

    // Save to new History DB if there were changes
    if (historyEntries.trim() !== "") {
      try {
        await client.models.History.create({
          entityType: "COMPONENT",
          entityId: editingComponent.id,
          action: "UPDATE",
          timestamp: new Date().toISOString(),
          updatedBy: user?.preferred_username || user?.email || "unknown",
          details: historyEntries,
        });
        setHistory(historyEntries);
      } catch (error) {
        console.log(error);
      }
    }

    setEditingComponent(null);
    setEditedComponent({});
  }
  setSaving(false);
};

  const handleChange = (field: keyof Component, value: string | number) => {
    if (!writePermissions) {
      setShow(true);
      setSuccessful(false);
      setMessage("⛔ No edit permission");

      return;
    }
    // For all fields, update normally w
    setEditedComponent((prev) => ({ ...prev, [field]: value }));
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
      setComponents((prev) => prev.filter((comp) => comp.id !== componentId));
    } catch (error) {
      console.error("Error deleting component:", error);
    }
  };

  // Update your delete button click handler
  const handleDeleteClick = (componentId: string, componentName: string) => {
    if (!writePermissions) {
      setShow(true);
      setSuccessful(false);
      setMessage("⛔ No edit permission");

      return;
    }

    setComponentToDelete({ id: componentId, name: componentName });
    setOpendelete(true);
  };

  return (
    <div>
      <Toolbar>
        <SearchField
          aria-label="Search components"
          placeholder="Search components (3+ letters)"
          value={searchTerm}
          onChange={handleSearch}
        />
        <div role="group" aria-label="Stock filter" className="flex gap-1">
          {([
            ["all", "All"],
            ["in-stock", "In Stock"],
            ["out-of-stock", "Out of Stock"],
          ] as const).map(([key, label]) => (
            <Button
              key={key}
              variant={stockFilter === key ? "default" : "outline"}
              onClick={() => setStockFilter(key)}
              className="cursor-pointer"
            >
              {label}
            </Button>
          ))}
        </div>
      </Toolbar>

      {componentsLoading ? (
        <Loading />
      ) : (
        <>
          <TableSurface>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {["Component", "Primary Supplier", "Secondary Supplier", "Min Stock", "Current", "Status"].map((h) => (
                    <TableHead key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                  <TableHead className="w-12 px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedComponents.map((component) => {
                  const out = !(component.currentStock > 0);
                  const low = !out && component.currentStock <= component.minimumStock;
                  return (
                    <TableRow key={component.id} className="hover:bg-muted/40">
                      <TableCell className="px-4 py-3">
                        <div className="max-w-xs leading-tight">
                          <div className="truncate font-medium">
                            {component.componentName || component.componentId}
                          </div>
                          {component.componentName && (
                            <div className="truncate text-xs text-muted-foreground">{component.componentId}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="leading-tight">
                          <div>{component.primarySupplier || "N/A"}</div>
                          {component.primarySupplierItemCode && (
                            <div className="text-xs text-muted-foreground">{component.primarySupplierItemCode}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="leading-tight">
                          <div>{component.secondarySupplier || "N/A"}</div>
                          {component.secondarySupplierItemCode && (
                            <div className="text-xs text-muted-foreground">{component.secondarySupplierItemCode}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">{component.minimumStock}</TableCell>
                      <TableCell className="px-4 py-3 font-medium">{component.currentStock}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            out
                              ? "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : low
                                ? "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "border-transparent bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                          }
                        >
                          {out ? "Out of stock" : low ? "Low" : "In stock"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 cursor-pointer p-0" aria-label="Row actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(component)} className="cursor-pointer">
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleDeleteClick(component.id, component.componentName || component.componentId)
                              }
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginatedComponents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No components found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableSurface>

          <TableFooter
            summary={`Showing ${!searchTerm ? currentPage * 10 : filteredComponents.length} of ${filteredComponents.length} components`}
          >
            <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage === 1} className="cursor-pointer">
              Previous
            </Button>
            <span className="text-xs">Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={getMoreData} disabled={!showmoreButton} className="cursor-pointer">
              {nextfetching ? "Loading..." : "Next"}
            </Button>
          </TableFooter>
        </>
      )}

      <Sheet open={!!editingComponent} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="sr-only">Edit component</SheetTitle>
          </SheetHeader>
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-base">
                          Editing Component
                        </h4>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSave}
                            className="h-8 text-xs cursor-pointer bg-[#165b8c] text-white hover:bg-[#1e6fae] transition-colors duration-200"
                          >
                            {saving ? (
                              <Loader2 className="h-3 w-3 mr-1 " />
                            ) : (
                              <Save className="h-3 w-3 mr-1 " />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                            className="h-8 text-xs cursor-pointer"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Component ID *
                          </label>
                          <Input
                            value={editedComponent.componentId || ""}
                            onChange={(e) =>
                              handleChange("componentId", e.target.value)
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Component Name
                          </label>
                          <Input
                            value={editedComponent.componentName || ""}
                            onChange={(e) =>
                              handleChange("componentName", e.target.value)
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Primary Supplier
                          </label>
                          <Input
                            value={editedComponent.primarySupplier || ""}
                            onChange={(e) =>
                              handleChange("primarySupplier", e.target.value)
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Primary Supplier Item Code
                          </label>
                          <Input
                            value={
                              editedComponent.primarySupplierItemCode || ""
                            }
                            onChange={(e) =>
                              handleChange(
                                "primarySupplierItemCode",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Secondary Supplier
                          </label>
                          <Input
                            value={editedComponent.secondarySupplier || ""}
                            onChange={(e) =>
                              handleChange("secondarySupplier", e.target.value)
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Secondary Supplier Item Code
                          </label>
                          <Input
                            value={
                              editedComponent.secondarySupplierItemCode || ""
                            }
                            onChange={(e) =>
                              handleChange(
                                "secondarySupplierItemCode",
                                e.target.value,
                              )
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Min Stock
                          </label>
                          <Input
                            type="number"
                            value={editedComponent.minimumStock || 0}
                            onChange={(e) =>
                              handleChange(
                                "minimumStock",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Current Stock
                          </label>
                          <Input
                            type="number"
                            value={editedComponent.currentStock || 0}
                            onChange={(e) =>
                              handleChange(
                                "currentStock",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            className="h-9"
                          />
                        </div>
                      </div>

                      {/* Textareas for longer text fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Description
                          </label>
                          <Textarea
                            value={editedComponent.description || ""}
                            onChange={(e) =>
                              handleChange("description", e.target.value)
                            }
                            className="min-h-25 text-sm resize-vertical"
                            placeholder="Enter detailed component description..."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Notes</label>
                          <Textarea
                            value={editedComponent.notes || ""}
                            onChange={(e) =>
                              handleChange("notes", e.target.value)
                            }
                            className="min-h-25 text-sm resize-vertical"
                            placeholder="Enter any additional notes, specifications, or important information..."
                          />
                        </div>
                      </div>

                      {/* History Textarea */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">History</label>
                        <Textarea
                          value={history}
                          className="min-h-20 text-sm resize-vertical"
                          placeholder="Component history, changes, or maintenance records..."
                          readOnly
                        />
                      </div>
                    </div>
        </SheetContent>
      </Sheet>

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
    </div>
  );
}
