import { getUrl } from "@aws-amplify/storage";


export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/) 
    .map(word => word[0].toUpperCase())
    .join('');
}

  export  const viewDoc = async (s3Key: string) => {
        if (!s3Key) return;
        const result = await getUrl({ path: s3Key });
        window.open(result.url.href, '_blank');
    }
