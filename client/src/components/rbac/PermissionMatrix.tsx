import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Search, Shield, Users, Eye, EyeOff } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

interface PermissionMatrixProps {
  /** Show only permissions for current user's role and below */
  restrictToUserLevel?: boolean;
  
  /** Allow interactive role comparison */
  allowComparison?: boolean;
  
  /** Show permission descriptions */
  showDescriptions?: boolean;
  
  /** Compact view mode */
  compact?: boolean;
  
  /** Additional test ID */
  'data-testid'?: string;
}

/**
 * Component that displays a matrix of roles and their permissions
 * Useful for understanding role capabilities and managing permissions
 */
export default function PermissionMatrix({
  restrictToUserLevel = false,
  allowComparison = true,
  showDescriptions = true,
  compact = false,
  'data-testid': dataTestId = 'permission-matrix'
}: PermissionMatrixProps) {
  const {
    allPermissions,
    availableRoles,
    userPermissions,
    isLoadingPermissions,
    isLoadingAllPermissions,
    isLoadingRoles
  } = usePermissions();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  // Filter roles based on user level if restricted
  const filteredRoles = useMemo(() => {
    if (!availableRoles) return [];
    
    if (restrictToUserLevel && userPermissions) {
      const hierarchy = ['viewer', 'user', 'accountant', 'manager', 'admin', 'owner'];
      const userLevel = hierarchy.indexOf(userPermissions.role);
      
      return availableRoles.filter(role => {
        const roleLevel = hierarchy.indexOf(role.role);
        return roleLevel <= userLevel;
      });
    }
    
    return availableRoles;
  }, [availableRoles, restrictToUserLevel, userPermissions]);

  // Get all permission categories
  const categories = useMemo(() => {
    if (!allPermissions) return [];
    return ['all', ...Object.keys(allPermissions)];
  }, [allPermissions]);

  // Filter permissions based on search and category
  const filteredPermissions = useMemo(() => {
    if (!allPermissions) return {};
    
    let permissions = { ...allPermissions };
    
    // Filter by category
    if (selectedCategory !== 'all') {
      permissions = { [selectedCategory]: permissions[selectedCategory] || [] };
    }
    
    // Filter by search term
    if (searchTerm) {
      const filtered: Record<string, typeof permissions[string]> = {};
      Object.entries(permissions).forEach(([category, perms]) => {
        const matchingPerms = perms.filter(p => 
          p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (matchingPerms.length > 0) {
          filtered[category] = matchingPerms;
        }
      });
      permissions = filtered;
    }
    
    return permissions;
  }, [allPermissions, selectedCategory, searchTerm]);

  // Check if a role has a specific permission
  const roleHasPermission = (role: string, permissionKey: string): boolean => {
    const roleInfo = filteredRoles.find(r => r.role === role);
    return roleInfo?.permissions.some(p => p.key === permissionKey) || false;
  };

  // Get role color based on hierarchy
  const getRoleColor = (role: string): string => {
    const colors = {
      viewer: 'bg-gray-100 text-gray-800',
      user: 'bg-blue-100 text-blue-800',
      accountant: 'bg-green-100 text-green-800',
      manager: 'bg-yellow-100 text-yellow-800',
      admin: 'bg-orange-100 text-orange-800',
      owner: 'bg-red-100 text-red-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  // Toggle role selection for comparison
  const toggleRoleSelection = (role: string) => {
    setSelectedRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  // Loading state
  if (isLoadingPermissions || isLoadingAllPermissions || isLoadingRoles) {
    return (
      <Card data-testid={`${dataTestId}-loading`}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (!allPermissions || !filteredRoles.length) {
    return (
      <Card data-testid={`${dataTestId}-error`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Matrix Unavailable
          </CardTitle>
          <CardDescription>
            Unable to load permissions data. Please check your access level.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const displayRoles = selectedRoles.length > 0 ? 
    filteredRoles.filter(r => selectedRoles.includes(r.role)) : 
    filteredRoles;

  return (
    <div className="space-y-6" data-testid={dataTestId}>
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Matrix
          </CardTitle>
          <CardDescription>
            Compare roles and their permissions across the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="permission-search"
              />
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                data-testid={`category-${category}`}
              >
                {category === 'all' ? 'All Categories' : category}
              </Button>
            ))}
          </div>

          {/* Role selection for comparison */}
          {allowComparison && (
            <div className="space-y-2">
              <Label>Compare Roles:</Label>
              <div className="flex flex-wrap gap-2">
                {filteredRoles.map(role => (
                  <Badge
                    key={role.role}
                    variant={selectedRoles.includes(role.role) ? "default" : "outline"}
                    className={`cursor-pointer ${selectedRoles.includes(role.role) ? '' : 'hover:bg-muted'}`}
                    onClick={() => toggleRoleSelection(role.role)}
                    data-testid={`role-${role.role}`}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    {role.role} ({role.permissionCount})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* View options */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="show-differences"
                checked={showOnlyDifferences}
                onCheckedChange={setShowOnlyDifferences}
                data-testid="toggle-differences"
              />
              <Label htmlFor="show-differences">Show only differences</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-descriptions"
                checked={showDescriptions}
                onCheckedChange={(checked) => {}}
                disabled
                data-testid="toggle-descriptions"
              />
              <Label htmlFor="show-descriptions">Show descriptions</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Permission</th>
                  {displayRoles.map(role => (
                    <th key={role.role} className="text-center p-4 min-w-24">
                      <Badge className={getRoleColor(role.role)}>
                        {role.role}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(filteredPermissions).map(([category, permissions]) => (
                  permissions.map((permission, index) => {
                    // Check if this permission shows differences across roles
                    const hasVariation = displayRoles.some((role, i) => 
                      displayRoles.some((otherRole, j) => 
                        i !== j && roleHasPermission(role.role, permission.key) !== roleHasPermission(otherRole.role, permission.key)
                      )
                    );

                    // Skip if showing only differences and there are no differences
                    if (showOnlyDifferences && !hasVariation && displayRoles.length > 1) {
                      return null;
                    }

                    return (
                      <tr 
                        key={`${category}-${permission.key}`}
                        className={`border-b hover:bg-muted/25 ${index === 0 ? 'border-t-2' : ''}`}
                        data-testid={`permission-row-${permission.key}`}
                      >
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="font-medium">{permission.key}</div>
                            {showDescriptions && (
                              <div className="text-sm text-muted-foreground">
                                {permission.description}
                              </div>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {category}
                            </Badge>
                          </div>
                        </td>
                        {displayRoles.map(role => (
                          <td key={role.role} className="p-4 text-center">
                            {roleHasPermission(role.role, permission.key) ? (
                              <Check 
                                className="h-5 w-5 text-green-600 mx-auto" 
                                data-testid={`check-${role.role}-${permission.key}`}
                              />
                            ) : (
                              <X 
                                className="h-5 w-5 text-red-400 mx-auto opacity-50" 
                                data-testid={`cross-${role.role}-${permission.key}`}
                              />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )).filter(Boolean)}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      {selectedRoles.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {selectedRoles.map(roleName => {
                const role = filteredRoles.find(r => r.role === roleName);
                if (!role) return null;

                const rolePermissions = Object.values(filteredPermissions).flat();
                const hasCount = rolePermissions.filter(p => 
                  roleHasPermission(role.role, p.key)
                ).length;

                return (
                  <div key={role.role} className="text-center space-y-2">
                    <Badge className={getRoleColor(role.role)}>
                      {role.role}
                    </Badge>
                    <div className="text-2xl font-bold">{hasCount}</div>
                    <div className="text-sm text-muted-foreground">
                      of {rolePermissions.length} permissions
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.round((hasCount / rolePermissions.length) * 100)}% coverage
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}