import * as constants from "@/app/constants";

export const HRD_clickUpService = {
    async updateTaskWithAttachment(payload: {
        photo: File;
        taskId: string;
        newExpiry?: string;
        username?: string | null;
        
    }) {
        try {
            if (!payload.photo || !payload.taskId) {
                return { success: false, error: "Missing required fields" };
            }

            // -------------------------
            // 1️⃣ GET EXISTING TASK
            // -------------------------
            const getTaskResponse = await fetch(
                `https://api.clickup.com/api/v2/task/${payload.taskId}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: constants.API_TOKEN,
                    },
                }
            );

            const existingTask = await getTaskResponse.json();
            const currentName = existingTask.name || "";
            const currentDescription = existingTask.description || "";

            // -------------------------
            // 2️⃣ UPDATE DESCRIPTION
            // -------------------------
            let updatedDescription = currentDescription;

            if (payload.newExpiry) {
                updatedDescription = `${currentDescription}
                Updated Expiry: ${payload.newExpiry}
                Updated by ${payload.username}`;
            }

            await fetch(
                `https://api.clickup.com/api/v2/task/${payload.taskId}`,
                {
                    method: "PUT",
                    headers: {
                        Authorization: constants.API_TOKEN,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        name: currentName,
                        description: updatedDescription,
                        status: "complete",
                    }),
                }
            );

            // -------------------------
            // 3️⃣ UPLOAD ATTACHMENT
            // -------------------------
            const fileBuffer = await payload.photo.arrayBuffer();

            const attachmentFormData = new FormData();
            attachmentFormData.append(
                "attachment",
                new Blob([fileBuffer], { type: payload.photo.type }),
                payload.photo.name
            );

            const uploadResponse = await fetch(
                `https://api.clickup.com/api/v2/task/${payload.taskId}/attachment`,
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
                message: `Updated task and uploaded ${payload.photo.name}`,
                data: clickUpResult,
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },
};
