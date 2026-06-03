// amplify/function/verifyFace/handler.ts
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

const BUCKET    = process.env.STORAGE_BUCKET_NAME!;
const THRESHOLD = 80;

const referenceKey = (userId: string) =>
  `hr/reference-faces/${userId}/profile.jpg`;

// ── API Gateway response wrapper ──────────────────────────────────────────────
const respond = (data: object, statusCode = 200) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  },
  body: JSON.stringify(data),
});

// ── Handler ───────────────────────────────────────────────────────────────────
export const handler = async (event: any) => {
  console.log("EVENT:", JSON.stringify(event, null, 2));

  // Parse body — API Gateway passes body as a string
  const body = typeof event.body === "string"
    ? JSON.parse(event.body)
    : event.body ?? {};

  const { userId, selfieKey } = body;

  console.log("userId:", userId);
  console.log("selfieKey:", selfieKey);

  if (!userId || !selfieKey) {
    return respond({ verified: false, similarity: 0, reason: "Missing userId or selfieKey" }, 400);
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
    const response  = await rekognition.send(new CompareFacesCommand(params));
    const matches   = response.FaceMatches ?? [];

    if (matches.length === 0) {
      return respond({ verified: false, similarity: 0, reason: "No face match found" });
    }

    const similarity = matches[0].Similarity ?? 0;
    const verified   = similarity >= THRESHOLD;

    console.log("similarity:", similarity, "verified:", verified);

    return respond({
      verified,
      similarity: Math.round(similarity * 100) / 100,
      reason: verified
        ? `Face verified (${similarity.toFixed(0)}% match)`
        : `Similarity too low (${similarity.toFixed(0)}% — minimum ${THRESHOLD}%)`,
    });

  } catch (error: any) {
    console.error("Rekognition error:", error);

    if (error?.name === "InvalidParameterException") {
      return respond({
        verified:   false,
        similarity: 0,
        reason:     "No face detected in the image. Please retake in good lighting.",
      });
    }

    return respond({
      verified:   false,
      similarity: 0,
      reason:     "Verification service error. Record flagged for review.",
    });
  }
};