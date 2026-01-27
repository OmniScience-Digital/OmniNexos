import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Save, Copy, Trash2, Plus, Users, AlertCircle, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import ResponseModal from '@/components/widgets/response'
import { client } from '@/services/schema'

// Types
type Access = 'view' | 'edit' | 'none'

interface Permission {
  module: string
  subModule?: string
  access: Access
}

interface User {
  id: string
  email: string
  name: string
  permissions: Permission[]
}

// Permission mapping helpers - FIXED NULL TYPE
const permissionToString = (perm: Permission): string => {
  if (perm.module === 'admin') return 'admin'
  if (perm.subModule) {
    return `${perm.module}.${perm.subModule}.${perm.access}`
  }
  return `${perm.module}.${perm.access}`
}

const stringToPermission = (str: string | null | undefined): Permission => {
  if (!str || str === 'admin') return { module: 'admin', access: 'edit' }

  const parts = str.split('.')
  if (parts.length === 2) {
    return { module: parts[0], access: parts[1] as Access }
  }
  if (parts.length === 3) {
    return { module: parts[0], subModule: parts[1], access: parts[2] as Access }
  }
  return { module: 'unknown', access: 'none' }
}

// All possible permissions
const allPermissions = [
  { module: 'admin', label: 'Admin Access', description: 'Full system administrator' },
  { module: 'hrd', label: 'HR Department', description: 'Human Resources module' },
  { module: 'hrd', subModule: 'employees', label: 'HRD - Employees', description: 'Employee management' },
  { module: 'hrd', subModule: 'payroll', label: 'HRD - Payroll', description: 'Payroll system' },
  { module: 'fms', label: 'Fleet Management', description: 'Vehicle fleet module' },
  { module: 'fms', subModule: 'vehicles', label: 'FMS - Vehicles', description: 'Vehicle management' },
  { module: 'fms', subModule: 'inspections', label: 'FMS - Inspections', description: 'Vehicle inspections' },
  { module: 'crm', label: 'CRM Module', description: 'Customer Relations module' },
  { module: 'crm', subModule: 'assets', label: 'CRM - Assets', description: 'Customer assets' },
  { module: 'crm', subModule: 'compliance', label: 'CRM - Compliance', description: 'Compliance tracking' },
  { module: 'crm', subModule: 'site', label: 'CRM - Site', description: 'Customer sites' },
  { module: 'ims', label: 'Inventory Management', description: 'Inventory module' },
  { module: 'ims', subModule: 'components', label: 'IMS - Components', description: 'Components inventory' },
  { module: 'ims', subModule: 'suppliers', label: 'IMS - Suppliers', description: 'Supplier management' }
]

