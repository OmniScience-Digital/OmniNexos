import * as constants from "@/app/constants";

export const CRM_clickUpService = {
    async updateTaskWithAttachment(payload: {
        photo: File | null;
        taskId: string;
        newExpiry?: string;
        username?: string;
        taskType?: string;
        certificateName?: string;
    }) {
        try {
            if (!payload.taskId) {
                return { success: false, error: "Missing taskId" };
            }

            // 1️⃣ Get existing task
            const getTaskResponse = await fetch(
                `https://api.clickup.com/api/v2/task/${payload.taskId}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: constants.API_TOKEN,
                    },
                }
            );

            if (!getTaskResponse.ok) throw new Error("Failed to fetch ClickUp task");

            const existingTask = await getTaskResponse.json();
            const currentDescription = existingTask.description || "";

            // 2️⃣ Build updated description
            const timestamp = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

            let updatedDescription = currentDescription + `
--- CRM UPDATE ---
📅 Certificate: ${payload.certificateName || "Unknown"}
🔄 New Expiry: ${payload.newExpiry || "No expiry"}
👤 Updated by: ${payload.username || "Unknown"}
📌 Task Type: ${payload.taskType || "N/A"}
⏰ Timestamp: ${timestamp}
`;

            // 3️⃣ Update task description & mark complete
            await fetch(`https://api.clickup.com/api/v2/task/${payload.taskId}`, {
                method: "PUT",
                headers: {
                    Authorization: constants.API_TOKEN,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: existingTask.name,
                    description: updatedDescription,
                    status: "complete",
                }),
            });

            // 4️⃣ Upload attachment if provided
            if (payload.photo) {
                const formData = new FormData();
                formData.append("attachment", payload.photo, payload.photo.name);

                const uploadResponse = await fetch(
                    `https://api.clickup.com/api/v2/task/${payload.taskId}/attachment`,
                    {
                        method: "POST",
                        headers: { Authorization: constants.API_TOKEN },
                        body: formData,
                    }
                );

                const attachmentResult = await uploadResponse.json();
                if (!attachmentResult?.id) {
                    console.warn("Attachment upload failed", attachmentResult);
                }
            }

            return { success: true, message: "CRM task updated successfully" };
        } catch (error: any) {
            console.error("CRM_clickUpService error:", error);
            return { success: false, error: error.message };
        }
    },
};
