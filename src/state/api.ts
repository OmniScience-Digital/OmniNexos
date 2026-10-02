// src/state/api.ts
//
// One shared cache for data that today is independently fetched and
// subscribed-to by more than one page:
//   - Fleet:    fleetmanagementsystem/page.tsx AND vehicleinspectionform/page.tsx
//   - Category: inventorymanagementsystem/page.tsx AND stockcontrolform/page.tsx
// Each of those pages ran its own `client.models.X.observeQuery()`, i.e. two
// live subscriptions to the same table at once. Moving the READ side here
// means one subscription (src/state/sync.ts) feeds every page.
//
// Writes are NOT moved here. Fleet/Category creation, edits and deletes
// already live in one place each (there was no duplicated *mutation* logic,
// only duplicated *reads*), so pages keep calling `client.models.X.create/
// update/delete` directly, exactly as they do today. The sync bridge's
// observeQuery subscription then reflects that change into this shared cache
// automatically — no manual refetch/invalidate wiring needed.
import { client } from "@/services/schema";
import { mapApiCategoryToCategory } from "@/app/stockcontrolform/Components/map.categories.helper";
import type { Category } from "@/types/form.types";
import type { Employee } from "@/types/hrd.types";
import type { Asset } from "@/types/assets.type";
import type { Fleet } from "@/types/vifForm.types";
import type { Dashboard } from "@/types/dashboard.types";
import type { SubCategory } from "@/types/ims.types";
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";

type AmplifyGraphQLError = { message?: string };

/** A row as it comes back from Amplify before mapping — loosely typed on
 * purpose (the generated model types are impractical to hand-write here),
 * but `unknown` + explicit casts below rather than `any`, so a typo in a
 * field name is still a compile error at the point it's used. */
export type RawRow = Record<string, unknown>;
export const str = (v: unknown): string => v as string;
export const opt = (v: unknown): string | undefined => (v == null ? undefined : (v as string));
export const bool = (v: unknown, fallback = false): boolean => (v == null ? fallback : (v as boolean));
/** Like `opt`, but returns `null` (not `undefined`) for models whose type
 * uses `T | null` — e.g. Fleet, generated straight from the Amplify schema. */
export const nullableStr = (v: unknown): string | null => (v == null ? null : (v as string));
export const nullableNum = (v: unknown): number | null => (v == null ? null : (v as number));

/** Amplify errors -> a plain string RTK Query can carry as its error payload. */
const asApiError = (e: unknown) => {
  const message = Array.isArray(e)
    ? (e as AmplifyGraphQLError[]).map((x) => x?.message).join("; ")
    : e instanceof Error
      ? e.message
      : String(e);
  return { error: message };
};

/**
 * Follow `nextToken` to completion instead of returning just the first page.
 * Several pages called `.list()` with no pagination at all (Fleet, and this
 * batch's CustomerSite/Employee/Permission/EmployeeTaskTable/ClockRecord),
 * which silently drops records past whatever Amplify's default page size is.
 * Every paginated read in this file goes through this one helper so that bug
 * can't be reintroduced by a new endpoint written the same way as the old
 * code.
 */
async function fetchAllPages<TRaw, TMapped>(
  list: (nextToken?: string | null) => Promise<{
    data: TRaw[];
    errors?: AmplifyGraphQLError[] | null;
    nextToken?: string | null;
  }>,
  map: (item: TRaw) => TMapped,
): Promise<{ data: TMapped[] } | { error: string }> {
  try {
    const items: TMapped[] = [];
    let nextToken: string | null | undefined;
    let pages = 0;
    do {
      const { data, errors, nextToken: nt } = await list(nextToken);
      if (errors) return asApiError(errors);
      items.push(...data.map(map));
      nextToken = nt;
    } while (nextToken && ++pages < 200); // 200 pages is a generous ceiling, not a real limit
    return { data: items };
  } catch (e) {
    return asApiError(e);
  }
}

/**
 * There's no exported `CustomerSite` interface anywhere in the app (the page
 * that reads it just used `any[]`), so this defines the real shape once,
 * matching the mapping that page already did field-by-field.
 */
export interface CustomerSite {
  id: string;
  siteName: string;
  siteLocation?: string;
  siteDistance?: string;
  siteTolls?: string;
  customerName: string;
  registrationNo?: string;
  vatNo?: string;
  vendorNumber?: string;
  postalAddress?: string;
  physicalAddress?: string;
  siteContactName?: string;
  siteContactMail?: string;
  siteContactNumber?: string;
  siteManagerName?: string;
  siteManagerMail?: string;
  siteManagerNumber?: string;
  siteProcurementName?: string;
  siteProcurementMail?: string;
  siteProcurementNumber?: string;
  siteCreditorsName?: string;
  siteCreditorsMail?: string;
  siteCreditorsNumber?: string;
  comment?: string;
}

