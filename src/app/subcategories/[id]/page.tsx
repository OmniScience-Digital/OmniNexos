// app/subcategories/[id]/page.tsx
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {  SubCategory } from "@/types/ims.types";
import { useListSubcategoriesByCategoryQuery } from "@/state/api";
import { useLiveQuerySync } from "@/state/useLiveQuerySync";
import { client } from "@/services/schema";
import { SubCategoriesList } from "@/app/inventorymanagementsystem/components/subcategorieslist";
import { ComponentsList } from "@/app/inventorymanagementsystem/components/components.list";

export default function SubcategoriesPage() {
  const params = useParams();
  const [categoryName] = useState(() => localStorage.getItem("categoryName") || "");
  const id = decodeURIComponent(params.id as string);

  // Single consumer today (this page), migrated for consistency with the
  // rest of the app's data layer rather than a fix to a duplication bug.
  const { data: subcategories = [], isLoading: loading } = useListSubcategoriesByCategoryQuery(id);
  useLiveQuerySync(
    "listSubcategoriesByCategory",
    id,
    (categoryId) => client.models.SubCategory.observeQuery({ filter: { categoryId: { eq: categoryId } } }),
    (item: { id: string; subcategoryName: string; categoryId: string }) => ({ id: item.id, subcategoryName: item.subcategoryName, categoryId: item.categoryId }),
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);
  const [componentsLoading, setComponentsLoading] = useState(true);
  const [componentsLength,setcomponentsLength ] = useState(0);

  // Category name doesn't change after mount, so read it once via a lazy
  // initializer instead of a separate effect (avoids an unnecessary render
  // and a brief empty-title flash before an effect would have run).
  const handleBackToSubcategories = () => {
    setSelectedSubCategory(null);
  };

  const setComponentIconLoading=()=>{
    setComponentsLoading(false);
  }

  const setComponentsLength=(val:number)=>{
   setcomponentsLength(val);
  }


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="flex-1 container mx-auto px-4 py-6 mt-20 pb-20">
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
                      {componentsLength} {componentsLength === 1 ? "component" : "components"}
                    </p>

                  </div>
                  {componentsLoading && (
                    <Badge variant="secondary" className="text-xs">
                      Loading...
                    </Badge>
                  )}
     
                </div>
                   <ComponentsList
                   setComponentIconLoading={setComponentIconLoading}
                   setComponentsLength={setComponentsLength}
                    subcategoryid={selectedSubCategory.id}
                  />  
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