export default function UserPermissionsAssign() {
  const [users, setUsers] = useState<User[]>([
    { id: 'thabio@co.com', email: 'thabio@co.com', name: 'Thabio', permissions: [] },
    { id: 'john@co.com', email: 'john@co.com', name: 'John', permissions: [] },
    { id: 'sarah@co.com', email: 'sarah@co.com', name: 'Sarah', permissions: [] }
  ])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [copyDropdownOpen, setCopyDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [showResponse, setShowResponse] = useState(false)
  const [responseSuccessful, setResponseSuccessful] = useState(false)
  const [responseMessage, setResponseMessage] = useState('')

  // Load permissions from DB
  useEffect(() => {
    loadPermissionsFromDB()
  }, [])

  const loadPermissionsFromDB = async () => {
    try {
      setLoading(true)

      // Get all permissions from your Permission table
      const { data: permissionsData } = await client.models.Permission.list()

      // Create users with their permissions from DB
      const usersWithPermissions = users.map(user => {
        const userPermission = permissionsData.find(p => p.userId === user.id)
        // FIX: Handle nullable strings properly
        const permissionStrings = userPermission?.permissions?.filter((p): p is string => p !== null) || []

        return {
          ...user,
          permissions: permissionStrings.map(stringToPermission)
        }
      })

      setUsers(usersWithPermissions)
    } catch (error) {
      console.error('Error loading permissions:', error)
      showResponseMessage('Failed to load permissions from database', false)
    } finally {
      setLoading(false)
    }
  }

  const showResponseMessage = (message: string, successful: boolean) => {
    setResponseMessage(message)
    setResponseSuccessful(successful)
    setShowResponse(true)
  }

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  )

  const getAvailablePermissions = (user: User) => {
    return allPermissions.filter(perm => {
      return !user.permissions.find(userPerm =>
        userPerm.module === perm.module &&
        userPerm.subModule === perm.subModule
      )
    })
  }

  const isAdmin = (user: User): boolean => {
    return user.permissions.some(p => p.module === 'admin' && p.access === 'edit')
  }

  const addPermission = (user: User, permission: { module: string; subModule?: string }) => {
    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id !== user.id) return u

      const exists = u.permissions.find(p =>
        p.module === permission.module && p.subModule === permission.subModule
      )
      if (exists) return u

      const newPermission: Permission = {
        module: permission.module,
        subModule: permission.subModule,
        access: permission.module === 'admin' ? 'edit' : 'view'
      }

      return { ...u, permissions: [...u.permissions, newPermission] }
    }))

    if (selectedUser?.id === user.id) {
      const newPerm: Permission = {
        module: permission.module,
        subModule: permission.subModule,
        access: permission.module === 'admin' ? 'edit' : 'view'
      }
      setSelectedUser(prev => prev ? {
        ...prev,
        permissions: [...prev.permissions, newPerm]
      } : null)
    }
  }

  const removePermission = (user: User, permissionIndex: number) => {
    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id !== user.id) return u
      return { ...u, permissions: u.permissions.filter((_, index) => index !== permissionIndex) }
    }))

    if (selectedUser?.id === user.id) {
      setSelectedUser(prev => prev ? {
        ...prev,
        permissions: prev.permissions.filter((_, index) => index !== permissionIndex)
      } : null)
    }
  }

  const updatePermissionAccess = (user: User, permissionIndex: number, newAccess: Access) => {
    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id !== user.id) return u
      const newPermissions = [...u.permissions]
      newPermissions[permissionIndex] = { ...newPermissions[permissionIndex], access: newAccess }
      return { ...u, permissions: newPermissions }
    }))

    if (selectedUser?.id === user.id) {
      const newPermissions = [...selectedUser.permissions]
      newPermissions[permissionIndex] = { ...newPermissions[permissionIndex], access: newAccess }
      setSelectedUser({ ...selectedUser, permissions: newPermissions })
    }
  }

  const copyPermissionsFromUser = (sourceUser: User) => {
    if (!selectedUser) return

    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id !== selectedUser.id) return u
      return { ...u, permissions: [...sourceUser.permissions] }
    }))

    setSelectedUser({ ...selectedUser, permissions: [...sourceUser.permissions] })
    setCopyDropdownOpen(false)
  }

  const toggleAdmin = (user: User, makeAdmin: boolean) => {
    if (makeAdmin) {
      addPermission(user, { module: 'admin' })
    } else {
      const adminIndex = user.permissions.findIndex(p => p.module === 'admin')
      if (adminIndex !== -1) {
        removePermission(user, adminIndex)
      }
    }
  }

  const applyTemplate = (templateName: string) => {
    if (!selectedUser) return

    let templatePermissions: Permission[] = []

    switch (templateName) {
      case 'admin':
        templatePermissions = [{ module: 'admin', access: 'edit' }]
        break
      case 'view-only':
        templatePermissions = allPermissions
          .filter(p => p.module !== 'admin')
          .map(p => ({ module: p.module, subModule: p.subModule, access: 'view' as Access }))
        break
      case 'crm-manager':
        templatePermissions = [
          { module: 'crm', access: 'edit' },
          { module: 'crm', subModule: 'assets', access: 'edit' },
          { module: 'crm', subModule: 'compliance', access: 'edit' },
          { module: 'crm', subModule: 'site', access: 'edit' }
        ]
        break
      case 'clear':
        templatePermissions = []
        break
    }

    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id !== selectedUser.id) return u
      return { ...u, permissions: templatePermissions }
    }))

    setSelectedUser({ ...selectedUser, permissions: templatePermissions })
  }

  // Save selected user's permissions to DB
  const saveChanges = async () => {
    if (!selectedUser) {
      showResponseMessage('Please select a user first', false)
      return
    }

    try {
      setSaving(true)

      const permissionStrings = selectedUser.permissions.map(permissionToString)

      const { data: existingPermissions } = await client.models.Permission.list({
        filter: { userId: { eq: selectedUser.id } }
      })

      if (existingPermissions.length > 0) {
        await client.models.Permission.update({
          id: existingPermissions[0].id,
          permissions: permissionStrings
        })
      } else {
        await client.models.Permission.create({
          userId: selectedUser.id,
          permissions: permissionStrings
        })
      }

      showResponseMessage(`Permissions saved for ${selectedUser.name}`, true)

    } catch (error) {
      console.error('Error saving permissions:', error)
      showResponseMessage('Failed to save permissions', false)
    } finally {
      setSaving(false)
    }
  }

  // Save ALL users' permissions to DB
  const saveAllChanges = async () => {
    try {
      setSaving(true)

      for (const user of users) {
        const permissionStrings = user.permissions.map(permissionToString)

        const { data: existingPermissions } = await client.models.Permission.list({
          filter: { userId: { eq: user.id } }
        })

        if (existingPermissions.length > 0) {
          await client.models.Permission.update({
            id: existingPermissions[0].id,
            permissions: permissionStrings
          })
        } else {
          await client.models.Permission.create({
            userId: user.id,
            permissions: permissionStrings
          })
        }
      }

      showResponseMessage('All permissions saved successfully', true)

    } catch (error) {
      console.error('Error saving all permissions:', error)
      showResponseMessage('Failed to save permissions', false)
    } finally {
      setSaving(false)
    }
  }

  const PermissionBadge = ({ perm }: { perm: Permission }) => {
    const colors = {
      edit: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
      view: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200',
      none: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
    }

    const labels = {
      edit: 'Edit',
      view: 'View',
      none: 'No Access'
    }

    return (
      <Badge
        variant="outline"
        className={`${colors[perm.access]} px-3 py-1 transition-colors`}
      >
        {perm.module}
        {perm.subModule && `:${perm.subModule}`}
        <span className="ml-2">({labels[perm.access]})</span>
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <main className="flex-1 p-6 mt-20 pb-20">

      {showResponse && (
        <ResponseModal
          successful={responseSuccessful}
          message={responseMessage}
          setShow={setShowResponse}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Assign Permissions</h1>
          <p className="text-gray-600">Manage user access rights</p>
        </div>
        <Button
          onClick={saveAllChanges}
          className="gap-2"
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {filteredUsers.map(user => {
                  const isUserAdmin = isAdmin(user)

                  return (
                    <div
                      key={user.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedUser?.id === user.id
                          ? 'bg-blue-50 border-blue-300 shadow-sm'
                          : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                        }`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-medium truncate">{user.name}</div>
                            {isUserAdmin && (
                              <Badge className="bg-purple-100 text-purple-800">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 truncate">{user.email}</div>
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {user.permissions.length} perm
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {user.permissions.slice(0, 2).map((perm, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded truncate max-w-[120px]"
                            title={`${perm.module}${perm.subModule ? `:${perm.subModule}` : ''} (${perm.access})`}
                          >
                            {perm.module}
                            {perm.subModule && `:${perm.subModule}`}
                          </span>
                        ))}
                        {user.permissions.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{user.permissions.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedUser ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="truncate">{selectedUser.name}</CardTitle>
                        <div className="text-gray-600 truncate">{selectedUser.email}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCopyDropdownOpen(!copyDropdownOpen)}
                        className="gap-2"
                        disabled={saving}
                      >
                        <Copy className="h-4 w-4" />
                        Copy From
                      </Button>
                      {copyDropdownOpen && (
                        <div className="absolute z-10 mt-1 w-48 bg-white border rounded-lg shadow-lg">
                          {users
                            .filter(u => u.id !== selectedUser.id && u.permissions.length > 0)
                            .map(user => (
                              <button
                                key={user.id}
                                onClick={() => copyPermissionsFromUser(user)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm flex justify-between items-center"
                              >
                                <span className="truncate">{user.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {user.permissions.length}
                                </Badge>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={saveChanges}
                      className="gap-2"
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <AlertCircle className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-semibold">Administrator Access</div>
                      <div className="text-sm text-gray-600">Full system control</div>
                    </div>
                  </div>
                  <Switch
                    checked={isAdmin(selectedUser)}
                    onCheckedChange={(checked) => toggleAdmin(selectedUser, checked)}
                    disabled={saving}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Current Permissions ({selectedUser.permissions.length})</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => applyTemplate('clear')}
                      className="text-red-600 hover:text-red-700"
                      disabled={saving}
                    >
                      Clear All
                    </Button>
                  </div>

                  {selectedUser.permissions.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <div className="text-gray-600 font-medium">No permissions assigned</div>
                      <div className="text-sm text-gray-500 mt-1">
                        Add permissions using the options below
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedUser.permissions.map((perm, index) => (
                        <div
                          key={`${perm.module}-${perm.subModule || 'base'}-${index}`}
                          className="flex flex-col md:flex-row md:items-center justify-between p-3 border rounded-lg hover:bg-gray-50 gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <PermissionBadge perm={perm} />
                            <div className="text-sm text-gray-600 min-w-0">
                              <div className="truncate">
                                {perm.subModule
                                  ? `${perm.module} → ${perm.subModule}`
                                  : `${perm.module} module`
                                }
                              </div>
                              {perm.module === 'admin' && (
                                <div className="text-xs text-purple-600">Full system access</div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {(['none', 'view', 'edit'] as Access[]).map(access => (
                                <Button
                                  key={access}
                                  size="sm"
                                  variant={perm.access === access ? "default" : "outline"}
                                  onClick={() => updatePermissionAccess(selectedUser, index, access)}
                                  className={perm.access === access ?
                                    (access === 'edit' ? 'bg-green-600 hover:bg-green-700' :
                                      access === 'view' ? 'bg-blue-600 hover:bg-blue-700' :
                                        'bg-gray-600 hover:bg-gray-700') : ''
                                  }
                                  disabled={saving}
                                >
                                  {access === 'edit' && '✏️ '}
                                  {access === 'view' && '👁️ '}
                                  {access.charAt(0).toUpperCase() + access.slice(1)}
                                </Button>
                              ))}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePermission(selectedUser, index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              disabled={saving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Quick Templates</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => applyTemplate('admin')}
                      className="gap-2"
                      disabled={saving}
                    >
                      👑 Make Admin
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => applyTemplate('view-only')}
                      className="gap-2"
                      disabled={saving}
                    >
                      👁️ View-Only All
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => applyTemplate('crm-manager')}
                      className="gap-2"
                      disabled={saving}
                    >
                      🏢 CRM Manager
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Add Permissions</h3>
                    <div className="text-sm text-gray-500">
                      {getAvailablePermissions(selectedUser).length} available
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {getAvailablePermissions(selectedUser).map((perm, idx) => (
                      <Button
                        key={`${perm.module}-${perm.subModule || 'base'}-${idx}`}
                        variant="outline"
                        className="justify-start h-auto py-3 px-4 hover:bg-blue-50 hover:border-blue-200"
                        onClick={() => addPermission(selectedUser, perm)}
                        disabled={saving}
                      >
                        <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
                        <div className="text-left truncate">
                          <div className="font-medium truncate">{perm.label}</div>
                          {perm.description && (
                            <div className="text-xs text-gray-500 truncate">{perm.description}</div>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 md:py-16 text-center">
                <div className="text-gray-400 text-4xl mb-4">👈</div>
                <div className="text-xl font-medium text-gray-600 mb-2">Select a User</div>
                <div className="text-gray-500 max-w-md mx-auto">
                  Choose a user from the list to view and edit their permissions
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </main>
  )
}