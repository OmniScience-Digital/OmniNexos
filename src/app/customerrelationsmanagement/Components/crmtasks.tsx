import { client } from "@/services/schema";
import { getUrl } from "aws-amplify/storage";

export const handleCrmTasks = async (
    newExpiry: string,
    existingTask: {
        employeeId: string;
        employeeName: string;
        taskType: string;
        documentType: string;
        documentIdentifier: string;
        clickupTaskId: any;
        readonly id: string;
        readonly createdAt: string;
        readonly updatedAt: string;
    },
    doc: {
        key: string;
        type: string;
        attachment: any;
    }
) => {
    const savedUser = localStorage.getItem("user")?.replace(/^"|"$/g, '').trim() || "Unknown User";

    try {
        console.log('handleCrmTasks called with:', { newExpiry, existingTask, doc, savedUser });

        // Check if we have an attachment to upload
        let fileBlob: Blob | null = null;
        let filename: string = '';

        if (doc.attachment && doc.attachment.trim() !== '') {
            try {
                // Get the actual file from Amplify Storage
                const { url: fileUrl } = await getUrl({
                    path: doc.attachment
                });

                // Download the file
                const fileResponse = await fetch(fileUrl.toString());
                fileBlob = await fileResponse.blob();
                
                // Get filename
                filename = doc.attachment.split('/').pop() || 'document.pdf';
                console.log('File ready for upload:', filename);
            } catch (fileError) {
                console.warn('Could not fetch file, will update task without attachment:', fileError);
            }
        }

        // Create FormData
        const formData = new FormData();
        
        // Add file if available
        if (fileBlob) {
            formData.append("photo", fileBlob, filename);
        }
        
        // Add other required fields
        formData.append("taskId", existingTask.clickupTaskId);
        formData.append("newExpiry", newExpiry);
        formData.append("savedUser", savedUser);
        formData.append("taskType", existingTask.taskType); // Add task type for description
        formData.append("certificateName", doc.type.replace('additional_', '')); // Remove prefix

        // Call the API with FormData
        const response = await fetch("/api/updatecrm-description", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Task update successful:', result);

        // Only delete the task from our database if update was successful
        if (result.success) {
            await client.models.EmployeeTaskTable.delete({ id: existingTask.id });
            console.log('Task removed from local database');
        }

    } catch (error) {
        console.error('Error in handleCrmTasks:', error);
    }
};