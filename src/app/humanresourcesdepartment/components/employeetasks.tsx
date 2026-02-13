import { HRD_clickUpService } from "@/services/hrd.clickUp.service";
import { client } from "@/services/schema";
import { getUrl } from "aws-amplify/storage";

export const handleEmployeeTasks = async (
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
    },username:string
) => {


    try {
  
        // Get the actual file from Amplify Storage
        const { url: fileUrl } = await getUrl({
            path: doc.attachment
        });

        // Download the file
        const fileResponse = await fetch(fileUrl.toString());
        const fileBlob = await fileResponse.blob();

        // Get filename
        const filename = doc.attachment.split('/').pop() || 'document.pdf';

        // Create FormData EXACTLY like your working approach
        const formData = new FormData();
        formData.append("photo", fileBlob, filename); // Use "photo" field
        formData.append("taskId", existingTask.clickupTaskId);
        formData.append("newExpiry", newExpiry);
        formData.append("savedUser", username);




        const file = new File([fileBlob], doc.attachment.split('/').pop() || 'document.pdf', { type: fileBlob.type });

        // Then call the service
        await HRD_clickUpService.updateTaskWithAttachment({
            photo: file,
            taskId: existingTask.clickupTaskId,
            newExpiry,
            username: username,
        });

        await client.models.EmployeeTaskTable.delete({ id: existingTask.id }).catch(console.error);

    } catch (error) {
        console.log('Error in handleEmployeeTasks:', error)
    }
};