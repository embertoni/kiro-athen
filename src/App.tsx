import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AdminRoute } from '@/routes/AdminRoute';
import { AppShell } from '@/components/layout/AppShell';
import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { LandingPage } from '@/features/landing/LandingPage';
import { CatalogPage } from '@/features/courses/CatalogPage';
import { CreateCoursePage } from '@/features/courses/create/CreateCoursePage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LessonView } from '@/features/lesson/LessonView';
import { RoomsListPage } from '@/features/rooms/RoomsListPage';
import { RoomDetailPage } from '@/features/rooms/RoomDetailPage';
import { GlobalRankingPage } from '@/features/rankings/GlobalRankingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';

/**
 * Application route tree.
 *
 * - Public:        /, /login, /register, /forgot-password, /reset-password
 * - Authenticated: everything under <ProtectedRoute> (wrapped by <AppShell>)
 * - Admin only:    /crud under <AdminRoute> (checks real profile.role==='admin')
 *
 * Pages whose features ship in later tasks use <PlaceholderPage> so the router
 * and guards are fully exercised today.
 */
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Authenticated routes (session required) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/lesson/:id" element={<LessonView />} />
              <Route
                path="/profile"
                element={
                  <PlaceholderPage
                    title="Perfil"
                    description="Seu perfil, medalhas e estatísticas."
                  />
                }
              />
              <Route
                path="/profile/:username"
                element={
                  <PlaceholderPage
                    title="Perfil"
                    description="Perfil público de um usuário."
                  />
                }
              />
              <Route
                path="/friends"
                element={
                  <PlaceholderPage
                    title="Amigos"
                    description="Pedidos de amizade e lista de amigos."
                  />
                }
              />
              <Route path="/rooms" element={<RoomsListPage />} />
              <Route path="/rooms/:id" element={<RoomDetailPage />} />
              <Route path="/ranking" element={<GlobalRankingPage />} />
              <Route
                path="/settings"
                element={
                  <PlaceholderPage
                    title="Configurações"
                    description="Preferências da conta."
                  />
                }
              />
              <Route
                path="/notebook"
                element={
                  <PlaceholderPage
                    title="Caderno"
                    description="Seu caderno de anotações."
                  />
                }
              />
              <Route
                path="/notifications"
                element={
                  <PlaceholderPage
                    title="Notificações"
                    description="Suas notificações."
                  />
                }
              />
              <Route path="/create" element={<CreateCoursePage />} />
            </Route>
          </Route>

          {/* Admin-only route (session + profile.role === 'admin') */}
          <Route element={<AdminRoute />}>
            <Route element={<AppShell />}>
              <Route
                path="/crud"
                element={
                  <PlaceholderPage
                    title="CRUD (admin)"
                    description="Administração de dados da plataforma."
                  />
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