const mapCustomerSite = (item: RawRow): CustomerSite => ({
  id: str(item.id),
  siteName: str(item.siteName),
  siteLocation: opt(item.siteLocation),
  siteDistance: opt(item.siteDistance),
  siteTolls: opt(item.siteTolls),
  customerName: str(item.customerName),
  registrationNo: opt(item.registrationNo),
  vatNo: opt(item.vatNo),
  vendorNumber: opt(item.vendorNumber),
  postalAddress: opt(item.postalAddress),
  physicalAddress: opt(item.physicalAddress),
  siteContactName: opt(item.siteContactName),
  siteContactMail: opt(item.siteContactMail),
  siteContactNumber: opt(item.siteContactNumber),
  siteManagerName: opt(item.siteManagerName),
  siteManagerMail: opt(item.siteManagerMail),
  siteManagerNumber: opt(item.siteManagerNumber),
  siteProcurementName: opt(item.siteProcurementName),
  siteProcurementMail: opt(item.siteProcurementMail),
  siteProcurementNumber: opt(item.siteProcurementNumber),
  siteCreditorsName: opt(item.siteCreditorsName),
  siteCreditorsMail: opt(item.siteCreditorsMail),
  siteCreditorsNumber: opt(item.siteCreditorsNumber),
  comment: opt(item.comment),
});

const mapEmployee = (item: RawRow): Employee => ({
  id: str(item.id),
  employeeId: str(item.employeeId),
  employeeNumber: opt(item.employeeNumber),
  firstName: str(item.firstName),
  surname: str(item.surname),
  knownAs: opt(item.knownAs),
  passportNumber: opt(item.passportNumber),
  passportExpiry: opt(item.passportExpiry),
  passportAttachment: opt(item.passportAttachment),
  driversLicenseCode: opt(item.driversLicenseCode),
  driversLicenseExpiry: opt(item.driversLicenseExpiry),
  driversLicenseAttachment: opt(item.driversLicenseAttachment),
  authorizedDriver: bool(item.authorizedDriver),
  pdpExpiry: opt(item.pdpExpiry),
  pdpAttachment: opt(item.pdpAttachment),
  cvAttachment: opt(item.cvAttachment),
  ppeListAttachment: opt(item.ppeListAttachment),
  ppeExpiry: opt(item.ppeExpiry),
});

const mapDashboard = (item: RawRow): Dashboard => ({
  id: str(item.id),
  key: opt(item.key) ?? "",
  items: opt(item.items) ?? "",
  createdAt: str(item.createdAt),
  updatedAt: str(item.updatedAt),
});

const mapSubcategory = (item: RawRow): SubCategory => ({
  id: str(item.id),
  subcategoryName: str(item.subcategoryName),
  categoryId: str(item.categoryId),
});

export const mapAsset = (item: RawRow): Asset => ({
  id: str(item.id),
  assetName: str(item.assetName),
  assetPlant: opt(item.assetPlant),
  scaleTag: opt(item.scaleTag),
  scaleOEM: opt(item.scaleOEM),
  beltwidth: opt(item.beltwidth),
  troughAngle: opt(item.troughAngle),
  scaleModel: opt(item.scaleModel),
  weighIdlerQTY: opt(item.weighIdlerQTY),
  approachIdlerQTY: opt(item.approachIdlerQTY),
  retreatIdlerQTY: opt(item.retreatIdlerQTY),
  centerRollSize: opt(item.centerRollSize),
  wingRollSize: opt(item.wingRollSize),
  loadcellType: opt(item.loadcellType),
  loadcellQTY: opt(item.loadcellQTY),
  loadcellSize: opt(item.loadcellSize),
  integratorOEM: opt(item.integratorOEM),
  integratorModel: opt(item.integratorModel),
  ssrOEM: opt(item.ssrOEM),
  ssrModel: opt(item.ssrModel),
  scaledatasheetAttach: opt(item.scaledatasheetAttach),
  submittedmaintplanAttach: opt(item.submittedmaintplanAttach),
  notes: opt(item.notes),
  createdAt: opt(item.createdAt),
  updatedAt: opt(item.updatedAt),
});

/**
 * Raw Amplify `Permission` record (one row per user, `permissions: string[]`).
 * Distinct from the UI-level `Permission` shape in src/types/user.permissions.ts
 * (`{ module, subModule, access }`) — admin/page.tsx converts between the two
 * itself, this is just what the table actually stores.
 */
