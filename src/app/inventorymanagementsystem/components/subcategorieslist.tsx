// components/subcategories-list.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import type { SubCategory } from "@/types/ims.types";

interface SubCategoriesListProps {
  subcategories: SubCategory[];
  selectedSubCategory: SubCategory | null;
  onSubCategorySelect: (subcategory: SubCategory) => void;
}

export function SubCategoriesList({
  subcategories,
  selectedSubCategory,
  onSubCategorySelect,
}: SubCategoriesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filteredSubcategories = useMemo(() => {
    return subcategories.filter(subcategory =>
      subcategory.subcategoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subcategory.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [subcategories, searchTerm]);

  const totalPages = Math.ceil(filteredSubcategories.length / itemsPerPage);
  const paginatedSubcategories = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSubcategories.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSubcategories, currentPage, itemsPerPage]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  if (subcategories.length === 0) {
    return (
      <Card className="h-48">
        <CardContent className="p-6 h-full flex items-center justify-center">
          <p className="text-muted-foreground text-center">No subcategories found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Subcategories
            <Badge variant="secondary" className="text-xs">
              {filteredSubcategories.length}
            </Badge>
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subcategories..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Subcategories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mb-4">
          {paginatedSubcategories.map((subcategory) => (
            <div
              key={subcategory.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all text-sm ${
                selectedSubCategory?.id === subcategory.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/50 hover:bg-accent/50"
              }`}
              onClick={() => onSubCategorySelect(subcategory)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium truncate">{subcategory.subcategoryName}</h3>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    ID: {subcategory.id.slice(0, 8)}...
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              Showing {paginatedSubcategories.length} of {filteredSubcategories.length}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-7 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="h-7 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}