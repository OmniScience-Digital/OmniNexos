
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
    { module: 'crm', label: 'Customer Relations Management', description: 'Customer relations management' },
    { module: 'crm', subModule: 'assets', label: 'CRM - Assets', description: 'Customer assets' },
    { module: 'crm', subModule: 'compliance', label: 'CRM - Compliance', description: 'Compliance tracking' },
    { module: 'crm', subModule: 'site', label: 'CRM - Site', description: 'Customer sites' },
    { module: 'fms', label: 'Fleet Management', description: 'Vehicle fleet module' },
    { module: 'fms', subModule: 'Inspections', label: 'FMS Inspections', description: 'Vehicle fleet module' },
    { module: 'hrd', label: 'HR Department', description: 'Human Resources module' },
    { module: 'ims', label: 'Inventory Management', description: 'Inventory module' },
    { module: 'scf', label: 'Stock Control Form', description: 'Stock Control form' },
    { module: 'scf', subModule: 'category', label: 'SCF - Category', description: 'Stock Control form' },
    { module: 'scf', subModule: 'subcategory', label: 'SCF - Subcategory', description: 'Stock Control form' },
    { module: 'scf', subModule: 'component', label: 'SCF - Component', description: 'Stock Control form' },
    { module: 'vif', label: 'Vehicle inspection Form', description: 'Vehicle Inspection form' },
]