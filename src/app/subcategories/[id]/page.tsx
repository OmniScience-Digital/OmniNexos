// app/subcategories/[id]/page.tsx
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
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

      <div className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 mt-25 pb-20">
        <PageHeader
          title={selectedSubCategory ? selectedSubCategory.subcategoryName : (categoryName || "Subcategories")}
          description={
            selectedSubCategory
              ? `${componentsLength} ${componentsLength === 1 ? "component" : "components"}`
              : "Choose a subcategory to see its components."
          }
          leading={
            selectedSubCategory ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToSubcategories}
                aria-label="Back to subcategories"
                className="h-9 w-9 cursor-pointer"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : undefined
          }
          actions={
            selectedSubCategory && componentsLoading ? (
              <Badge variant="secondary" className="text-xs">Loading...</Badge>
            ) : undefined
          }
        />

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