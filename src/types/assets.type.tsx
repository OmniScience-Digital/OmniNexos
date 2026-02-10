// types/ims.types.ts
export interface Asset {
  id: string;
  assetName: string;
  assetPlant?: string;
  scaleTag?: string;
  scaleOEM?: string;
  beltwidth?: string;
  troughAngle?: string;
  scaleModel?: string;
  weighIdlerQTY?: string;
  approachIdlerQTY?: string;
  retreatIdlerQTY?: string;
  centerRollSize?: string;
  wingRollSize?: string;
  loadcellType?: string;
  loadcellQTY?: string;
  loadcellSize?: string;
  integratorOEM?: string;
  integratorModel?: string;
  ssrOEM?: string;
  ssrModel?: string;
  scaledatasheetAttach?: string;
  submittedmaintplanAttach?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

