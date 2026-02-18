
export interface CustomerSiteState {
    // Site Information
    siteName: string;
    siteLocation: string;
    siteDistance: string;
    siteTolls: string;

    // Customer Company Information
    customerName: string;
    registrationNo: string;
    vatNo: string;
    vendorNumber: string;
    postalAddress: string;
    physicalAddress: string;

    // Contact Information
    siteContactName: string;
    siteContactMail: string;
    siteContactNumber: string;

    siteManagerName: string;
    siteManagerMail: string;
    siteManagerNumber: string;

    siteSafetyName: string,
    siteSafetyMail: string,
    siteSafetyNumber: string,

    siteProcurementName: string;
    siteProcurementMail: string;
    siteProcurementNumber: string;

    siteCreditorsName: string;
    siteCreditorsMail: string;
    siteCreditorsNumber: string;

    comment: string;
}

export interface ComplianceAdditionals {
    id?: string;
    complianceid?: string;
    name?: string;
    expirey?: string;
    requirementDoc?: string;
    critical?: string;
    createdAt?: string;
    updatedAt?: string;
}
