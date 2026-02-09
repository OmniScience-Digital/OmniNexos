export interface Component {
  id: string;
  componentId:string;
  componentName: string;
  description?: string;
  primarySupplierId?: string;
  primarySupplier?: string;
  primarySupplierItemCode?: string;
  secondarySupplierId?: string;
  secondarySupplier?: string;
  secondarySupplierItemCode?: string;
  qtyExStock?: number;
  currentStock?: number;
  notes?: string;
  history?: string;
   categoryName?: string; 
  subcategoryName?: string; 
  subcategoryId: string;
  subcategory?: SubCategory;
  subComponents: SubComponent[]; // These are the "Components" in the UI
}

export interface SubComponent {
  id: string;
  key: string;
  value: string;
  componentId: string;
}

export interface Category {
  id: string;
  categoryName: string;
  subcategories: SubCategory[];
}

export interface SubCategory {
  id: string;
  subcategoryName: string;
  categoryId: string;
  category?: Category;
  components: Component[];
}

export interface ComponentItemProps {
  component: Component;
  selectedCategoryId: string;
  onCategoryChange: (categoryId: string) => void;
  usedKeys: string[];
  onUpdate: (component: Component) => void;
  onRemove: () => void;
  isRemovable: boolean;
  onAddNewKey?: (newKey: string) => void;
  categories?: Category[];
  usedSubcategoryIds?: string[];
  allSubcategories?: any[];
  allComponents?: any[];
}