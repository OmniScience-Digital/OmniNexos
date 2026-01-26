import type { Category, Component, SubCategory } from "@/types/form.types";
import type { vifForm } from "@/types/vifForm.types";


// Helper function to map API data to our types
export const mapApiCategoryToCategory = (apiCategory: any): Category => ({
  id: apiCategory.id,
  categoryName: apiCategory.categoryName,
  subcategories: []
});

// Helper function to map API data to our types
export const mapApiCategoryToVehicle = (apiVehicle: any): vifForm => ({
  id: apiVehicle.id,
  vehicleReg: apiVehicle.vehicleReg,
  vehicleVin: apiVehicle.vehicleVin,
  lastServicedate: apiVehicle.lastServicedate,
  lastServicekm: apiVehicle.lastServicekm,
  lastRotationkm: apiVehicle.lastRotationkm,
  fleetNumber: apiVehicle.fleetNumber,
  servicePlanStatus: apiVehicle.servicePlanStatus,
  servicePlan: apiVehicle.servicePlan,
  lastRotationdate:apiVehicle.lastRotationdate,
});


export const mapApiComponentToComponent = (apiComponent: any): Component => ({
  id: apiComponent.id,
  componentId: apiComponent.componentId || "", // Add this line
  componentName: apiComponent.componentName || "",
  description: apiComponent.description || "",
  primarySupplierId: apiComponent.primarySupplierId || "",
  primarySupplier: apiComponent.primarySupplier || "",
  primarySupplierItemCode: apiComponent.primarySupplierItemCode || "",
  secondarySupplierId: apiComponent.secondarySupplierId || "",
  secondarySupplier: apiComponent.secondarySupplier || "",
  secondarySupplierItemCode: apiComponent.secondarySupplierItemCode || "",
  qtyExStock: apiComponent.qtyExStock || 0,
  currentStock: apiComponent.currentStock || 0,
  notes: apiComponent.notes || "",
  history: apiComponent.history || "",
  subcategoryId: apiComponent.subcategoryId,
  categoryName: "",
  subcategoryName: "",
  subComponents: []
});



// Helper functions to map API data to our types
export const mapApiSubCategoryToSubCategory = (apiSubCategory: any): SubCategory => ({
  id: apiSubCategory.id,
  subcategoryName: apiSubCategory.subcategoryName,
  categoryId: apiSubCategory.categoryId,
  components: []
});