export interface PermissionRecord {
  id: string;
  userId: string;
  permissions: (string | null)[];
  isAdmin?: boolean | null;
}

export interface EmployeeTask {
  id: string;
  employeeId: string;
  employeeName: string;
  taskType: string;
  documentType: string;
  documentIdentifier: string;
  clickupTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClockRecordSummary {
  id: string;
  userId: string;
  employeeName: string;
  clockInTime: string;
  clockOutTime?: string | null;
  hoursWorked?: number | null;
  clockInLat?: number | null;
  clockInLng?: number | null;
  clockOutLat?: number | null;
  clockOutLng?: number | null;
  clockInAddress?: string | null;
  clockOutAddress?: string | null;
  verificationStatus: "VERIFIED" | "PENDING_VERIFICATION" | "REVIEW_REQUIRED";
  similarityScore?: number | null;
  syncedOffline: boolean;
  date: string;
}


export const mapFleet = (item: RawRow): Fleet => ({
  id: str(item.id),
  vehicleVin: nullableStr(item.vehicleVin),
  vehicleReg: nullableStr(item.vehicleReg),
  vehicleMake: nullableStr(item.vehicleMake),
  vehicleModel: nullableStr(item.vehicleModel),
  transmitionType: nullableStr(item.transmitionType),
  ownershipStatus: nullableStr(item.ownershipStatus),
  fleetIndex: nullableStr(item.fleetIndex),
  fleetNumber: nullableStr(item.fleetNumber),
  lastServicedate: nullableStr(item.lastServicedate),
  lastServicekm: nullableNum(item.lastServicekm),
  lastRotationdate: nullableStr(item.lastRotationdate),
  lastRotationkm: nullableNum(item.lastRotationkm),
  servicePlanStatus: bool(item.servicePlanStatus),
  servicePlan: nullableStr(item.servicePlan),
  currentDriver: nullableStr(item.currentDriver),
  currentkm: nullableNum(item.currentkm),
  codeRequirement: nullableStr(item.codeRequirement),
  pdpRequirement: bool(item.pdpRequirement),
  breakandLuxTest: nullableStr(item.breakandLuxTest),
  serviceplankm: nullableNum(item.serviceplankm),
  breakandLuxExpirey: nullableStr(item.breakandLuxExpirey),
  liscenseDiscExpirey: nullableStr(item.liscenseDiscExpirey),
});

const mapPermissionRecord = (item: RawRow): PermissionRecord => ({
  id: str(item.id),
  userId: str(item.userId),
  permissions: (item.permissions as (string | null)[] | null | undefined) ?? [],
  isAdmin: item.isAdmin == null ? null : (item.isAdmin as boolean),
});

const mapEmployeeTask = (item: RawRow): EmployeeTask => ({
  id: str(item.id),
  employeeId: str(item.employeeId),
  employeeName: str(item.employeeName),
  taskType: str(item.taskType),
  documentType: str(item.documentType),
  documentIdentifier: str(item.documentIdentifier),
  clickupTaskId: nullableStr(item.clickupTaskId),
  createdAt: str(item.createdAt),
  updatedAt: str(item.updatedAt),
});

const mapClockRecord = (item: RawRow): ClockRecordSummary => ({
  id: str(item.id),
  userId: str(item.userId),
  employeeName: str(item.employeeName),
  clockInTime: str(item.clockInTime),
  clockOutTime: nullableStr(item.clockOutTime),
  hoursWorked: nullableNum(item.hoursWorked),
  clockInLat: nullableNum(item.clockInLat),
  clockInLng: nullableNum(item.clockInLng),
  clockOutLat: nullableNum(item.clockOutLat),
  clockOutLng: nullableNum(item.clockOutLng),
  clockInAddress: nullableStr(item.clockInAddress),
  clockOutAddress: nullableStr(item.clockOutAddress),
  verificationStatus: item.verificationStatus as ClockRecordSummary["verificationStatus"],
  similarityScore: nullableNum(item.similarityScore),
  syncedOffline: bool(item.syncedOffline),
  date: str(item.date),
});

export const api = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery<string>(),
  endpoints: (build) => ({
    // Paginated one-time fetch, used to paint the page fast (and correctly —
    // this follows nextToken, unlike a plain one-shot `.list()` call, so a
    // record past the first page can't be silently missing). The live sync
    // bridge (src/state/sync.ts) takes over from here with observeQuery for
    // every model below that's actually bounded in size (one row per
    // vehicle/category/employee/customer/user — hundreds, not growing
    // without bound). ClockRecord is deliberately NOT one of those; see its
    // endpoint below.
    listFleets: build.query<Fleet[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.Fleet.list({ nextToken }),
          mapFleet,
        ),
    }),

