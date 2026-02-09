// app/subcategories/[id]/page.tsx
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import {  useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Component, SubCategory } from "@/types/ims.types";
import { client } from "@/services/schema";
import { SubCategoriesList } from "@/app/inventorymanagementsystem/components/subcategorieslist";
import { ComponentsList } from "@/app/inventorymanagementsystem/components/components.list";

export default function SubcategoriesPage() {
  const params = useParams();
  const [categoryName, setCategoryName] = useState("");
  const id = decodeURIComponent(params.id as string);

  const [loading, setLoading] = useState(true);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);

  // Fetch subcategories by category ID
  useEffect(() => {
    const fetchSubcategories = async () => {
      try {

        // Get category name from localStorage or fetch it
        const storedName = localStorage.getItem("categoryName");
        if (storedName) {
          setCategoryName(storedName);
        }

        // Subscribe to subcategories for this category
        const subscription = client.models.SubCategory.observeQuery({
          filter: { categoryId: { eq: id } }
        }).subscribe({
          next: ({ items, isSynced }) => {
            const mappedSubcategories: SubCategory[] = (items || []).map(item => ({
              id: item.id,
              subcategoryName: item.subcategoryName,
              categoryId: item.categoryId,
            }));
            setSubcategories(mappedSubcategories);
            console.log('isSynced ', isSynced);

            if (isSynced) {
              setLoading(false);
            }
          },
          error: (error) => {
            console.error("Error subscribing to subcategories:", error);
            setLoading(false);
          }
        });

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Error fetching subcategories:", error);
        setLoading(false);
      }
    };
    fetchSubcategories();

  }, [id]);


  // Fetch components when a subcategory is selected
  useEffect(() => {
    const fetchComponents = async () => {
      if (!selectedSubCategory) {
        setComponents([]);
        return;
      }

      try {
        setComponentsLoading(true);
        const subscription = client.models.Component.observeQuery({
          filter: { subcategoryId: { eq: selectedSubCategory.id } }
        }).subscribe({
          next: ({ items, isSynced }) => {
            const mappedComponents: Component[] = (items || []).map(item => ({
              id: item.id,
              componentId: item.componentId,
              componentName: item.componentName || "",
              description: item.description || "",
              primarySupplierId: item.primarySupplierId || "",
              primarySupplier: item.primarySupplier || "",
              primarySupplierItemCode: item.primarySupplierItemCode || "",
              secondarySupplierId: item.secondarySupplierId || "",
              secondarySupplier: item.secondarySupplier || "",
              secondarySupplierItemCode: item.secondarySupplierItemCode || "",
              minimumStock: item.minimumStock || 0,
              currentStock: item.currentStock || 0,
              notes: item.notes || "",
              subcategoryId: item.subcategoryId,
            }));
            setComponents(mappedComponents);

            if (isSynced) {
              setComponentsLoading(false);
            }
          },
          error: (error) => {
            console.error("Error subscribing to components:", error);
            setComponentsLoading(false);
          }
        });

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error("Error fetching components:", error);
        setComponentsLoading(false);
      }
    };

    fetchComponents();
  }, [selectedSubCategory]);

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

  const handleBackToSubcategories = () => {
    setSelectedSubCategory(null);
    setComponents([]);
  };

  //  handleComponentDelete function:
  const handleComponentDelete = async (componentId: string) => {
    try {
      await client.models.Component.delete({
        id: componentId
      });
    } catch (error) {
      console.error("Error deleting component:", error);
    }
  };



  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="flex-1 container mx-auto px-4 py-6 mt-16 pb-20">
        {/* Header */}
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h1 className="text-l font-bold">{categoryName} Dashboard</h1>
          </div>

        </div>

        {loading ? (
          <Loading />
        ) : (
          <div className="space-y-6">
            {/* Subcategories Section */}
            {!selectedSubCategory && (
              <SubCategoriesList
                subcategories={subcategories}
                selectedSubCategory={selectedSubCategory}
                onSubCategorySelect={setSelectedSubCategory}
              />
            )}

            {/* Components Section */}
            {selectedSubCategory && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackToSubcategories}
                    className="h-9 w-9 p-0 relative hover:scale-105 active:scale-95 transition-transform duration-150">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Package className="h-5 w-5 text-primary" />
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedSubCategory.subcategoryName}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {components.length} {components.length === 1 ? "component" : "components"}
                    </p>

                  </div>
                  {componentsLoading && (
                    <Badge variant="secondary" className="text-xs">
                      Loading...
                    </Badge>
                  )}
                </div>

                {componentsLoading ? (
                  <Card>
                    <CardContent className="p-6">
                      <Loading />
                    </CardContent>
                  </Card>
                ) : (
                  <ComponentsList
                    components={components}
                    onComponentUpdate={handleComponentUpdate}
                    onComponentDelete={handleComponentDelete}
                  />

                )}
              </div>
            )}


            {!selectedSubCategory && subcategories.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Subcategories</h3>
                  <p className="text-muted-foreground text-sm">
                    No subcategories found for this category
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}