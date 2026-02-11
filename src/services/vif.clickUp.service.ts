import * as constants from "@/app/constants";
import { normalize } from "@/utils/helper/time";

export const Vif_clickUpService = {
    async createTask(payload: {
        vehicleId: string;
        inspectionNo: string;
        vehicleReg: string;
        vehicleVin: string;
        odometer: number;
        username: string | null;
        serviceRequired: string;
        reviewRequired: string;
        tyreRotationRequired: string;
        inspectionResults: any[];
        timestamp: string;
        s3PhotoKeys: string[];
        photoCount: number;
    }) {
        // Format inspection questions
        const questionLines =
            payload.inspectionResults?.length > 0
                ? payload.inspectionResults
                    .map(
                        (item, index) =>
                            `${index + 1}. ${item.question}\nAnswer: ${item.answer === "true" ? "Yes" : "No"
                            }`
                    )
                    .join("\n\n")
                : "No inspection results provided.";

        const taskBody = {
            name: `Vehicle Inspection - ${payload.vehicleReg} ${payload.timestamp}`,
            description: `Inspection No: ${payload.inspectionNo}
Vehicle Vin: ${payload.vehicleVin}
Vehicle Reg: ${payload.vehicleReg}
Vehicle ID: ${payload.vehicleId}
Odometer: ${payload.odometer}
Username: ${payload.username}

Inspection Results:

${questionLines}`,
            custom_fields: [
                {
                    id: constants.USERNAME_FIELD_ID,
                    value: normalize(payload.username || ""),
                },
                {
                    id: constants.SERVICE_FIELD_ID,
                    value: normalize(payload.serviceRequired),
                },
                {
                    id: constants.TYRE_FIELD_ID,
                    value: normalize(payload.tyreRotationRequired),
                },
                {
                    id: constants.REVIEW_FIELD_ID,
                    value: normalize(payload.reviewRequired),
                },
            ],
            status: "to do",
        };

        const response = await fetch(`${constants.securebaseUrltest}/clickuppost`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(taskBody),
        });

        if (!response.ok) throw new Error(`Backend returned ${response.status}`);

        const data = await response.json();

        if (!data || Object.keys(data).length === 0)
            throw new Error("Backend returned no data");

        return {
            success: data.success,
            message: data.message || "Task created successfully",
            taskId: data.taskId,
            data,
        };
    },
};




export const Vif_clickUpTasksService = {
  // --- Create Vehicle Task (Service / Rotation) ---
  async createInspectionTask(payload: {
    issuetype: "service" | "rotation";
    title: string;
    servicePlanStatus?: string;
    servicePlan?: string;
    lastServiceDate?: string;
    lastServicekm?: number;
    lastRotationdate?: string;
    lastRotationkm?: number;
    vehicleReg: string;
    odometer: number;
    username: string | null;
    serviceRequired?: boolean | string;
    reviewRequired?: boolean | string;
    tyreRotationRequired?: boolean | string;
    vehicleVin: string;
  }) {
    try {
      // Build description based on type
      let description = "";

      if (payload.issuetype === "service") {
        description = `Vehicle Reg: ${payload.vehicleReg}
        Vehicle Vin: ${payload.vehicleVin}
        Service Plan Status: ${payload.servicePlanStatus}
        Service Plan: ${payload.servicePlan}
        Previous Service km: ${payload.lastServicekm}
        Previous Service Date: ${payload.lastServiceDate}
        Current Driver: ${payload.username}
        Current Km: ${payload.odometer}`;
            } else if (payload.issuetype === "rotation") {
                description = `Vehicle Reg: ${payload.vehicleReg}
        Vehicle Vin: ${payload.vehicleVin}
        Service Plan Status: ${payload.servicePlanStatus}
        Service Plan: ${payload.servicePlan}
        Previous Rotation km: ${payload.lastRotationkm}
        Previous Rotation Date: ${payload.lastRotationdate}
        Current Driver: ${payload.username}
        Current Km: ${payload.odometer}`;
      }

      const taskBody = {
        name: payload.title,
        description,
        custom_fields: [
          { id: constants.USERNAME_FIELD_ID, value: payload.username ?? "" },
          { id: constants.SERVICE_FIELD_ID, value: payload.serviceRequired },
          { id: constants.TYRE_FIELD_ID, value: payload.tyreRotationRequired },
          { id: constants.REVIEW_FIELD_ID, value: payload.reviewRequired },
        ],
        status: "to do",
      };

      const createTaskResponse = await fetch(
        `https://api.clickup.com/api/v2/list/${constants.LIST_ID}/task`,
        {
          method: "POST",
          headers: {
            Authorization: constants.API_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(taskBody),
        }
      );

      const taskData = await createTaskResponse.json();

      if (!taskData.id) {
        return { success: false, error: "Failed to create ClickUp task", details: taskData };
      }

      return { success: true, taskId: taskData.id, message: "ClickUp task created successfully", data: taskData };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // --- Update Task Description (append odometer) ---
  async updateDescription(payload: { taskId: string | number | null; odometer: number }) {
    if (!payload.taskId) return { success: false, error: "taskId is null or undefined" };

    try {
      const getTaskResponse = await fetch(
        `https://api.clickup.com/api/v2/task/${payload.taskId}`,
        { method: "GET", headers: { Authorization: constants.API_TOKEN } }
      );

      const existingTask = await getTaskResponse.json();
      const currentName = existingTask.name || "";
      const currentDescription = existingTask.description || "";
      const updatedDescription = `${currentDescription}\nCurrent Km: ${payload.odometer}`;

      await fetch(`https://api.clickup.com/api/v2/task/${payload.taskId}`, {
        method: "PUT",
        headers: { Authorization: constants.API_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ name: currentName, description: updatedDescription }),
      });

      return { success: true, message: "Task name updated successfully" };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};



export async function uploadPhoto({
  photo,
  taskId
}: {
  photo: File;
  taskId: string;
}) {
  try {
    if (!photo || !taskId) {
      return { success: false, error: "Missing required fields" };
    }

    const fileBuffer = await photo.arrayBuffer();

    const attachmentFormData = new FormData();
    attachmentFormData.append(
      "attachment",
      new Blob([fileBuffer], { type: photo.type }),
      photo.name
    );

    const uploadResponse = await fetch(
      `https://api.clickup.com/api/v2/task/${taskId}/attachment`,
      {
        method: "POST",
        headers: {
          Authorization: constants.API_TOKEN,
        },
        body: attachmentFormData,
      }
    );

    const clickUpResult = await uploadResponse.json();

    if (!clickUpResult?.id) {
      return { success: false, error: "ClickUp upload failed", data: clickUpResult };
    }

    return {
      success: true,
      message: `Uploaded ${photo.name} successfully`,
      data: { clickUp: clickUpResult },
    };
  } catch (error: any) {
    console.error("Error uploading photo:", error);
    return { success: false, error: error.message };
  }
}
