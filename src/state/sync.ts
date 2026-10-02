// src/state/sync.ts
//
// The one live subscription per model, shared by every page that reads it —
// for every model that is (a) bounded in size (one row per vehicle,
// category, employee, customer site, or user — hundreds, not an ever-growing
// log) and (b) was already using `observeQuery` somewhere before this
// change, or was flagged as going stale without one (Permission/admin).
//
// This replaces the pattern of each page running its own
// `client.models.X.observeQuery()`. Amplify's observeQuery already keeps its
// full result set live and in sync (the same mechanism every page relied on
// before), so this bridge's only job is to push each emission into the
// shared RTK Query cache with `upsertQueryData` — no polling, no manual
// refetch, no AppState/NetInfo wiring like the mobile app needed (Amplify's
// own sync engine handles reconnects here).
//
// What's deliberately NOT here:
//  - ClockRecord: unbounded (grows every shift, every employee, forever).
//    Syncing that whole table live doesn't scale. See listClockRecords in
//    api.ts for how that page stays fresh instead.
//  - Permission: bounded, but its one consumer (admin/page.tsx) copies the
//    read into locally-editable state (an admin toggles checkboxes before
//    clicking Save) and deliberately does NOT re-seed that state when new
//    data arrives, to avoid silently discarding an admin's in-progress,
//    unsaved edits. A live subscription with nothing safe to do with its
//    updates is pure overhead paid by every session, not just admins'. That
//    page instead re-reads on mount / when the user list changes, the same
//    trigger as before — now correctly paginated, which it wasn't.
//  - SubCategory-by-category, Asset-by-customerSite: per-argument queries
//    with a single consumer each. See useLiveQuerySync.ts, used directly in
//    those pages, not started globally here.
//  - Compliance, ComplianceAdditionals, EmployeeAdditionalList,
//    EmployeeTaskTable's per-employee/per-document lookups, Permission's
//    per-user existence check: these are read right before a write to
//    decide create-vs-update, not page renders. Caching them would let two
//    saves both see "nothing exists yet" and create a duplicate record.
import { client } from "@/services/schema";
import { mapApiCategoryToCategory } from "@/app/stockcontrolform/Components/map.categories.helper";
import type { Category } from "@/types/form.types";
import type { Fleet } from "@/types/vifForm.types";
import { api, mapFleet, opt, str, bool, type CustomerSite, type RawRow } from "./api";
import type { AppDispatch } from "./store";

type Observer<TRaw> = { next: (result: { items: TRaw[]; isSynced: boolean }) => void; error: (e: unknown) => void };
type Observable<TRaw> = { subscribe: (observer: Observer<TRaw>) => { unsubscribe(): void } };

/** Subscribe once, push every synced emission into one cache entry. */
function syncModel<TRaw extends RawRow, TMapped>(
  observe: () => Observable<TRaw>,
  cacheKey: Parameters<typeof api.util.upsertQueryData>[0],
  map: (item: TRaw) => TMapped,
  dispatch: AppDispatch,
  options: { gateOnSynced?: boolean } = {},
) {
  const gate = options.gateOnSynced ?? true;
  return observe().subscribe({
    next: ({ items, isSynced }) => {
      if (gate && !isSynced) return;
      dispatch(api.util.upsertQueryData(cacheKey, undefined as never, (items || []).map(map) as never));
    },
    error: (error: unknown) => {
      console.error(`[sync] ${String(cacheKey)} subscription error:`, error);
    },
  });
}

export function startDataSync(dispatch: AppDispatch): () => void {
  const subs = [
    syncModel<RawRow, Fleet>(
      () => client.models.Fleet.observeQuery(),
      "listFleets",
      mapFleet,
      dispatch,
    ),
    syncModel<RawRow, Category>(
      () => client.models.Category.observeQuery(),
      "listCategories",
      mapApiCategoryToCategory,
      dispatch,
    ),
    syncModel<RawRow, CustomerSite>(
      () => client.models.CustomerSite.observeQuery(),
      "listCustomerSites",
      mapCustomerSiteForSync,
      dispatch,
    ),
    syncModel<RawRow, ReturnType<typeof mapEmployeeForSync>>(
      () => client.models.Employee.observeQuery(),
      "listEmployees",
      mapEmployeeForSync,
      dispatch,
    ),
    // Landing: the original page pushed every emission (not gated on
    // isSynced), so this preserves that instead of introducing a brief
    // "shows nothing until fully synced" change in behaviour.
    syncModel<RawRow, { id: string; key: string; items: string }>(
      () => client.models.Landing.observeQuery(),
      "listDashboards",
      (item) => ({ id: str(item.id), key: opt(item.key) ?? "", items: opt(item.items) ?? "" }),
      dispatch,
      { gateOnSynced: false },
    ),
  ];

  return () => subs.forEach((s) => s.unsubscribe());
}

function mapCustomerSiteForSync(item: RawRow): CustomerSite {
  return {
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
  };
}

function mapEmployeeForSync(item: RawRow) {
  return {
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
  };
}
