import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Save, Trash2, Plus, Users, AlertCircle, Loader2, ChevronRight, Filter, X, Minimize2, History, Clock, UserCheck } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import ResponseModal from '@/components/widgets/response'
import { client } from '@/services/schema'
import { useAuth } from "@/contexts/auth-context";
import { allPermissions, type Access, type Permission, type User } from '@/types/user.permissions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Loading from '@/components/widgets/loading'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'


// Permission mapping helpers
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

export default function UserPermissionsAssign() {
  const { allUsers, user } = useAuth();
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [showResponse, setShowResponse] = useState(false)
  const [responseSuccessful, setResponseSuccessful] = useState(false)
  const [responseMessage, setResponseMessage] = useState('')
  const [expandedPermissions, setExpandedPermissions] = useState<Set<string>>(new Set())
  const [permissionHistory, setPermissionHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)



  const usersPerPage = 15

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        if (!allUsers) return

        const initialUsers = allUsers.map(user => ({
          id: user.email,
          email: user.email,
          name: user.name,
          permissions: []
        }))

        const { data: permissionsData } = await client.models.Permission.list()

        const usersWithPermissions = initialUsers.map(user => {
          const userPermission = permissionsData.find(p => p.userId === user.id)
          const permissionStrings = userPermission?.permissions?.filter((p): p is string => p !== null) || []
          return {
            ...user,
            permissions: permissionStrings.map(stringToPermission)
          }
        })

        setUsers(usersWithPermissions)

        if (usersWithPermissions.length > 0 && !selectedUser) {
          setSelectedUser(usersWithPermissions[0])
        }

      } catch (error) {
        console.error('Error loading data:', error)
        showResponseMessage('Failed to load users and permissions', false)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [allUsers])

  // Load permission history when selected user changes
  useEffect(() => {
    const loadPermissionHistory = async () => {
      if (!selectedUser || !user) return;

      try {
        setHistoryLoading(true);
        const { data: historyData } = await client.models.History.getHistoryByUpdatedBy(
          { updatedBy: selectedUser.name || selectedUser.email },
          { sortDirection: 'DESC', limit: 20 }
        );

        setPermissionHistory(historyData || []);
      } catch (error) {
        console.error('Error loading permission history:', error);
        setPermissionHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadPermissionHistory();
  }, [selectedUser, user]);

  const showResponseMessage = (message: string, successful: boolean) => {
    setResponseMessage(message)
    setResponseSuccessful(successful)
    setShowResponse(true)
  }

  const isAdmin = (user: User): boolean => {
    return user.permissions.some(p => p.module === 'admin' && p.access === 'edit')
  }

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())

      const matchesRole = roleFilter === 'all' ||
        (roleFilter === 'admin' && isAdmin(user)) ||
        (roleFilter === 'user' && !isAdmin(user))

      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const paginatedUsers = useMemo(() => {
    const startIndex = (page - 1) * usersPerPage
    return filteredUsers.slice(startIndex, startIndex + usersPerPage)
  }, [filteredUsers, page])

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage)

  const toggleExpandPermission = (permissionKey: string) => {
    setExpandedPermissions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(permissionKey)) {
        newSet.delete(permissionKey)
      } else {
        newSet.add(permissionKey)
      }
      return newSet
    })
  }

  const handlePermissionAccess = (user: User, permission: { module: string; subModule?: string }, access: Access) => {
    const oldPermissions = [...user.permissions];
    const existingIndex = oldPermissions.findIndex(p =>
      p.module === permission.module && p.subModule === permission.subModule
    );

    setUsers(prev => prev.map(u => {
      if (u.id !== user.id) return u

      if (existingIndex !== -1) {
        const newPermissions = [...u.permissions]
        newPermissions[existingIndex] = { ...permission, access }
        return { ...u, permissions: newPermissions }
      } else {
        return { ...u, permissions: [...u.permissions, { ...permission, access }] }
      }
    }))

    if (selectedUser?.id === user.id) {
      if (existingIndex !== -1) {
        const newPermissions = [...selectedUser.permissions]
        newPermissions[existingIndex] = { ...permission, access }
        setSelectedUser({ ...selectedUser, permissions: newPermissions })
      } else {
        setSelectedUser({
          ...selectedUser,
          permissions: [...selectedUser.permissions, { ...permission, access }]
        })
      }
    }
  }

  const removePermission = (user: User, permission: { module: string; subModule?: string }) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== user.id) return u
      return {
        ...u,
        permissions: u.permissions.filter(p =>
          !(p.module === permission.module && p.subModule === permission.subModule)
        )
      }
    }))

    if (selectedUser?.id === user.id) {
      setSelectedUser({
        ...selectedUser,
        permissions: selectedUser.permissions.filter(p =>
          !(p.module === permission.module && p.subModule === permission.subModule)
        )
      })
    }
  }

  const getPermissionKey = (perm: { module: string; subModule?: string }) => {
    return perm.subModule ? `${perm.module}.${perm.subModule}` : perm.module
  }

  const getCurrentAccess = (permission: { module: string; subModule?: string }) => {
    if (!selectedUser) return null
    const perm = selectedUser.permissions.find(p =>
      p.module === permission.module && p.subModule === permission.subModule
    )
    return perm?.access || null
  }

  const toggleAdmin = (user: User, makeAdmin: boolean) => {
    if (makeAdmin) {
      handlePermissionAccess(user, { module: 'admin' }, 'edit')
    } else {
      removePermission(user, { module: 'admin' })
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
      case 'clear':
        templatePermissions = []
        break
    }

    setUsers(prev => prev.map(u => {
      if (u.id !== selectedUser.id) return u
      return { ...u, permissions: templatePermissions }
    }))

    setSelectedUser({ ...selectedUser, permissions: templatePermissions })
    setExpandedPermissions(new Set())
  }

  // Function to create history entry in the existing History table
  const createPermissionHistory = async (
    action: string,
    details: string
  ) => {
    if (!selectedUser) return;

    try {

      const johannesburgTime = new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" });

      await client.models.History.create({
        entityType: "PERMISSIONS",
        entityId: selectedUser.id,
        action: action,
        timestamp: new Date().toISOString(),
        updatedBy: user?.preferred_username || user?.email,
        details: `${user?.preferred_username} ${details} for user "${selectedUser.name}" (${selectedUser.email}) at ${johannesburgTime}`
      });

      // Refresh history using GSI
      const { data: historyData } = await client.models.History.getHistoryByUpdatedBy(
        { updatedBy: selectedUser.name || selectedUser.email },
        { sortDirection: 'DESC', limit: 20 }
      );
      setPermissionHistory(historyData || []);
    } catch (error) {
      console.error('Error creating permission history:', error);
    }
  };

  const saveChanges = async () => {
    if (!selectedUser) {
      showResponseMessage('Please select a user first', false)
      return
    }

    try {
      setSaving(true)
      const permissionStrings = selectedUser.permissions.map(permissionToString)

      // Get old permissions from database
      const { data: existingPermissions } = await client.models.Permission.list({
        filter: { userId: { eq: selectedUser.id } }
      })

      const oldPermissions = existingPermissions.length > 0
        ? existingPermissions[0].permissions?.filter((p): p is string => p !== null).map(stringToPermission) || []
        : [];

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

      // Create history entry
      let details = '';

      // Compare old and new permissions
      const addedPermissions = selectedUser.permissions.filter(newPerm =>
        !oldPermissions.some(oldPerm =>
          permissionToString(oldPerm) === permissionToString(newPerm)
        )
      );

      const removedPermissions = oldPermissions.filter(oldPerm =>
        !selectedUser.permissions.some(newPerm =>
          permissionToString(newPerm) === permissionToString(oldPerm)
        )
      );

      if (addedPermissions.length > 0) {
        details += `added permissions: ${addedPermissions.map(p => permissionToString(p)).join(', ')}. `;
      }

      if (removedPermissions.length > 0) {
        details += `removed permissions: ${removedPermissions.map(p => permissionToString(p)).join(', ')}. `;
      }

      if (addedPermissions.length === 0 && removedPermissions.length === 0) {
        details = 'updated permissions (no changes detected).';
      }

      await createPermissionHistory(
        'UPDATE_PERMISSIONS',
        details
      );

      showResponseMessage(`Permissions saved for ${selectedUser.name}`, true)
    } catch (error) {
      console.error('Error saving permissions:', error)
      showResponseMessage('Failed to save permissions', false)
    } finally {
      setSaving(false)
    }
  }

  const UserListItem = ({ user }: { user: User }) => {
    const userIsAdmin = isAdmin(user)
    const assignedCount = user.permissions.length

    return (
      <div
        className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedUser?.id === user.id
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        onClick={() => setSelectedUser(user)}
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-medium truncate text-sm text-gray-900 dark:text-gray-100">
                {user.name}
              </div>
              {userIsAdmin && (
                <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs px-1.5">
                  Admin
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {user.email}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {assignedCount > 0 && (
              <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600">
                {assignedCount}
              </Badge>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        {assignedCount > 0 && (
          <div className="mt-2">
            <div className="flex flex-wrap gap-1">
              {user.permissions.slice(0, 2).map((perm, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded"
                >
                  {perm.module}
                  {perm.subModule && `:${perm.subModule.charAt(0)}`}
                </span>
              ))}
              {assignedCount > 2 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{assignedCount - 2}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loading />
      </div>
    )
  }

  return (
    <main className="flex-1 px-4 sm:px-6 mt-20 pb-20">
      {showResponse && (
        <ResponseModal
          successful={responseSuccessful}
          message={responseMessage}
          setShow={setShowResponse}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-1xl md:text-2xl font-bold mt-3">User Permissions</h1>
          <p className="text-gray-600">Manage access for {filteredUsers.length} users</p>
        </div>
        <Button
          onClick={saveChanges}
          className="gap-2"
          disabled={saving || !selectedUser}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-1">
          <Card className="h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <CardTitle>Users</CardTitle>
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full cursor-pointer">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent >
                      <SelectItem className="cursor-pointer" value="all">All Users</SelectItem>
                      <SelectItem className="cursor-pointer" value="admin">Admins Only</SelectItem>
                      <SelectItem className="cursor-pointer" value="user">Users Only</SelectItem>
                    </SelectContent>
                  </Select>
                  {(search || roleFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('')
                        setRoleFilter('all')
                      }}
                      className="px-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {paginatedUsers.map(user => (
                  <UserListItem key={user.id} user={user} />
                ))}

                {paginatedUsers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No users found
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedUser ? (
            <Tabs defaultValue="permissions" className=" flex flex-col">
              <Card className="flex-1 flex flex-col dark:bg-gray-900">
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
                          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <CardTitle className="truncate text-gray-900 dark:text-gray-100">
                            {selectedUser.name}
                          </CardTitle>
                          <div className="text-gray-600 dark:text-gray-400 truncate">
                            {selectedUser.email}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate('admin')}
                        className="gap-2"
                        disabled={saving || isAdmin(selectedUser)}
                      >
                        👑 Make Admin
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate('clear')}
                        className="gap-2"
                        disabled={saving || selectedUser.permissions.length === 0}
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear All
                      </Button>
                    </div>
                  </div>

                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="permissions" className="cursor-pointer">
                      Permissions
                    </TabsTrigger>
                    <TabsTrigger value="history" className="cursor-pointer">
                      <History className="h-4 w-4 mr-2" />
                      History
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-6">
                  <TabsContent value="permissions" className="space-y-6 m-0">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full">
                          <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100">
                            Administrator Access
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Full system control
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={isAdmin(selectedUser)}
                        onCheckedChange={(checked) => toggleAdmin(selectedUser, checked)}
                        disabled={saving}
                      />
                    </div>

                    <div className="space-y-6">
                      <div className="border rounded-lg p-4 dark:border-gray-700 dark:bg-gray-800/30">
                        <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
                          Assigned Permissions ({selectedUser.permissions.length})
                        </h3>
                        <div className="space-y-2">
                          {selectedUser.permissions.length === 0 ? (
                            <div className="text-gray-500 dark:text-gray-400 text-sm italic">
                              No permissions assigned
                            </div>
                          ) : (
                            selectedUser.permissions.map((perm, idx) => {
                              const permConfig = allPermissions.find(p =>
                                p.module === perm.module && p.subModule === perm.subModule
                              )
                              return (
                                <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded">
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {permConfig?.label || `${perm.module}${perm.subModule ? ` - ${perm.subModule}` : ''}`}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {perm.module}{perm.subModule ? `.${perm.subModule}` : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={
                                      perm.access === 'edit' ? 'default' : 'secondary'
                                    }>
                                      {perm.access === 'edit' ? 'Edit' : 'View'}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removePermission(selectedUser, perm)}
                                      className="h-6 w-6 p-0 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            Available Permissions
                          </h3>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {allPermissions.length} total modules
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {allPermissions.map((perm, idx) => {
                            const permissionKey = getPermissionKey(perm)
                            const isExpanded = expandedPermissions.has(permissionKey)
                            const currentAccess = getCurrentAccess(perm)
                            const hasPermission = currentAccess !== null

                            return (
                              <div
                                key={idx}
                                className="border rounded-lg p-3 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {perm.label}
                                    </div>
                                    {perm.description && (
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {perm.description}
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleExpandPermission(permissionKey)}
                                    className="h-8 w-8 p-0 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                                  >
                                    {isExpanded ? (
                                      <Minimize2 className="h-4 w-4" />
                                    ) : (
                                      <Plus className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>

                                {isExpanded && (
                                  <div className="flex gap-2">
                                    {hasPermission ? (
                                      <>
                                        {(['view', 'edit'] as Access[]).map(access => (
                                          <Button
                                            key={access}
                                            size="sm"
                                            variant={currentAccess === access ? "default" : "outline"}
                                            onClick={() => handlePermissionAccess(selectedUser, perm, access)}
                                            className="text-xs"
                                          >
                                            {access === 'view' ? 'View Only' : 'Edit/Full'}
                                          </Button>
                                        ))}
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => removePermission(selectedUser, perm)}
                                          className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                        >
                                          Remove
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handlePermissionAccess(selectedUser, perm, 'view')}
                                          className="text-xs"
                                        >
                                          View Only
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handlePermissionAccess(selectedUser, perm, 'edit')}
                                          className="text-xs"
                                        >
                                          Edit/Full
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                )}

                                {!isExpanded && hasPermission && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Access:</span>
                                    <Badge variant={
                                      currentAccess === 'edit' ? 'default' : 'secondary'
                                    }>
                                      {currentAccess === 'edit' ? 'Edit' : 'View'}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="history" className="m-0">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <History className="h-5 w-5" />
                          Permission History
                        </CardTitle>
                        <CardDescription>
                          All permission changes for {selectedUser.name}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="max-h-[400px] overflow-y-auto">
                        {historyLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            <span className="ml-2 text-gray-500">Loading history...</span>
                          </div>
                        ) : permissionHistory.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            No permission history found for this user.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {permissionHistory.map((history, index) => (  // ✅ No filter
                              <div key={history.id || index} className="border-l-4 border-blue-500 pl-4 py-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <UserCheck className="h-4 w-4 text-green-600" />
                                      <span className="font-medium">{history.details.split(' ')[0]}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {history.action}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                      {history.details}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    {new Date(history.timestamp).toLocaleString('en-ZA', {
                                      timeZone: 'Africa/Johannesburg',
                                      dateStyle: 'short',
                                      timeStyle: 'short'
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </CardContent>
              </Card>
            </Tabs>
          ) : (
            <Card className="h-[calc(100vh-200px)] flex items-center justify-center dark:bg-gray-900">
              <CardContent className="text-center py-12">
                <div className="text-gray-400 dark:text-gray-500 text-4xl mb-4">👈</div>
                <div className="text-xl font-medium text-gray-600 dark:text-gray-300 mb-2">
                  Select a User
                </div>
                <div className="text-gray-500 dark:text-gray-400">
                  Choose a user from the list to manage their permissions
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}