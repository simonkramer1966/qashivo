import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

interface ProtectedComponentProps {
  /** Permission required to view the component */
  permission?: string;
  
  /** Array of permissions - user needs ANY of these */
  anyPermissions?: string[];
  
  /** Array of permissions - user needs ALL of these */
  allPermissions?: string[];
  
  /** Role required to view the component */
  role?: string;
  
  /** Minimum role level required */
  minimumRole?: string;
  
  /** Content to render when user has access */
  children: ReactNode;
  
  /** Content to render when user lacks permission (optional) */
  fallback?: ReactNode;
  
  /** Show default permission denied message */
  showDeniedMessage?: boolean;
  
  /** Custom permission denied message */
  deniedMessage?: string;
  
  /** Hide content silently if no permission (no message or fallback) */
  hideOnDeny?: boolean;
  
  /** Additional test ID for the component */
  'data-testid'?: string;
}

/**
 * Component wrapper that conditionally renders content based on user permissions
 * 
 * @example
 * // Simple permission check
 * <ProtectedComponent permission="invoices:read">
 *   <InvoicesList />
 * </ProtectedComponent>
 * 
 * @example
 * // Role-based check
 * <ProtectedComponent role="admin">
 *   <AdminPanel />
 * </ProtectedComponent>
 * 
 * @example
 * // Multiple permissions (any)
 * <ProtectedComponent anyPermissions={['invoices:read', 'finance:read']}>
 *   <FinancialDashboard />
 * </ProtectedComponent>
 * 
 * @example
 * // With custom fallback
 * <ProtectedComponent 
 *   permission="admin:users" 
 *   fallback={<div>Contact admin for access</div>}
 * >
 *   <UserManagement />
 * </ProtectedComponent>
 */
export default function ProtectedComponent({
  permission,
  anyPermissions,
  allPermissions,
  role,
  minimumRole,
  children,
  fallback,
  showDeniedMessage = false,
  deniedMessage = "You don't have permission to access this content",
  hideOnDeny = false,
  'data-testid': dataTestId,
}: ProtectedComponentProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasMinimumRole,
    isLoadingPermissions,
    userPermissions
  } = usePermissions();

  // Show loading state while permissions are being fetched
  if (isLoadingPermissions) {
    return (
      <div 
        className="animate-pulse bg-muted h-20 rounded-md" 
        data-testid={dataTestId ? `${dataTestId}-loading` : 'protected-component-loading'}
      />
    );
  }

  // If no user permissions loaded, deny access
  if (!userPermissions) {
    if (hideOnDeny) return null;
    
    return (
      <div data-testid={dataTestId ? `${dataTestId}-no-user` : 'protected-component-no-user'}>
        {fallback || (showDeniedMessage && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>Authentication required</AlertDescription>
          </Alert>
        ))}
      </div>
    );
  }

  // Check permissions based on provided props
  let hasAccess = true;

  if (permission && !hasPermission(permission)) {
    hasAccess = false;
  }
  
  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    hasAccess = false;
  }
  
  if (allPermissions && !hasAllPermissions(allPermissions)) {
    hasAccess = false;
  }
  
  if (role && !hasRole(role)) {
    hasAccess = false;
  }
  
  if (minimumRole && !hasMinimumRole(minimumRole)) {
    hasAccess = false;
  }

  // Render content if user has access
  if (hasAccess) {
    return (
      <div data-testid={dataTestId || 'protected-component-allowed'}>
        {children}
      </div>
    );
  }

  // Handle permission denied
  if (hideOnDeny) {
    return null;
  }

  return (
    <div data-testid={dataTestId ? `${dataTestId}-denied` : 'protected-component-denied'}>
      {fallback || (showDeniedMessage && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{deniedMessage}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

/**
 * Higher-order component version for class components or more complex wrapping
 */
export function withPermissionCheck(
  WrappedComponent: React.ComponentType<any>,
  permissionConfig: Omit<ProtectedComponentProps, 'children'>
) {
  return function WithPermissionComponent(props: any) {
    return (
      <ProtectedComponent {...permissionConfig}>
        <WrappedComponent {...props} />
      </ProtectedComponent>
    );
  };
}