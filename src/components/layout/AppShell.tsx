import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { NotificationBell } from '@/features/notifications/NotificationBell';

interface NavItem {
  to: string;
  label: string;
  /** When true, only render for admins. */
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/catalog', label: 'Catálogo' },
  { to: '/dashboard', label: 'Painel' },
  { to: '/rooms', label: 'Salas' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/friends', label: 'Amigos' },
  { to: '/notifications', label: 'Notificações' },
  { to: '/profile', label: 'Perfil' },
  { to: '/notebook', label: 'Caderno' },
  { to: '/settings', label: 'Configurações' },
  { to: '/crud', label: 'CRUD (admin)', adminOnly: true },
];

/**
 * Authenticated app layout: a header with the Athen brand + logout, a sidebar
 * with the primary navigation (crud shown only to admins), and an <Outlet /> for
 * the active page.
 */
export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao sair.');
      setSigningOut(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1.25rem',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <NavLink to="/dashboard" aria-label="Athen - ir para o painel">
          <BrandMark size={32} />
        </NavLink>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <NotificationBell />
          {profile && (
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
              {profile.display_name || profile.username}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            loading={signingOut}
          >
            Sair
          </Button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav
          aria-label="Navegação principal"
          style={{
            width: '13rem',
            flexShrink: 0,
            padding: '1rem 0.75rem',
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.92rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--color-text)',
                background: isActive ? 'var(--brand-purple)' : 'transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main style={{ flex: 1, minWidth: 0, padding: '1.5rem' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;
