// components/subcategories-list.tsx
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Toolbar, SearchField, TableSurface, TableFooter } from "@/components/shell/toolbar";
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
    // The page shows the empty state for this case.
    return null;
  }

  return (
    <div>
      <Toolbar>
        <SearchField
          aria-label="Search subcategories"
          placeholder="Search subcategories..."
          value={searchTerm}
          onChange={handleSearch}
        />
      </Toolbar>

      <TableSurface>
        <ul className="divide-y divide-border">
          {paginatedSubcategories.map((subcategory) => (
            <li key={subcategory.id}>
              <button
                type="button"
                onClick={() => onSubCategorySelect(subcategory)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                  selectedSubCategory?.id === subcategory.id ? "bg-accent" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{subcategory.subcategoryName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    ID: {subcategory.id.slice(0, 8)}...
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
          {paginatedSubcategories.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No subcategories match your search.
            </li>
          )}
        </ul>
      </TableSurface>

      <TableFooter
        summary={`Showing ${paginatedSubcategories.length} of ${filteredSubcategories.length} subcategories`}
      >
        {totalPages > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="text-xs">Page {currentPage} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </>
        )}
      </TableFooter>
    </div>
  );
}
