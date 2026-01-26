export interface Employee {
  id: string;
  employeeId: string;
  employeeNumber?: string;
  firstName: string;
  surname: string;
  knownAs?: string;
  passportNumber?: string;
  passportExpiry?: string;
  passportAttachment?: string;
  driversLicenseCode?: string;
  driversLicenseExpiry?: string;
  driversLicenseAttachment?: string;
  authorizedDriver: boolean;
  pdpExpiry?: string;
  pdpAttachment?: string;
  cvAttachment?: string;
  ppeListAttachment?: string;
  ppeExpiry?: string;
  employeeIdAttachment?: string;
  medicalCertificates?: any[];
  trainingCertificates?: any[];
  additionalCertificates?: any[];
}



export const MEDICAL_CERTIFICATE_TYPES = [
  "CLINIC_PLUS",
  "CLINIC_PLUS_INDUCTION",
  "HEARTLY_HEALTH",
  "KLIPSPRUIT_MEDICAL",
  "LUYUYO_MEDICAL",
  "KRIEL_MEDICAL",
  "PRO_HEALTH_MEDICAL",
  "WILGE_VXR",
];

export const TRAINING_CERTIFICATE_TYPES = [
  "APPOINTMENT_2_9_2",
  "FIREFIGHTING",
  "FIRST_AID_LEVEL_1",
  "FIRST_AID_LEVEL_2",
  "HIRA_TRAINING",
  "LEGAL_LIABILITY",
  "MHSA",
  "OHS_ACT",
  "OEM_CERT",
  "SATS_CONVEYOR",
  "SATS_COP_SOP",
  "SATS_ILOT",
  "WORKING_AT_HEIGHTS",
  "WORKING_WITH_HAND_TOOLS",
  "WORKING_WITH_POWER_TOOLS",
];