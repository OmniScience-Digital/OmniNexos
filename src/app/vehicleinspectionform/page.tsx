// parent component
import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Loading from "@/components/widgets/loading";
import { client } from "@/services/schema";
import VifForm from "./components/vifForm";
import Footer from "@/components/layout/footer";
import type { vifForm } from "@/types/vifForm.types";
import { mapApiCategoryToVehicle } from "../stockcontrolform/Components/map.categories.helper";
import { booleanQuestions as initialQuestions, type PhotoState } from "./components/questions";
import ResponseModal from "@/components/widgets/response";
import { Loader2 } from "lucide-react";
import { getJhbTimestamp } from "@/utils/helper/time";
import ImageUploadLoader from "./components/imageLoader";
import { calculateCustomFields } from "./components/customfield";
import { uploadPhoto, Vif_clickUpService } from "@/services/vif.clickUp.service";


export default function Vehicle_Inspection_Form() {
    const [loading, setLoading] = useState(false);
    const [loadingbtn, setLoadingbtn] = useState(false);
    const [vehicles, setvehicles] = useState<vifForm[]>([]);
    const [show, setShow] = useState(false);
    const [successful, setSuccessful] = useState(false);
    const [message, setMessage] = useState("");
    const [inspectionNumber, setInspectionNumber] = useState<number>(1);


    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    // Add upload progress state
    const [uploadProgress, setUploadProgress] = useState({
        isUploading: false,
        currentImage: 0,
        totalImages: 0
    });

    const [formState, setFormState] = useState({
        selectedVehicleId: "",
        selectedVehicleReg: "",
        selectedVehicleVin: "",
        odometerValue: "",
        booleanQuestions: initialQuestions,
        photos: [] as PhotoState[]
    });


    const getNextInspectionNumber = async (fleetId: string): Promise<number> => {
        try {
            // Use the new GSI that sorts by inspectionNo
            const { data } = await client.models.Inspection.inspectionsByFleetAndNumber(
                { fleetid: fleetId },
                { sortDirection: 'DESC', limit: 1 }
            );

            const lastInspection = data?.[0];
            const lastNo = lastInspection?.inspectionNo ?? 0;

            const nextNumber = lastNo + 1;
 
            return nextNumber;
        } catch (error) {
            console.error("Error fetching existing inspections:", error);
            return 1;
        }
    };


    // Check if form can be submitted
    const canSubmit = formState.selectedVehicleId &&
        formState.odometerValue &&
        formState.photos.length > 0 &&
        formState.photos.every(photo => photo.status === 'success') &&
        !formState.booleanQuestions.some(q => q.value === null);




    const handleVehicleChange = useCallback(async (vehicleId: string, vehicleReg: string, vehicleVin: string) => {
        setFormState(prev => ({
            ...prev,
            selectedVehicleId: vehicleId,
            selectedVehicleReg: vehicleReg,
            selectedVehicleVin: vehicleVin
        }));
        if (vehicleId) {
            const nextNumber = await getNextInspectionNumber(vehicleId);
            setInspectionNumber(nextNumber);
        }
    }, []);

    const handleOdometerChange = useCallback((value: string) => {
        setFormState(prev => ({ ...prev, odometerValue: value }));
    }, []);

    const handleBooleanQuestionsChange = useCallback((questions: typeof initialQuestions) => {
        setFormState(prev => ({ ...prev, booleanQuestions: questions }));
    }, []);

    const handlePhotosChange = useCallback((photos: PhotoState[]) => {
        setFormState(prev => ({ ...prev, photos }));
    }, []);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoadingbtn(true);

            // Quick validation
            const hasUnuploadedPhotos = formState.photos.some(photo => photo.status !== 'success');
            if (hasUnuploadedPhotos) {
                setMessage("Please wait for all photos to finish uploading");
                setShow(true);
                setSuccessful(false);
                setLoadingbtn(false);
                return;
            }

            if (!formState.odometerValue || formState.booleanQuestions.some(q => q.value === null)) {
                setMessage("Please complete all required fields");
                setShow(true);
                setSuccessful(false);
                setLoadingbtn(false);
                return;
            }

            const savedUser = localStorage.getItem("user");
            const timestamp = getJhbTimestamp();

            // Extract S3 keys from successfully uploaded photos
            const s3PhotoKeys = formState.photos
                .filter(photo => photo.status === 'success')
                .map(photo => photo.s3Key);

            // Prepare inspection results
            const inspectionResults = formState.booleanQuestions.map(q => ({
                question: q.question,
                answer: String(q.value)
            }));

            const inspectionNo = await getNextInspectionNumber(formState.selectedVehicleId);

            // Save to Amplify Data
            const historyEntry = `VIF DAshboard: ${savedUser} @ ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}: Inspection #${inspectionNo} for vehicle ${formState.selectedVehicleReg}\n`;

            const inspectionData = {
                fleetid: formState.selectedVehicleId,
                inspectionNo: inspectionNo,
                vehicleVin: formState.selectedVehicleVin,
                inspectionDate: new Date().toISOString().split('T')[0],
                inspectionTime: new Date().toTimeString().split(' ')[0],
                odometerStart: parseFloat(formState.odometerValue),
                vehicleReg: formState.selectedVehicleReg,
                inspectorOrDriver: savedUser || '',
                oilAndCoolant: formState.booleanQuestions[0].value,
                fuelLevel: formState.booleanQuestions[1].value,
                seatbeltDoorsMirrors: formState.booleanQuestions[2].value,
                handbrake: formState.booleanQuestions[3].value,
                tyreCondition: formState.booleanQuestions[4].value,
                spareTyre: formState.booleanQuestions[5].value,
                numberPlate: formState.booleanQuestions[6].value,
                licenseDisc: formState.booleanQuestions[7].value,
                leaks: formState.booleanQuestions[8].value,
                lights: formState.booleanQuestions[9].value,
                defrosterAircon: formState.booleanQuestions[10].value,
                emergencyKit: formState.booleanQuestions[11].value,
                clean: formState.booleanQuestions[12].value,
                warnings: formState.booleanQuestions[13].value,
                windscreenWipers: formState.booleanQuestions[14].value,
                serviceBook: formState.booleanQuestions[15].value,
                siteKit: formState.booleanQuestions[16].value,
                photo: s3PhotoKeys,
                history: historyEntry,
            };

            const customFields = await calculateCustomFields(formState, vehicles, timestamp);

            // 1. Create the inspection first
            await client.models.Inspection.create(inspectionData);

            // 2. Update the Fleet's currentkm with the new odometer reading
            await client.models.Fleet.update({
                id: formState.selectedVehicleId,
                currentkm: parseFloat(formState.odometerValue)
            });

            // 3. Create ClickUp task
           const createTaskResponse = await Vif_clickUpService.createTask({
                vehicleId: formState.selectedVehicleId,
               inspectionNo:String(inspectionNo),
                vehicleReg: formState.selectedVehicleReg,
                vehicleVin: formState.selectedVehicleVin,
                odometer: Number(formState.odometerValue),
                username: savedUser,
                serviceRequired: String(customFields.serviceRequired),
                reviewRequired: String(customFields.reviewRequired),  
                tyreRotationRequired: String(customFields.tyreRotationRequired), 
                inspectionResults,
                timestamp,
                s3PhotoKeys,
                photoCount: formState.photos.length,
            });


        
           const taskResult = createTaskResponse;

          if (!taskResult.success) {
                throw new Error(taskResult.message || 'Failed to create task');
            }

            const taskId: string = String(taskResult.taskId);


            // Start upload progress
            setUploadProgress({
                isUploading: true,
                currentImage: 0,
                totalImages: formState.photos.length
            });

            // Upload photos one by one
            for (let i = 0; i < formState.photos.length; i++) {
                setUploadProgress(prev => ({
                    ...prev,
                    currentImage: i + 1,
                }));

                const photo = formState.photos[i];
                const uploadResult = await uploadPhoto({
                    photo: photo.file,
                    taskId
                });

                if (!uploadResult.success) {
                    throw new Error(`Failed to upload photo ${i + 1}: ${photo.file.name}`);
                }
                }


            // Upload complete
            setUploadProgress({
                isUploading: false,
                currentImage: 0,
                totalImages: 0
            });

            setMessage("Inspection submitted successfully and vehicle odometer updated");
            setShow(true);
            setSuccessful(true);

            // Reset form
            setFormState({
                selectedVehicleId: "",
                selectedVehicleReg: "",
                selectedVehicleVin: "",
                odometerValue: "",
                booleanQuestions: initialQuestions,
                photos: []
            });

        } catch (err) {
            console.error("Error submitting form:", err);
            setMessage("Failed to submit inspection: " + (err instanceof Error ? err.message : 'Unknown error'));
            setShow(true);
            setSuccessful(false);
        } finally {
            setLoadingbtn(false);
            setUploadProgress({
                isUploading: false,
                currentImage: 0,
                totalImages: 0
            });
        }
    };

    useEffect(() => {
        const subscription = client.models.Fleet.observeQuery().subscribe({
            next: ({ items: allVehicles, isSynced }) => {
                if (isSynced) {
                    const mappedCategories: vifForm[] = (allVehicles || []).map(mapApiCategoryToVehicle);
                    setvehicles(mappedCategories);
                    setLoading(false);
                }
            },
            error: (error) => {
                console.log(`Error subscribing to fleets: ${error}`);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return (

        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <Navbar />

            {loading ? (
                <Loading />
            ) : (
                <main className="flex-1 p-6 mt-20 pb-20">

                    {/* Image Upload Loader */}
                    {uploadProgress.isUploading && (
                        <ImageUploadLoader
                            currentImage={uploadProgress.currentImage}
                            totalImages={uploadProgress.totalImages}
                            message={`Uploading image ${uploadProgress.currentImage} of ${uploadProgress.totalImages}`}
                        />
                    )}
                    {show && (
                        <ResponseModal
                            successful={successful}
                            message={message}
                            setShow={setShow}
                        />
                    )}
                    <div className="max-w-4xl mx-auto">
                        <Card>
                            <CardHeader>
                                <CardTitle>Vehicle Inspection Form</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    {/* <Button onClick={handleSubmit} title="Test Submit" /> */}
                                    <form className="space-y-6 mt-2" onSubmit={handleSubmit}>
                                        <VifForm
                                            onVehicleChange={handleVehicleChange}
                                            onOdometerChange={handleOdometerChange}
                                            onBooleanQuestionsChange={handleBooleanQuestionsChange}
                                            onPhotosChange={handlePhotosChange}
                                            formState={formState}
                                            vehicles={vehicles}
                                            inspectionNumber={inspectionNumber}
                                        />
                                        <div className="flex justify-end mt-2">
                                            <Button
                                                type="submit"
                                                className="cursor-pointer"
                                                disabled={!canSubmit || loadingbtn}
                                            >
                                                {loadingbtn ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    'Submit Inspection'
                                                )}
                                            </Button>
                                        </div>
                                    </form>
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