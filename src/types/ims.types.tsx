// types/category.ts
export interface Category {
  id: string;
  categoryName: string;
}

export interface SubCategory {
  id: string;
  subcategoryName: string;
  categoryId: string;
}

export interface Component {
  id: string;
  componentId: string;
  componentName: string;
  description: string;
  primarySupplierId: string;
  primarySupplier: string;
  primarySupplierItemCode: string;
  secondarySupplierId: string;
  secondarySupplier: string;
  secondarySupplierItemCode: string;
  minimumStock: number;
  currentStock: number;
  notes: string;
  subcategoryId: string;
}