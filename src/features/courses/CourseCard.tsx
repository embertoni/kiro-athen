import type { CourseStatus } from '@/types/db';
import { Button } from '@/components/ui/Button';

interface CourseCardProps {
  title: string;
  creatorName: string;
  studentCount: number;
  /** 0-100 progress for the current user, when enrolled. */
  progress?: number | null;
  enrolled?: boolean;
  status?: CourseStatus;
  category?: string | null;
  tags?: string[];
  onOpen: () => void;
  /** When provided, shows an inline enroll button. */
  onEnroll?: () => void;
  enrolling?: boolean;
  /** When provided (creator-only), shows an inline "Editar" button. */
  onEdit?: () => void;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  boxShadow: 'var(--shadow-sm)',
  cursor: 'pointer',
  height: '100%',
};

const badge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.72rem',
  fontWeight: 600,
  padding: '0.15rem 0.5rem',
  borderRadius: '999px',
};

/** Catalog course card: title, creator, student count, progress, actions. */
export function CourseCard({
  title,
  creatorName,
  studentCount,
  progress,
  enrolled,
  status,
  category,
  tags,
  onOpen,
  onEnroll,
  enrolling,
  onEdit,
}: CourseCardProps) {
  return (
    <div
      style={cardStyle}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.5rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.05rem',
            color: 'var(--brand-purple)',
          }}
        >
          {title}
        </h3>
        {status && (
          <span
            style={{
              ...badge,
              background:
                status === 'published'
                  ? 'rgba(46, 158, 91, 0.14)'
                  : 'rgba(107, 100, 128, 0.14)',
              color:
                status === 'published'
                  ? 'var(--color-success)'
                  : 'var(--color-text-muted)',
            }}
          >
            {status === 'published' ? 'Publicado' : 'Rascunho'}
          </span>
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '0.85rem',
          color: 'var(--color-text-muted)',
        }}
      >
        por {creatorName}
      </p>

      {category && (
        <span
          style={{
            ...badge,
            background: 'rgba(91, 42, 134, 0.1)',
            color: 'var(--brand-purple)',
          }}
        >
          {category}
        </span>
      )}

      {tags && tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {tags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: '0.72rem',
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg)',
                padding: '0.1rem 0.45rem',
                borderRadius: '999px',
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <p
        style={{
          margin: 0,
          fontSize: '0.82rem',
          color: 'var(--color-text-muted)',
        }}
      >
        {studentCount} {studentCount === 1 ? 'aluno' : 'alunos'}
      </p>

      {enrolled && typeof progress === 'number' && (
        <div>
          <div
            style={{
              height: '0.5rem',
              background: 'var(--color-border)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: 'var(--brand-gold)',
              }}
            />
          </div>
          <span
            style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}
          >
            {Math.round(progress)}% concluído
          </span>
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Ver detalhes
        </Button>
        {onEdit && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Editar
          </Button>
        )}
        {onEnroll &&
          (enrolled ? (
            <Button type="button" variant="secondary" size="sm" disabled>
              Matriculado
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={enrolling}
              onClick={(e) => {
                e.stopPropagation();
                onEnroll();
              }}
            >
              Matricular
            </Button>
          ))}
      </div>
    </div>
  );
}

export default CourseCard;
