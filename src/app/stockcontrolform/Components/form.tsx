import { useState, useEffect, useMemo, } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, PlusCircle, Plus, Search, X } from "lucide-react";
import Loading from "./component_loading";
import { mapApiComponentToComponent, mapApiSubCategoryToSubCategory } from "./map.categories.helper";
import { client } from "@/services/schema";
import type { Category, ComponentItemProps, SubCategory } from "@/types/form.types";
import { useAuth } from "@/contexts/auth-context";
import ResponseModal from "@/components/widgets/response";

// Add loading props to the interface
interface ExtendedComponentItemProps extends ComponentItemProps {
  categoriesLoading?: boolean;
}

export default function ComponentItem({
  component,
  selectedCategoryId,
  onCategoryChange,
  usedKeys,
  onUpdate,
  onRemove,
  isRemovable,
  onAddNewKey,
  categories = [],
  usedSubcategoryIds,
  categoriesLoading = false,
}: ExtendedComponentItemProps) {
  const { permission } = useAuth();//auth state
  const [isAddingNewKey, setIsAddingNewKey] = useState<string | null>(null);
  const [newKeyInput, setNewKeyInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [componentSearchTerm, setComponentSearchTerm] = useState("");
  const [isAddingNewComponent, setIsAddingNewComponent] = useState(false);
  const [newComponentInput, setNewComponentInput] = useState("");

  const [catPermissions, setCatPermissions] = useState(false);
  const [SubcatPermissions, setsubCatPermissions] = useState(false);
  const [CompPermissions, setCompPermissions] = useState(false);
  //subcategories state
  const [allSubcategories, setAllSubcategories] = useState<any[]>([]);
  const [SubcategoriesLoading, setSubcategoriesLoading] = useState(false);

  //components state
  const [allComponents, setallComponents] = useState<any[]>([]);
  const [componentsLoading, setcomponentsLoading] = useState(false);

  // New states for  categories
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [temporaryCategories, setTemporaryCategories] = useState<Category[]>([]);

  // Add this state for temporary subcategories at the top with other states
  const [temporarySubcategories, setTemporarySubcategories] = useState<SubCategory[]>([]);
  const [temporaryComponents, setTemporaryComponents] = useState<any[]>([]);

  //show response 
  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  // Then update the filteredSubcategories memo to include temporary subcategories
  const filteredSubcategories = useMemo(() => {
    const allSubs = [...(allSubcategories || []), ...temporarySubcategories];
    return allSubs
      .map(mapApiSubCategoryToSubCategory).sort((a, b) => a.subcategoryName?.localeCompare(b.subcategoryName));
  }, [allSubcategories, temporarySubcategories, selectedCategoryId]);

  const filteredComponents = useMemo(() => {
    const allComps = [...(allComponents || []), ...temporaryComponents];
    return allComps
      .filter((comp: any) =>
        filteredSubcategories.some(sub => sub.id === comp.subcategoryId)
      )
      .map(mapApiComponentToComponent);
  }, [allComponents, temporaryComponents, filteredSubcategories]);

  // Memoized filtered categories including temporary ones
  const filteredCategories = useMemo(() => {
    const allCategories = [...categories, ...temporaryCategories];
    return allCategories.filter(cat =>
      cat.categoryName?.toLowerCase().includes(categorySearchTerm.toLowerCase())
    )
      .sort((a, b) => a.categoryName?.localeCompare(b.categoryName));
  }, [categories, temporaryCategories, categorySearchTerm]);

  // Get components ONLY for the currently selected subcategory
  const currentSubcategoryComponents = useMemo(() =>
    filteredComponents.filter(comp => comp.subcategoryId === component.subcategoryId),
    [filteredComponents, component.subcategoryId]
  );

  // Get available component IDs ONLY for current subcategory
  const availableComponentIds = useMemo(() =>
    currentSubcategoryComponents.map(comp => comp.componentId).filter(Boolean),
    [currentSubcategoryComponents]
  );

  // Memoized filtered keys for subcomponents - ONLY from current subcategory
  const filteredKeys = useMemo(() =>
    availableComponentIds.filter(key =>
      key.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.localeCompare(b)),
    [availableComponentIds, searchTerm]
  );

  // Memoized available subcategories
  const availableSubcategories = useMemo(() => filteredSubcategories, [filteredSubcategories]);

  // Memoized available options for subcategory selection
  const allAvailableOptions = useMemo(() =>
    availableSubcategories.map(sub => ({
      id: sub.id,
      componentName: sub.subcategoryName,
      subcategoryId: sub.id,
      categoryName: categories.find(cat => cat.id === selectedCategoryId)?.categoryName || "",
      subcategoryName: sub.subcategoryName,
      subComponents: []
    })).sort((a, b) => a.componentName?.localeCompare(b.componentName)),
    [availableSubcategories, categories, selectedCategoryId]
  );

  // Memoized filtered available options
  const filteredAvailableOptions = useMemo(() =>
    allAvailableOptions.filter(option =>
      option.componentName?.toLowerCase().includes(componentSearchTerm.toLowerCase())
    ),
    [allAvailableOptions, componentSearchTerm]
  );

  useEffect(() => {
    if (permission?.permissions?.includes('scf.category.edit') || permission?.isAdmin) {
      setCatPermissions(true);
    } else {
      setCatPermissions(false);
    }
    if (permission?.permissions?.includes('scf.subcategory.edit') || permission?.isAdmin) {
      setsubCatPermissions(true);
    } else {
      setsubCatPermissions(false);
    }
    if (permission?.permissions?.includes('scf.component.edit') || permission?.isAdmin) {
      setCompPermissions(true);
    } else {
      setCompPermissions(false);
    }
  }, [permission]);


  useEffect(() => {
    setSubcategoriesLoading(true);
    const checkSubcategoryExists = async () => {
      // Skip if it's a temporary subcategory (just added)
      if (component.subcategoryId && component.subcategoryId.startsWith("temp-sub-")) {
        return;
      }

      if (selectedCategoryId) {
        const result = await client.models.SubCategory.listSubCategoriesByCategoryIdAndName({
          categoryId: selectedCategoryId
        });

        setAllSubcategories(result.data);

        if (!result.data) {
          onUpdate({
            ...component,
            componentName: "",
            subcategoryId: "",
            subcategoryName: "",
          });
        }
        setSubcategoriesLoading(false);
      }

    };

    checkSubcategoryExists();
  }, [selectedCategoryId]);

  useEffect(() => {
    setcomponentsLoading(true);
    const fetchComponents = async () => {
      if (component.subcategoryId) {

        const result = await client.models.Component.listComponentsBySubCategoryId({
          subcategoryId: component.subcategoryId
        });
        setallComponents(result.data || []);
      }
      setcomponentsLoading(false);
    };

    fetchComponents();
  }, [component.subcategoryId]);

  // Cleanup deleted subcomponents - FIXED
  useEffect(() => {
    if (component.subComponents.some(sub => sub.key) && availableComponentIds.length > 0) {
      let needsUpdate = false;
      const updatedSubComponents = component.subComponents.map(sub => {
        // Skip if it's a newly added key (empty or just being added)
        if (!sub.key || isAddingNewKey === sub.id) {
          return sub;
        }

        if (sub.key && !availableComponentIds.includes(sub.key)) {
          needsUpdate = true;
          return { ...sub, key: "", value: "" };
        }
        return sub;
      });

      if (needsUpdate) {
        onUpdate({
          ...component,
          subComponents: updatedSubComponents,
        });
      }
    }
  }, [availableComponentIds, isAddingNewKey]);


  const updateComponentSelection = async (subcategoryId: string) => {
    try {
      if (subcategoryId === "__add_new_component__") {
        if (!SubcatPermissions) {
          setShow(true);
          setSuccessful(false)
          setMessage("⛔ No sub category edit permission")

          return;
        }
        setIsAddingNewComponent(true);
        setNewComponentInput("");
        setComponentSearchTerm("");
        return;
      }

      // Find the selected subcategory
      const selectedSubcategory = filteredSubcategories.find(sub => sub.id === subcategoryId);

      if (selectedSubcategory) {
        // Search in both categories and temporary categories
        const allCategories = [...categories, ...temporaryCategories];
        const selectedCategory = allCategories.find(cat => cat.id === selectedCategoryId);

        const updatedComponent = {
          ...component,
          id: component.id,
          componentName: selectedSubcategory.subcategoryName,
          subcategoryId: selectedSubcategory.id,
          categoryName: selectedCategory?.categoryName || "", // This should now work
          subcategoryName: selectedSubcategory.subcategoryName,
          subComponents: component.subComponents.length > 0 ? component.subComponents : [
            { id: `${Date.now()}-1`, key: "", value: "", componentId: component.id }
          ]
        };

        onUpdate(updatedComponent);
      }
    } catch (error) {
      console.error("Error updating component:", error);
    }
  };
  const cancelAddingNewComponent = () => {
    setIsAddingNewComponent(false);
    setNewComponentInput("");
    setComponentSearchTerm("");
  };

  const confirmNewComponent = async () => {
    if (newComponentInput.trim() && selectedCategoryId) {
      // Search in both categories and temporary categories
      const allCategories = [...categories, ...temporaryCategories];
      const selectedCategory = allCategories.find(cat => cat.id === selectedCategoryId);

      const newSubcategoryId = `temp-sub-${Date.now()}`;

      const newSubcategory: SubCategory = {
        id: newSubcategoryId,
        subcategoryName: newComponentInput.trim(),
        categoryId: selectedCategoryId,
        components: []
      };

      // Add to temporary subcategories
      setTemporarySubcategories(prev => [...prev, newSubcategory]);

      const updatedComponent = {
        ...component,
        id: component.id,
        componentName: newComponentInput.trim(),
        subcategoryId: newSubcategoryId,
        categoryName: selectedCategory?.categoryName || "",
        subcategoryName: newComponentInput.trim(),
        subComponents: component.subComponents
      };

      onUpdate(updatedComponent);
    }
    cancelAddingNewComponent();
  };

  const handleCategoryChange = (categoryId: string) => {

    if (categoryId === "__add_new_category__") {
      if (!catPermissions) {
        setShow(true);
        setSuccessful(false)
        setMessage("⛔ No category edit permission")

        return;
      }
      setIsAddingNewCategory(true);
      setNewCategoryInput("");
      setCategorySearchTerm("");
      return;
    }

    onCategoryChange(categoryId);

    // Reset component when category changes
    onUpdate({
      ...component,
      id: component.id,
      componentName: "",
      subcategoryId: "",
      categoryName: categories.find(cat => cat.id === categoryId)?.categoryName || "",
      subcategoryName: "",
      subComponents: component.subComponents.length > 0 ? component.subComponents : [
        { id: `${Date.now()}-1`, key: "", value: "", componentId: component.id }
      ]
    });
  };

  const cancelAddingNewCategory = () => {
    setIsAddingNewCategory(false);
    setNewCategoryInput("");
    setCategorySearchTerm("");
  };

  // confirmNewCategory function
  const confirmNewCategory = () => {
    if (newCategoryInput.trim()) {
      const newCategoryId = `new-cat-${Date.now()}`;

      const newCategory: Category = {
        id: newCategoryId,
        categoryName: newCategoryInput.trim(),
        subcategories: []
      };

      setTemporaryCategories(prev => {
        return [...prev, newCategory];
      });


      onCategoryChange(newCategoryId);

      onUpdate({
        ...component,
        id: component.id,
        componentName: "",
        subcategoryId: "",
        categoryName: newCategoryInput.trim(),
        subcategoryName: "",
        subComponents: component.subComponents.length > 0
          ? component.subComponents
          : [{ id: `${Date.now()}-1`, key: "", value: "", componentId: component.id }]
      });
    }
    cancelAddingNewCategory();
  };
  const addSubComponent = () => {
    const newSubComponent = {
      id: `${component.id}-${Date.now()}`,
      key: "",
      value: "",
      componentId: component.id
    };
    onUpdate({
      ...component,
      subComponents: [...component.subComponents, newSubComponent]
    });
  };

  const removeSubComponent = (subComponentId: string) => {
    if (component.subComponents.length > 1) {
      onUpdate({
        ...component,
        subComponents: component.subComponents.filter(
          (sub) => sub.id !== subComponentId
        )
      });
    }
  };

  const updateSubComponentKey = (subComponentId: string, key: string) => {
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((sub) =>
        sub.id === subComponentId ? { ...sub, key } : sub
      )
    });
  };

  const updateSubComponentValue = (subComponentId: string, value: string) => {
    const stringValue = value || "";
    onUpdate({
      ...component,
      subComponents: component.subComponents.map((sub) =>
        sub.id === subComponentId ? { ...sub, value: stringValue } : sub
      )
    });
  };

  const startAddingNewKey = (subComponentId: string) => {
    setIsAddingNewKey(subComponentId);
    setNewKeyInput("");
    setSearchTerm("");
  };

  const cancelAddingNewKey = () => {
    setIsAddingNewKey(null);
    setNewKeyInput("");
    setSearchTerm("");
  };

  const confirmNewKey = (subComponentId: string) => {
    if (newKeyInput.trim()) {
      const trimmedKey = newKeyInput.trim();

      // Create temporary component
      const newComponent = {
        id: `temp-comp-${Date.now()}`,
        componentId: trimmedKey,
        componentName: trimmedKey,
        subcategoryId: component.subcategoryId,
        categoryId: selectedCategoryId
      };

      // Add to temporary components
      setTemporaryComponents(prev => [...prev, newComponent]);

      if (onAddNewKey) {
        onAddNewKey(trimmedKey);
      }

      updateSubComponentKey(subComponentId, trimmedKey);
    }
    cancelAddingNewKey();
  };

  const handleKeySelect = (subComponentId: string, value: string) => {
    
    if (value === "__add_new__") {
      console.log("Add new")
      if (!CompPermissions) {
        setShow(true);
        setSuccessful(false)
        setMessage("⛔ No component edit permission")

        return;
      }
      startAddingNewKey(subComponentId);
    } else {
      updateSubComponentKey(subComponentId, value);
    }
  };

  return (
    <div className="p-4 border rounded-lg space-y-4 bg-background shadow-sm">
      {/* Category Selection with Add New and Remove Button */}
      <div className="flex items-center gap-4">

        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">Category</label>
          {isAddingNewCategory ? (
            <div className="space-y-1">
              <div className="flex gap-2">
                <Input
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="Enter new category name..."
                  className="flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmNewCategory();
                    if (e.key === 'Escape') cancelAddingNewCategory();
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={cancelAddingNewCategory}
                >
                  <X className="h-4 w-4 cursor-pointer" />
                </Button>
                <Button
                  type="button"
                  onClick={confirmNewCategory}
                  disabled={!newCategoryInput.trim()}
                >
                  <Plus className="h-4 w-4 cursor-pointer" />
                </Button>
              </div>
            </div>
          ) : (
            <Select value={selectedCategoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue placeholder="Select category">
                  {selectedCategoryId ? filteredCategories.find(cat => cat.id === selectedCategoryId)?.categoryName : "Select category"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <div className="sticky top-0 z-10 bg-background p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input

                      placeholder="Search categories..."
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="pl-8 pr-8 h-9"
                    />
                    {categorySearchTerm && (
                      <X
                        className="absolute right-2 top-2.5 h-4 w-4 text-gray-500 cursor-pointer"
                        onClick={() => setCategorySearchTerm("")}
                      />
                    )}
                  </div>
                </div>

                {/* Show loading in dropdown content when categories are loading */}
                {categoriesLoading ? (
                  <div className="p-4 text-center">
                    <Loading />
                  </div>
                ) : (
                  <>
                    {filteredCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.categoryName}
                      </SelectItem>
                    ))}

                    <div className="border-t mt-1 pt-1">
                      <SelectItem
                        value="__add_new_category__"
                        className="text-blue-600 font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <PlusCircle className="h-4 w-4 cursor-pointer" />
                        Add New Category...
                      </SelectItem>
                    </div>
                  </>
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          disabled={!isRemovable}
          className="shrink-0 mt-6"
        >
          <Trash2 className="h-4 w-4 cursor-pointer" />
        </Button>
      </div>

      {/* Subcategory Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Subcategory</label>
        {isAddingNewComponent ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                value={newComponentInput}
                onChange={(e) => setNewComponentInput(e.target.value)}
                placeholder="Enter new subcategory name..."
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmNewComponent();
                  if (e.key === 'Escape') cancelAddingNewComponent();
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={cancelAddingNewComponent}
              >
                <X className="h-4 w-4 cursor-pointer" />
              </Button>
              <Button
                type="button"
                onClick={confirmNewComponent}
                disabled={!newComponentInput.trim() || !selectedCategoryId}
              >
                <Plus className="h-4 w-4 cursor-pointer" />
              </Button>
            </div>
            <div className="text-xs text-gray-500">
              Subcategory will be added to selected category
            </div>
          </div>
        ) : (
          <Select
            // key={filteredSubcategories.length}
            value={component.subcategoryId && filteredSubcategories.some(sub => sub.id === component.subcategoryId)
              ? component.subcategoryId
              : ""
            }
            onValueChange={updateComponentSelection}
            disabled={!selectedCategoryId}
          >
            <SelectTrigger className="w-full cursor-pointer">
              <SelectValue placeholder="Select a subcategory">
                {component.componentName || "Select a subcategory..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-60" onCloseAutoFocus={(e) => e.preventDefault()}>
              <>
                <div className="sticky top-0 z-10 bg-background p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search subcategories..."
                      value={componentSearchTerm}
                      onChange={(e) => setComponentSearchTerm(e.target.value)}
                      className="pl-8 pr-8 h-9"
                    />
                    {componentSearchTerm && (
                      <X
                        className="absolute right-2 top-2.5 h-4 w-4 text-gray-500 cursor-pointer"
                        onClick={() => setComponentSearchTerm("")}
                      />
                    )}
                  </div>
                </div>
                {/* Add loading for subcategories */}
                {SubcategoriesLoading ? (
                  <div className="p-4 text-center">
                    <Loading />
                  </div>
                ) : (<>
                  {filteredAvailableOptions.length > 0 ? (
                    filteredAvailableOptions.map((comp) => (
                      <SelectItem
                        key={comp.id}
                        value={comp.id}
                        disabled={usedSubcategoryIds?.includes(comp.id) && component.subcategoryId !== comp.id}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <span>{comp.componentName}</span>
                        {usedSubcategoryIds?.includes(comp.id) && component.subcategoryId !== comp.id && (
                          <span className="text-xs text-red-500 ml-2">(already used)</span>
                        )}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-center text-gray-500 text-sm">
                      {selectedCategoryId ? "No subcategories available for this category" : "Please select a category first"}
                    </div>
                  )}

                  <div className="border-t mt-1 pt-1">
                    <SelectItem
                      value="__add_new_component__"
                      className="text-blue-600 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <PlusCircle className="h-4 w-4 cursor-pointer" />
                      Add New Subcategory...
                    </SelectItem>
                  </div>
                </>
                )}
              </>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Subcomponents Section */}
      <div className="space-y-4 pl-6 border-l-2 border-blue-200">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-600">Subcomponents</h4>
          <span className="text-sm text-gray-500 bg-background px-2 py-1 rounded">
            {component.subComponents.length} subcomponent(s)
          </span>
        </div>

        {component.subComponents.map((subComponent) => (
          <div
            key={subComponent.id}
            className="flex items-center gap-4 p-4 border rounded-lg bg-background"
          >
            <div className="flex-1 min-w-0">
              {isAddingNewKey === subComponent.id ? (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <Input
                      value={newKeyInput}
                      onChange={(e) => setNewKeyInput(e.target.value)}
                      placeholder="Enter new subcomponent name..."
                      className="flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmNewKey(subComponent.id);
                        if (e.key === 'Escape') cancelAddingNewKey();
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={cancelAddingNewKey}
                    >
                      <X className="h-4 w-4 cursor-pointer" />
                    </Button>
                    <Button
                      type="button"
                      onClick={() => confirmNewKey(subComponent.id)}
                      disabled={!newKeyInput.trim()}
                    >
                      <Plus className="h-4 w-4 cursor-pointer" />
                    </Button>
                  </div>

                </div>
              ) : (
                <Select
                  value={subComponent.key && availableComponentIds.includes(subComponent.key)
                    ? subComponent.key
                    : ""
                  }
                  onValueChange={(value) => handleKeySelect(subComponent.id, value)}
                >
                  <SelectTrigger className="relative cursor-pointer">
                    <SelectValue placeholder="Select or add subcomponent">
                      {subComponent.key || "Select a subcomponent..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60" onCloseAutoFocus={(e) => e.preventDefault()} key="category-select">
                    <div className="sticky top-0 z-10 bg-background p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Search subcomponents..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 pr-8 h-9"
                        />
                        {searchTerm && (
                          <X
                            className="absolute right-2 top-2.5 h-4 w-4 text-gray-500 cursor-pointer"
                            onClick={() => setSearchTerm("")}
                          />
                        )}
                      </div>
                    </div>

                    {/* Show loading in dropdown content when components are loading */}
                    {componentsLoading ? (
                      <div className="p-4 text-center">
                        <Loading />
                      </div>
                    ) : (
                      <>
                        {filteredKeys.length > 0 ? (
                          filteredKeys.map((key) => (
                            <SelectItem
                              key={key}
                              value={key}
                              disabled={usedKeys.includes(key) && subComponent.key !== key}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <span>{key}</span>
                              {usedKeys.includes(key) && subComponent.key !== key && (
                                <span className="text-xs text-red-500 ml-2">(already used)</span>
                              )}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-center text-gray-500 text-sm">
                            No subcomponents available
                          </div>
                        )}

                        <div className="border-t mt-1 pt-1">
                          <SelectItem
                            value="__add_new__"
                            className="text-blue-600 font-medium flex items-center gap-2 cursor-pointer"
                          >
                            <PlusCircle className="h-4 w-4 cursor-pointer" />
                            Add New Subcomponent...
                          </SelectItem>
                        </div>
                      </>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex-1">
              <Input
                type="number"
                step="1"
                value={subComponent.value}
                onChange={(e) => updateSubComponentValue(subComponent.id, e.target.value)}
                placeholder="Enter value"
                className="w-full"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => removeSubComponent(subComponent.id)}
              disabled={component.subComponents.length === 1}
              className="shrink-0 hover:border-red-300 hover:text-red-600 cursor-pointer"
              title="Remove subcomponent"
            >
              <Trash2 className="h-4 w-4 cursor-pointer" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addSubComponent}
          className="flex items-center gap-2 w-full border-dashed hover:border-solid cursor-pointer"
        >
          <PlusCircle className="h-4 w-4 cursor-pointer" />
          Add Subcomponent
        </Button>
      </div>

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