import { client } from "@/services/schema";
import { Vif_clickUpTasksService } from "@/services/vif.clickUp.service";

export const calculateCustomFields = async (
    formState: any,
    vehicles: any[],
    timestamp: string
) => {
    const savedUser = localStorage.getItem("user");
    const vehicle = vehicles.find(v => v.id === formState.selectedVehicleId);
    if (!vehicle) throw new Error("Vehicle not found");

    const odometer = parseInt(formState.odometerValue);
    const today = new Date();
    const stringlastServiceDate = vehicle.lastServicedate;
    const lastServiceDate = new Date(vehicle.lastServicedate);



    const fleetno = vehicle.fleetNumber;
    const servicePlanStatus = vehicle.servicePlanStatus;
    const servicePlan = vehicle.servicePlan;
    const lastServicekm = vehicle.lastServicekm;

    const lastRotationdate = vehicle.lastRotationdate;;
    const lastRotationkm = vehicle.lastRotationkm;


    // --- Conditions ---
    const serviceRequired =
        odometer > (Number(vehicle.lastServicekm) + 11999) ||
        today > new Date(lastServiceDate.getTime() + (334 * 24 * 60 * 60 * 1000));

    const tyreRotationRequired =
        vehicle.lastRotationkm && odometer > (Number(vehicle.lastRotationkm) + 7000);

    const reviewRequired = formState.booleanQuestions.some((q: any) => {
        const question = q.question.toLowerCase();
        const value = q.value; // Already boolean true/false

        if (question.includes("oil and coolant")) return !value; // Should be true
        if (question.includes("full tank")) return !value; // Should be true
        if (question.includes("seatbelt")) return !value; // Should be true
        if (question.includes("handbrake")) return !value; // Should be true
        if (question.includes("tyre") && (question.includes("wear") || question.includes("tread"))) return !value; // Should be true
        if (question.includes("spare tyre")) return !value; // Should be true
        if (question.includes("number plate")) return !value; // Should be true
        if (question.includes("license disc")) return !value; // Should be true
        if (question.includes("leaks")) return value; // Should be false, so if value is true → fail
        if (question.includes("warning light")) return value; // Should be false, so if value is true → fail

        // For the lights question
        if (question.includes("headlights") || question.includes("taillights") || question.includes("fog lights") ||
            question.includes("indicators") || question.includes("hazards")) {
            return !value; // Should be true
        }

        if (question.includes("defrost") || question.includes("air condition")) return !value; // Should be true
        if (question.includes("emergency kit")) return !value; // Should be true
        if (question.includes("clean")) return !value; // Should be true
        if (question.includes("windscreen wiper")) return !value; // Should be true
        if (question.includes("service book")) return !value; // Should be true

        return false; // Questions not in the list don't trigger review
    });

    //  secondary index query - return the actual tasks data
    const getExistingTasks = async (vehicleReg: string, taskType: "service" | "rotation") => {
        const { data: existingTasks } = await client.models.TaskTable.listTaskTableByVehicleRegAndTaskType({
            vehicleReg: vehicleReg,
            taskType: { eq: taskType }
        });
        return existingTasks || [];
    };


    // --- Service Task ---
    if (serviceRequired) {

        const existingServiceTasks = await getExistingTasks(formState.selectedVehicleReg, "service");
        const taskExists = existingServiceTasks.length > 0;

        if (!taskExists) {
            const taskResult = await Vif_clickUpTasksService.createInspectionTask({
                issuetype: "service",
                title: `${fleetno} Service Due , ${timestamp}`,
                vehicleReg: formState.selectedVehicleReg,
                vehicleVin: formState.selectedVehicleVin,
                servicePlanStatus: servicePlanStatus,
                servicePlan: servicePlan,
                lastServiceDate: stringlastServiceDate,
                lastServicekm: lastServicekm,
                lastRotationdate: lastRotationdate,
                lastRotationkm: lastRotationkm,
                odometer: formState.odometerValue,
                username: savedUser,
                serviceRequired,
                reviewRequired,
                tyreRotationRequired,
            });

            if (!taskResult.success) {
                throw new Error(taskResult.error || 'Failed to create task');
            }

            if (taskResult.success && taskResult.taskId) {
                await client.models.TaskTable.create({
                    vehicleReg: formState.selectedVehicleReg,
                    taskType: "service",
                    clickupTaskId: taskResult.taskId,
                });
            }
        } else {

            await Vif_clickUpTasksService.updateDescription({
                taskId: existingServiceTasks[0].clickupTaskId,
                odometer: odometer,
            });
        }
    }

    // --- Tyre Rotation Task ---
    if (tyreRotationRequired) {

        const existingRotationTasks = await getExistingTasks(formState.selectedVehicleReg, "rotation");
        const taskExists = existingRotationTasks.length > 0;

        if (!taskExists) {
            const taskResult = await Vif_clickUpTasksService.createInspectionTask({
                issuetype: "rotation",
                title: `${fleetno} Tyre Rotation Due ,${timestamp}`,
                vehicleReg: formState.selectedVehicleReg,
                vehicleVin: formState.selectedVehicleVin,
                servicePlanStatus: servicePlanStatus,
                servicePlan: servicePlan,
                lastRotationdate: lastRotationdate,
                lastRotationkm: lastRotationkm,
                lastServicekm: lastServicekm,
                lastServiceDate: stringlastServiceDate,
                odometer: formState.odometerValue,
                username: savedUser,
                serviceRequired,
                reviewRequired,
                tyreRotationRequired,
            });

            if (!taskResult.success) {
                throw new Error(taskResult.error || 'Failed to create task');
            }

            if (taskResult.success && taskResult.taskId) {
                await client.models.TaskTable.create({
                    vehicleReg: formState.selectedVehicleReg,
                    taskType: "rotation",
                    clickupTaskId: taskResult.taskId,
                });
            }
        } else {

            await Vif_clickUpTasksService.updateDescription({
                taskId: existingRotationTasks[0].clickupTaskId,
                odometer: odometer,
            });
        }
    }

    return { serviceRequired, tyreRotationRequired, reviewRequired };
};