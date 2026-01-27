// Define all modules and their sub-modules
type Module = "admin" | "hrd" | "fms" | "crm" | "ims"

// Define sub-modules for each module
type SubModule = 
  // CRM sub-modules
  | "crm.assets"
  | "crm.compliance" 
  | "crm.site"
  // HRD sub-modules (if any)
  | "hrd.employees"
  | "hrd.payroll"
  // etc.

type AccessLevel = "noaccess" | "read" | "write"

// User permission entry
export type UserPermission = {
  module: Module
  subModule?: SubModule  // Only if module has sub-modules
  access: AccessLevel
}