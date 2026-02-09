
// Types
export type Access = 'view' | 'edit' | 'none'

export interface Permission {
    module: string
    subModule?: string
    access: Access
}

export interface User {
    id: string
    email: string
    name: string
    permissions: Permission[]
}

export const allPermissions = [
    { module: 'admin', label: 'Admin Access', description: 'Full system administrator' },
    { module: 'crm', label: 'CRM Module', description: 'Customer Relations module' },
    { module: 'crm', subModule: 'assets', label: 'CRM - Assets', description: 'Customer assets' },
    { module: 'crm', subModule: 'compliance', label: 'CRM - Compliance', description: 'Compliance tracking' },
    { module: 'crm', subModule: 'site', label: 'CRM - Site', description: 'Customer sites' },
    { module: 'fms', label: 'Fleet Management', description: 'Vehicle fleet module' },
    { module: 'fms', subModule: 'inspections', label: 'FMS - Inspections', description: 'Vehicle inspections' },
    { module: 'fms', subModule: 'vehicles', label: 'FMS - Vehicles', description: 'Vehicle management' },
    { module: 'hrd', label: 'HR Department', description: 'Human Resources module' },
    { module: 'ims', label: 'Inventory Management', description: 'Inventory module' },
    { module: 'scf', label: 'Stock Control Form', description: 'form module' },
    { module: 'vif', label: 'Vehicle inspection Form', description: 'form module' },
]