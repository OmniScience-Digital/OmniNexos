import { client } from "@/services/schema";

interface formSaveProps {
    result: Record<string, Record<string, {
        value: number;
        isWithdrawal: boolean;
    }>>
}

// export const formSave = async ({ result }: formSaveProps) => {
//     try {

//         for (const [componentName, subComponents] of Object.entries(result)) {
//       // 1️ Save Component
//       const { data: comp } = await client.models.Component.create({
//         name: componentName,
//       });
//        if (!comp?.id) continue;

//        console.log(componentName);
//        // 2️ Save SubComponents
//       for (const [key, { value, isWithdrawal }] of Object.entries(subComponents)) {
//         await client.models.SubComponent.create({
//           key,
//           value,
//           isWithdrawal,
//           componentId: comp.id, // foreign key
//         });
//     }
//     }

//     } catch (error) {
//          console.error("Error saving form:", error);
//         throw error;

//     }
// }



//query it back 

// const { data: components } = await client.models.Component.list({
//   include: ["subComponents"],
// });

// const result = components.reduce((acc, comp) => {
//   acc[comp.name] = comp.subComponents?.reduce((subAcc, sub) => {
//     subAcc[sub.key] = {
//       value: sub.value,
//       isWithdrawal: sub.isWithdrawal,
//     };
//     return subAcc;
//   }, {} as Record<string, { value: number; isWithdrawal: boolean }>);
//   return acc;
// }, {} as Record<string, Record<string, { value: number; isWithdrawal: boolean }>>);

// console.log(result);
