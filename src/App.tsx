import { Route, Routes } from 'react-router-dom';
import { BrandMark } from '@/components/brand/BrandMark';

/**
 * Minimal placeholder route tree. Later features replace this with the real
 * router (auth, catalog, course-create, lesson, dashboard, rooms, profile,
 * friends, notifications, settings, notebook, crud).
 */
function Landing() {
  return (
    <main
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <BrandMark size={64} />
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '32rem' }}>
        Plataforma colaborativa de aprendizado com gamificacao, cursos e salas.
      </p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
    </Routes>
  );
}
