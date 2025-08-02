import { memo, ReactNode, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { User } from 'firebase/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Loading component for route-level lazy loading
const RouteLoader = memo(() => (
  <div className="flex h-48 w-full items-center justify-center">
    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
  </div>
));
RouteLoader.displayName = 'RouteLoader';

interface ProtectedRouteProps {
  children: ReactNode;
  user: User | null;
  needsUsername: boolean;
  redirectTo?: string;
  requireAuth?: boolean;
  customCondition?: boolean;
}

export const ProtectedRoute = memo<ProtectedRouteProps>(({
  children,
  user,
  needsUsername,
  redirectTo = "/",
  requireAuth = true,
  customCondition = true,
}) => {
  const isAuthenticated = user && !needsUsername;
  
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }
  
  if (!customCondition) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
});

ProtectedRoute.displayName = 'ProtectedRoute';

interface PublicRouteProps {
  children: ReactNode;
}

export const PublicRoute = memo<PublicRouteProps>(({ children }) => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
});

PublicRoute.displayName = 'PublicRoute';
