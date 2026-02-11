import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Minus } from "lucide-react";
import ComponentItem from "./Components/form";
import Navbar from "@/components/layout/navbar";
import ResponseModal from "@/components/widgets/response";
import { client } from "@/services/schema";
import Footer from "@/components/layout/footer";
import Loading from "@/components/widgets/loading";
import { mapApiCategoryToCategory } from "./Components/map.categories.helper";
import type { Category, Component } from "@/types/form.types";
import { SCF_clickUpService } from "@/services/scf.clickUp.service";


export default function ComponentForm() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [displayedComponents, setDisplayedComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [transactionType, setTransactionType] = useState<boolean>(false);


  const [show, setShow] = useState(false);
  const [successful, setSuccessful] = useState(false);
  const [message, setMessage] = useState("");

  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Record<string, string>>({});



  const addNewComponent = () => {
    const newComponent: Component = {
      id: Date.now().toString(),
      componentId: "",
      componentName: "",
      subcategoryId: "",
      subComponents: [
        {
          id: `${Date.now()}-1`,
          key: "",
          value: "",
          componentId: Date.now().toString()
        }
      ]
    };

    setDisplayedComponents([newComponent, ...displayedComponents]);
  };

  // Fetch only categories
  useEffect(() => {
    const subscription = client.models.Category.observeQuery().subscribe({
      next: ({ items: categoriesData, isSynced }) => {
        if (isSynced) {

          // Map API data to our Category type
          const mappedCategories: Category[] = (categoriesData || []).map(mapApiCategoryToCategory);
          setCategories(mappedCategories);

          // Start with one empty component automatically AFTER data is loaded
          if (displayedComponents.length === 0) {
            addNewComponent();
          }

          setCategoriesLoading(false);
          setLoading(false);
        }
      },
      error: (error) => {
        console.error("Error subscribing to categories:", error);
        setCategoriesLoading(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [addNewComponent, displayedComponents.length]);

  const updateComponent = (id: string, updatedComponent: Component) => {
    setDisplayedComponents(
      displayedComponents.map((component) =>
        component.id === id ? updatedComponent : component
      )
    );
  };

  const updateComponentCategory = (componentId: string, categoryId: string) => {
    setSelectedCategoryIds(prev => ({
      ...prev,
      [componentId]: categoryId
    }));
  };


  const removeComponent = (id: string) => {
    setDisplayedComponents(displayedComponents.filter((component) => component.id !== id));
  };

  const handleAddNewKey = (newKey: string) => {
    if (!availableKeys.includes(newKey)) {
      setAvailableKeys(prev => [...prev, newKey]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      setLoading(true);
      e.preventDefault();

      const savedUser = localStorage.getItem("user");
      const result = displayedComponents.reduce((acc, component) => {
        if (component.componentName.trim() !== "" && component.categoryName) {
          const subAcc = component.subComponents.reduce((subAcc, sub) => {
            if (sub.key.trim() !== "") {
              subAcc[sub.key] = { value: sub.value };
            }
            return subAcc;
          }, {} as Record<string, { value: string }>);

          if (Object.keys(subAcc).length > 0) {
            if (!acc[component.categoryName]) {
              acc[component.categoryName] = {};
            }

            const subKey = component.subcategoryName || component.componentName;

            acc[component.categoryName][subKey] = {
              isWithdrawal: transactionType,
              subComponents: subAcc
            };
          }
        }
        return acc;
      }, {} as Record<string, any>);


      const isAllValuesEmpty = (obj: any): boolean => {
        const values = JSON.stringify(obj).match(/"value":"(.*?)"/g);
        return !values || values.every(v => v === '"value":""');
      };

      if (isAllValuesEmpty(result)) {
        setMessage("Nothing to submit!");
        setShow(true);
        setSuccessful(false);
        return;
      }

      // API call
      const response = await SCF_clickUpService.createTask(savedUser, result)

      setMessage(response.message || "Successfully published to ClickUp");
      setShow(true);
      setSuccessful(response.success);

      // Reset form
      setDisplayedComponents([
        {
          id: Date.now().toString(),
          componentId: "",
          componentName: "",
          subcategoryId: "",
          categoryName: "",
          subcategoryName: "",
          subComponents: [
            {
              id: `${Date.now()}-1`,
              key: "",
              value: "",
              componentId: Date.now().toString()
            }
          ]
        }
      ]);
      setAvailableKeys([]);

    } catch (error) {
      console.error(error);
      setSuccessful(false);
      setMessage("Failed to publish to ClickUp");
      setShow(true);
    } finally {
      setLoading(false);
    }
  };


  const getUsedKeys = () => {
    const usedKeys: string[] = [];
    displayedComponents.forEach(component => {
      component.subComponents.forEach(sub => {
        if (sub.key) usedKeys.push(sub.key);
      });
    });
    return usedKeys;
  };
  //track used subcategories
  const getUsedSubcategoryIds = (currentComponentId?: string): string[] => {
    return displayedComponents
      .filter(comp => comp.id !== currentComponentId && comp.subcategoryId)
      .map(comp => comp.subcategoryId);
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Navbar />

      {loading || categoriesLoading ? (
        <Loading />
      ) : (
        <main className="flex-1 p-6 mt-20 pb-20">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">
                  Stock Control Form
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <form onSubmit={handleSubmit} className="space-y-6 min-w-[600px]">
                    {/* Transaction Type */}

                    <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                      <span className="font-semibold text-sm">Transaction Type:</span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={transactionType ? "outline" : "default"}
                          size="sm"
                          onClick={() => setTransactionType(false)}
                          className={`flex items-center gap-2 ${!transactionType ? "bg-green-600 hover:bg-green-700" : ""}`}
                        >
                          <Plus className="h-3 w-3 cursor-pointer" />
                          Intake
                        </Button>
                        <Button
                          type="button"
                          variant={transactionType ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTransactionType(true)}
                          className={`flex items-center gap-2 ${transactionType ? "bg-red-600 hover:bg-red-700" : ""}`}
                        >
                          <Minus className="h-3 w-3 cursor-pointer" />
                          Withdrawal
                        </Button>
                      </div>
                    </div>
                    {/* Add Category Button */}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addNewComponent}
                        className="cursor-pointer"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Category
                      </Button>
                    </div>


                    {displayedComponents.map((component) => (
                      <ComponentItem
                        key={component.id}
                        component={component}
                        selectedCategoryId={selectedCategoryIds[component.id] || ""}
                        onCategoryChange={(categoryId) => updateComponentCategory(component.id, categoryId)}
                        usedKeys={getUsedKeys()}
                        categories={categories}
                        onUpdate={(updatedComponent) => updateComponent(component.id, updatedComponent)}
                        onRemove={() => removeComponent(component.id)}
                        isRemovable={true}
                        onAddNewKey={handleAddNewKey}
                        usedSubcategoryIds={getUsedSubcategoryIds(component.id)}
                        categoriesLoading={categoriesLoading}
                      />
                    ))}

                    {/* Submit Button */}
                    {displayedComponents.length > 0 && (
                      <div className="flex justify-end pt-4">
                        <Button type="submit" className="cursor-pointer" disabled={loading}>
                          Submit
                          {loading && (
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          )}
                        </Button>
                      </div>
                    )}
                  </form>

                  {show && (
                    <ResponseModal
                      successful={successful}
                      message={message}
                      setShow={setShow}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}