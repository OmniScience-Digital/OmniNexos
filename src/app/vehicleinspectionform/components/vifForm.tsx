// components/vifForm.tsx
"use client";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState, useEffect } from "react";
import {
  BooleanQuestion,
  booleanQuestions as initialQuestions,
  PhotoUpload,
  PhotoState
} from "./questions";
import { vifForm } from "@/types/vifForm.types";
import { client } from "@/services/schema";
import Loading from "@/components/widgets/loading";

interface VifFormProps {
  onVehicleChange: (vehicleId: string, vehicleReg: string, vehicleVin: string) => void;
  onOdometerChange: (value: string) => void;
  onBooleanQuestionsChange: (questions: typeof initialQuestions) => void;
  onPhotosChange: (photos: PhotoState[]) => void;
  inspectionNumber: number | null,
  formState: {
    selectedVehicleReg: string;
    selectedVehicleId: string;
    odometerValue: string;
    booleanQuestions: typeof initialQuestions;
    photos: PhotoState[];
  };
  vehicles: vifForm[];
}

export default function VifForm({
  onVehicleChange,
  onOdometerChange,
  onBooleanQuestionsChange,
  onPhotosChange,
  inspectionNumber,
  formState,
  vehicles
}: VifFormProps) {
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState("");
  const [vehiclesLoading, setvehiclesLoading] = useState(false);
  const [recentInspection, setRecentInspection] = useState<any>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle =>
      vehicle.vehicleReg?.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
    ).sort((a, b) => a.vehicleReg?.localeCompare(b.vehicleReg));
  }, [vehicles, vehicleSearchTerm]);

  // Fetch recent inspection when vehicle changes
  useEffect(() => {
    const fetchRecentInspection = async () => {
      if (!formState.selectedVehicleId) {
        setRecentInspection(null);
        return;
      }

      setLoadingInspection(true);
      try {
        // Use the GSI to get inspections sorted by inspection number (highest first)
        const { data: inspections } = await client.models.Inspection.inspectionsByFleetAndNumber(
          { fleetid: formState.selectedVehicleId },
          { sortDirection: 'DESC', limit: 1 }
        );

        const mostRecent = inspections && inspections.length > 0
          ? inspections.sort((a: any, b: any) =>
            new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime()
          )[0]
          : null;

        setRecentInspection(mostRecent);

        if (mostRecent) {
          if (mostRecent.odometerStart) {
            onOdometerChange(mostRecent.odometerStart.toString());
          }

          const updatedQuestions = initialQuestions.map((question, index: number) => { 
            const inspection: any = mostRecent;
            const fieldNames = [
              'oilAndCoolant', 'fuelLevel', 'seatbeltDoorsMirrors', 'handbrake',
              'tyreCondition', 'spareTyre', 'numberPlate', 'licenseDisc',
              'leaks', 'lights', 'defrosterAircon', 'emergencyKit', 'clean',
              'warnings', 'windscreenWipers', 'serviceBook', 'siteKit'
            ];

            const fieldName = fieldNames[index];
            if (fieldName && inspection[fieldName] !== undefined && inspection[fieldName] !== null) {
              return {
                ...question,
                value: inspection[fieldName]
              };
            }
            return question;
          });

          onBooleanQuestionsChange(updatedQuestions);
        }
      } catch (error) {
        console.error('Error fetching inspection:', error);
      } finally {
        setLoadingInspection(false);
      }
    };

    fetchRecentInspection();
  }, [formState.selectedVehicleId]);

  const handleVehicleChange = (vehicleId: string) => {
    const selectedVehicle = vehicles.find(vehicle => vehicle.id === vehicleId);
    if (selectedVehicle) {
      onVehicleChange(vehicleId, selectedVehicle.vehicleReg || "", selectedVehicle.vehicleVin || "");
      onPhotosChange([]);
    }
  };

  const handleBooleanChange = (index: number, value: boolean) => { // FIXED: Added type annotation
    const updatedQuestions = [...formState.booleanQuestions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      value: value
    };
    onBooleanQuestionsChange(updatedQuestions);
  };

  const handleOdometerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onOdometerChange(e.target.value);
  };

  const getPreviousAnswer = (index: number) => { // FIXED: Added type annotation
    if (!recentInspection) return null;

    const fieldNames = [
      'oilAndCoolant', 'fuelLevel', 'seatbeltDoorsMirrors', 'handbrake',
      'tyreCondition', 'spareTyre', 'numberPlate', 'licenseDisc',
      'leaks', 'lights', 'defrosterAircon', 'emergencyKit', 'clean',
      'warnings', 'windscreenWipers', 'serviceBook', 'siteKit'
    ];

    const fieldName = fieldNames[index];
    const inspection: any = recentInspection;
    return fieldName ? inspection[fieldName] : null;
  };

  const canSubmit = formState.photos.length > 0 &&
    formState.photos.every(photo => photo.status === 'success') &&
    formState.odometerValue &&
    !formState.booleanQuestions.some(q => q.value === null);

  return (
    <div className="p-4 border rounded-lg space-y-4 bg-background shadow-sm">
      {/* Vehicle Selection */}
      <div className="flex items-center gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">Vehicle Registration</label>
          <Select value={formState.selectedVehicleId} onValueChange={handleVehicleChange}>
            <SelectTrigger className="cursor-pointer">
              <SelectValue placeholder="Select a vehicle">
                {formState.selectedVehicleId ? vehicles.find(vehicle => vehicle.id === formState.selectedVehicleId)?.vehicleReg : "Select a vehicle"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
              <div className="sticky top-0 z-10 bg-background p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search vehicles..."
                    value={vehicleSearchTerm}
                    onChange={(e) => setVehicleSearchTerm(e.target.value)}
                    className="pl-8 pr-8 h-9"
                  />
                  {vehicleSearchTerm && (
                    <X
                      className="absolute right-2 top-2.5 h-4 w-4 text-gray-500 cursor-pointer"
                      onClick={() => setVehicleSearchTerm("")}
                    />
                  )}
                </div>
              </div>

              {vehiclesLoading ? (
                <div className="p-4 text-center">
                  <Loading />
                </div>
              ) : (
                <>
                  {filteredVehicles.map((vehicle: any) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehicleReg}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Photo Upload */}
      {formState.selectedVehicleId && (
        <div className="space-y-2 animate-in fade-in-0 duration-300">
          <label className="text-sm font-medium">Upload Inspection Photos</label>
          <PhotoUpload
            onPhotosChange={onPhotosChange}
            vehicleReg={formState.selectedVehicleReg}
            inspectionNumber={inspectionNumber}
          />
        </div>
      )}

      {/* Rest of form */}
      {formState.selectedVehicleId && formState.photos.length > 0 && (
        <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {recentInspection && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700 font-medium">
                📋 Last inspection: {new Date(recentInspection.inspectionDate).toLocaleDateString()}
              </p>
            </div>
          )}

          <div className="space-y-2 animate-in fade-in-0 duration-500 delay-150">
            <label className="text-sm font-medium mb-5">
              Odometer Start
              {recentInspection?.odometerStart && (
                <span className="text-blue-600 ml-2">
                  (Last: {recentInspection.odometerStart} km)
                </span>
              )}
            </label>
            <Input
              type="number"
              placeholder="Enter odometer reading"
              className="w-full"
              value={formState.odometerValue}
              onChange={handleOdometerChange}
            />
          </div>

          <div className="space-y-4 animate-in fade-in-0 duration-500 delay-300">
            {formState.booleanQuestions.map((question, index: number) => { // FIXED: Added type annotation
              const previousAnswer = getPreviousAnswer(index);

              return (
                <div key={index} className={previousAnswer !== null ? 'border-l-4 border-l-blue-500 pl-3' : ''}>
                  <BooleanQuestion
                    question={question.question}
                    value={question.value}
                    onChange={(value) => handleBooleanChange(index, value)}
                  />
                  {previousAnswer !== null && (
                    <p className="text-xs text-blue-600 mt-1">
                      Previous: {previousAnswer ? '✅ Yes' : '❌ No'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className={`p-3 rounded-md border ${canSubmit
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
            <p className="text-sm font-medium">
              {canSubmit
                ? '✅ All set! Form is ready for submission.'
                : '⚠️ Please complete all fields and ensure all photos are uploaded'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}