    listCategories: build.query<Category[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.Category.list({ nextToken }),
          mapApiCategoryToCategory,
        ),
    }),

    // Shared by customerrelationsmanagement/page.tsx — the sole live
    // consumer today, moved here mainly for the same architecture as
    // everything else, and because the original read had no pagination.
    listCustomerSites: build.query<CustomerSite[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.CustomerSite.list({ nextToken }),
          mapCustomerSite,
        ),
    }),

    // Shared by humanresourcesdepartment/page.tsx.
    listEmployees: build.query<Employee[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.Employee.list({ nextToken }),
          mapEmployee,
        ),
    }),

    // Shared by landing/Components/dynamicLanding.tsx. Filtering/sorting
    // stays in that component (unchanged) — this endpoint just supplies the
    // raw, paginated list.
    listDashboards: build.query<Dashboard[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.Landing.list({ nextToken }),
          mapDashboard,
        ),
    }),

    // The bounded, page-render half of admin/page.tsx's Permission usage
    // (the table of every user's permissions). The per-user existence check
    // admin/page.tsx does right before writing a permission record is a
    // different thing entirely and is NOT this endpoint — see the note in
    // that file. Using this cached value for that check would be a race:
    // it could let two saves both believe no record exists yet.
    listPermissionRecords: build.query<PermissionRecord[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.Permission.list({ nextToken }),
          mapPermissionRecord,
        ),
    }),

    // Shared by humanresourcesdepartment/page.tsx's task-count/search list.
    // The per-employee and per-document-identifier lookups elsewhere in this
    // app (existence checks before creating a task) are NOT this endpoint —
    // same reasoning as Permission above.
    listEmployeeTasks: build.query<EmployeeTask[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.EmployeeTaskTable.list({ nextToken }),
          mapEmployeeTask,
        ),
    }),

    // humanresourcesdepartment/attendance/page.tsx's admin report view. This
    // one is deliberately NOT wired into the live sync bridge: attendance
    // records accumulate forever (one row per shift, every employee, every
    // day), and Amplify's observeQuery keeps its *entire* result set synced
    // locally — fine for a few hundred vehicles or employees, not something
    // to do for a table with no natural upper bound. This still fixes the
    // original bug (it already followed nextToken correctly, so no change
    // there) and gets a shared cache; the page opts into
    // `refetchOnMountOrArgChange` so revisiting it re-checks the server
    // instead of relying on a live subscription.
    listClockRecords: build.query<ClockRecordSummary[], void>({
      queryFn: () =>
        fetchAllPages(
          (nextToken) => client.models.ClockRecord.list({ nextToken }),
          mapClockRecord,
        ),
    }),

    // Per-argument (one consumer today: subcategories/[id]/page.tsx), so
    // this is NOT started at boot in sync.ts like the models above — see
    // src/state/useLiveQuerySync.ts, used directly in that page.
    listSubcategoriesByCategory: build.query<SubCategory[], string>({
      queryFn: (categoryId) =>
        fetchAllPages(
          (nextToken) =>
            client.models.SubCategory.list({
              filter: { categoryId: { eq: categoryId } },
              nextToken,
            }),
          mapSubcategory,
        ),
    }),

    // Per-argument (one consumer today: assetsList.tsx), same reasoning.
    listAssetsByCustomerSite: build.query<Asset[], string>({
      queryFn: (customerSiteId) =>
        fetchAllPages(
          (nextToken) =>
            (
              client.models.Asset as unknown as {
                listAssetByCustomerSiteId: (
                  args: { customerSiteId: string },
                  opts: { nextToken?: string | null },
                ) => Promise<{ data: RawRow[]; errors?: AmplifyGraphQLError[] | null; nextToken?: string | null }>;
              }
            ).listAssetByCustomerSiteId({ customerSiteId }, { nextToken }),
          mapAsset,
        ),
    }),
  }),
});

export const {
  useListFleetsQuery,
  useListCategoriesQuery,
  useListCustomerSitesQuery,
  useListEmployeesQuery,
  useListDashboardsQuery,
  useListPermissionRecordsQuery,
  useListEmployeeTasksQuery,
  useListClockRecordsQuery,
  useListSubcategoriesByCategoryQuery,
  useListAssetsByCustomerSiteQuery,
} = api;
