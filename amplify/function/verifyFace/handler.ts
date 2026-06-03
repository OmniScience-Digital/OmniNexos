// amplify/function/verifyFace/handler.ts
// Compares a live clock-in selfie against the employee's reference photo
// using AWS Rekognition CompareFaces.
//
// Input:
//   userId        — Cognito sub, used to locate reference photo in S3
//   selfieKey     — S3 key of the live selfie uploaded by the mobile app
//
// Output:
//   verified      — true if similarity >= threshold
//   similarity    — 0-100 score from Rekognition
//   reason        — human-readable result message

import {
  RekognitionClient,
  CompareFacesCommand,
  CompareFacesCommandInput,
} from "@aws-sdk/client-rekognition";

declare const process: {
  env: {
    AWS_REGION?: string;
    STORAGE_BUCKET_NAME: string;
  };
};

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const BUCKET = process.env.STORAGE_BUCKET_NAME!;
const THRESHOLD = 80; // minimum similarity % to accept

const referenceKey = (userId: string) =>
  `hr/reference-faces/${userId}/profile.jpg`;

interface VerifyFaceEvent {
  userId: string;
  selfieKey: string;
}

export const handler = async (event: any) => {
  console.log("EVENT:", JSON.stringify(event, null, 2));

  const body = JSON.parse(event.body);
  const { userId, selfieKey } = body;

  console.log("userId:", userId);
  console.log("selfieKey:", selfieKey);

  if (!userId || !selfieKey) {
    return {
      verified: false,
      similarity: 0,
      reason: "Missing userId or selfieKey",
    };
  }

  const params: CompareFacesCommandInput = {
    SourceImage: {
      S3Object: { Bucket: BUCKET, Name: referenceKey(userId) },
    },
    TargetImage: {
      S3Object: { Bucket: BUCKET, Name: selfieKey },
    },
    SimilarityThreshold: THRESHOLD,
  };

  try {
    const response = await rekognition.send(new CompareFacesCommand(params));
    const matches = response.FaceMatches ?? [];

    if (matches.length === 0) {
      return {
        verified: false,
        similarity: 0,
        reason: "No face match found",
      };
    }

    const similarity = matches[0].Similarity ?? 0;
    const verified = similarity >= THRESHOLD;

    return {
      verified,
      similarity: Math.round(similarity * 100) / 100,
      reason: verified
        ? `Face verified (${similarity.toFixed(0)}% match)`
        : `Similarity too low (${similarity.toFixed(0)}% — minimum ${THRESHOLD}%)`,
    };
  } catch (error: any) {
    // InvalidParameterException means no face detected in one of the images
    if (error?.name === "InvalidParameterException") {
      return {
        verified: false,
        similarity: 0,
        reason:
          "No face detected in the image. Please retake in good lighting.",
      };
    }
    console.error("Rekognition error:", error);
    return {
      verified: false,
      similarity: 0,
      reason: "Verification service error. Record flagged for review.",
    };
  }
};
