import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Guards the admin-only /crud route. Requires BOTH a session and the real
 * profile role of 'admin'. The server (RLS via public.is_admin()) remains the
 * authority; this guard only avoids rendering the admin UI to non-admins.
 *
 * - No session -> redirect to /login.
 * - Session but not admin -> redirect to /dashboard (forbidden for the UI).
 */
export function AdminRoute() {
  const { session, profile, loading } = useAuth();

  if (loading || (session && !profile)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spinner size={32} label="Verificando permissões" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
