import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorText } from '@/components/ui/ErrorText';
import type { QuestionType, Json, CourseStatus } from '@/types/database';
import {
  useSaveCourse,
  type CourseDraft,
  type ModuleDraft,
  type LessonDraft,
  type QuestionDraft,
} from '../api';
import { slugify, isExistingContentLocked } from '../helpers';
import {
  QUESTION_TYPE_LABELS,
  defaultXpFor,
  emptyConfigFor,
  validateQuestionConfig,
} from '../questionConfig';
import { QuestionConfigEditor } from './QuestionConfigEditor';

const QUESTION_TYPE_OPTIONS = (
  Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]
).map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }));

function emptyQuestion(type: QuestionType, position: number): QuestionDraft {
  return {
    type,
    prompt: '',
    position,
    config: emptyConfigFor(type) as unknown as Json,
    xpValue: defaultXpFor(type),
  };
}

function emptyLesson(position: number): LessonDraft {
  return { title: '', content: '', position, questions: [] };
}

function emptyModule(position: number): ModuleDraft {
  return {
    title: '',
    description: '',
    position,
    color: '#5b2a86',
    lessons: [emptyLesson(0)],
  };
}

const card: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.25rem',
  marginBottom: '1rem',
  boxShadow: 'var(--shadow-sm)',
};

/**
 * Course creation / editing page (route /create). Any authenticated user may
 * build a course with nested modules, lessons and typed questions, then save
 * as draft or publish.
 */
export function CreateCoursePage() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const save = useSaveCourse(session?.user?.id);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [modules, setModules] = useState<ModuleDraft[]>([emptyModule(0)]);
  const [formError, setFormError] = useState<string | null>(null);

  // Existing-course identity. The /create route never loads an existing course
  // today (always a fresh draft), so these stay at their create-mode defaults.
  // They exist so the edit affordances defensively respect an "existing
  // published course" state if/when an edit entry point hydrates them, matching
  // the server-side gating in migration 0019.
  const [courseId] = useState<string | undefined>(undefined);
  const [courseStatus] = useState<CourseStatus>('draft');

  // When editing an existing PUBLISHED course, its already-persisted content is
  // immutable: edit/delete affordances for pre-existing modules/lessons/
  // questions are hidden, while adding brand-new modules stays available.
  const contentLocked = isExistingContentLocked({
    isExistingCourse: !!courseId,
    status: courseStatus,
  });

  /** A module/lesson/question is pre-existing when it already has an id. */
  const isPersisted = (entity: { id?: string }) => !!entity.id;

  const effectiveSlug = useMemo(
    () => (slugTouched ? slug : slugify(title)),
    [slug, slugTouched, title],
  );

  function updateModule(mi: number, patch: Partial<ModuleDraft>) {
    setModules((prev) =>
      prev.map((m, i) => (i === mi ? { ...m, ...patch } : m)),
    );
  }

  function updateLesson(mi: number, li: number, patch: Partial<LessonDraft>) {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi
          ? {
              ...m,
              lessons: m.lessons.map((l, j) =>
                j === li ? { ...l, ...patch } : l,
              ),
            }
          : m,
      ),
    );
  }

  function updateQuestion(
    mi: number,
    li: number,
    qi: number,
    patch: Partial<QuestionDraft>,
  ) {
    setModules((prev) =>
      prev.map((m, i) =>
        i === mi
          ? {
              ...m,
              lessons: m.lessons.map((l, j) =>
                j === li
                  ? {
                      ...l,
                      questions: l.questions.map((q, k) =>
                        k === qi ? { ...q, ...patch } : q,
                      ),
                    }
                  : l,
              ),
            }
          : m,
      ),
    );
  }

  function buildDraft(status: CourseStatus): CourseDraft {
    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      id: courseId,
      title: title.trim(),
      slug: effectiveSlug,
      description: description.trim(),
      category: category.trim(),
      tags,
      visibility,
      status,
      modules,
    };
  }

  function validate(draft: CourseDraft): string | null {
    if (!draft.title) return 'Informe o título do curso.';
    if (!draft.slug) return 'O slug não pode ficar vazio.';
    if (draft.modules.length === 0) return 'Adicione ao menos um módulo.';
    for (const [mi, m] of draft.modules.entries()) {
      if (!m.title.trim()) return `Informe o título do módulo ${mi + 1}.`;
      if (m.lessons.length === 0)
        return `O módulo "${m.title}" precisa de ao menos uma aula.`;
      for (const [li, l] of m.lessons.entries()) {
        if (!l.title.trim())
          return `Informe o título da aula ${li + 1} do módulo "${m.title}".`;
        for (const [qi, q] of l.questions.entries()) {
          if (!q.prompt.trim())
            return `Informe o enunciado da questão ${qi + 1} da aula "${l.title}".`;
          const configError = validateQuestionConfig(q.type, q.config);
          if (configError)
            return `Questão ${qi + 1} da aula "${l.title}": ${configError}`;
        }
      }
    }
    return null;
  }

  async function handleSave(status: CourseStatus) {
    setFormError(null);
    const draft = buildDraft(status);
    const error = validate(draft);
    if (error) {
      setFormError(error);
      return;
    }
    try {
      const course = await save.mutateAsync(draft);
      toast.success(
        status === 'published'
          ? 'Curso publicado com sucesso!'
          : 'Rascunho salvo.',
      );
      navigate('/catalog', { state: { createdCourseId: course.id } });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível salvar o curso.';
      // Unique-slug violations surface as a Postgres error; make it friendly.
      setFormError(
        /duplicate|unique/i.test(message)
          ? 'Já existe um curso com esse slug. Escolha outro.'
          : message,
      );
    }
  }

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto' }}>
      <h1 style={{ color: 'var(--brand-purple)' }}>Criar curso</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: '-0.5rem' }}>
        Monte seus módulos, aulas e questões. Salve como rascunho ou publique
        para o catálogo.
      </p>

      <section style={card}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Informações gerais</h2>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Input
            label="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Introdução à Programação"
          />
          <Input
            label="Slug"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            hint="Sugerido a partir do título; usado na URL do curso."
          />
          <div>
            <label
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Resumo do que o aluno vai aprender."
              style={{
                width: '100%',
                marginTop: '0.3rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                fontFamily: 'inherit',
                fontSize: '0.95rem',
                resize: 'vertical',
              }}
            />
          </div>
          <Input
            label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ex.: Tecnologia"
          />
          <Input
            label="Tags"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            hint="Separe por vírgulas. Ex.: python, iniciante"
          />
          <Select
            label="Visibilidade"
            value={visibility}
            onChange={(e) =>
              setVisibility(e.target.value as 'public' | 'private')
            }
            options={[
              { value: 'public', label: 'Pública (aparece no catálogo)' },
              { value: 'private', label: 'Privada (somente você)' },
            ]}
          />
        </div>
      </section>

      {modules.map((module, mi) => {
        // Pre-existing module of a published course: locked against edits.
        const moduleLocked = contentLocked && isPersisted(module);
        return (
          <section
            key={mi}
            style={{
              ...card,
              borderLeft: `4px solid ${module.color ?? '#5b2a86'}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                Módulo {mi + 1}
              </h2>
              {modules.length > 1 &&
                !(contentLocked && isPersisted(module)) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setModules((prev) => prev.filter((_, i) => i !== mi))
                    }
                  >
                    Remover módulo
                  </Button>
                )}
            </div>
            <div
              style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}
            >
              <Input
                label="Título do módulo"
                value={module.title}
                onChange={(e) => updateModule(mi, { title: e.target.value })}
                disabled={moduleLocked}
              />
              <Input
                label="Descrição do módulo"
                value={module.description}
                onChange={(e) =>
                  updateModule(mi, { description: e.target.value })
                }
                disabled={moduleLocked}
              />
              <Input
                label="Cor"
                type="color"
                value={module.color ?? '#5b2a86'}
                onChange={(e) => updateModule(mi, { color: e.target.value })}
                style={{ width: '4rem', height: '2.5rem', padding: '0.2rem' }}
                disabled={moduleLocked}
              />
            </div>

            {module.lessons.map((lesson, li) => (
              <div
                key={li}
                style={{
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.9rem',
                  marginTop: '0.75rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong>Aula {li + 1}</strong>
                  {module.lessons.length > 1 && !moduleLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateModule(mi, {
                          lessons: module.lessons.filter((_, j) => j !== li),
                        })
                      }
                    >
                      Remover aula
                    </Button>
                  )}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: '0.6rem',
                    marginTop: '0.6rem',
                  }}
                >
                  <Input
                    label="Título da aula"
                    value={lesson.title}
                    onChange={(e) =>
                      updateLesson(mi, li, { title: e.target.value })
                    }
                    disabled={moduleLocked}
                  />
                  <div>
                    <label
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                      }}
                    >
                      Conteúdo (texto)
                    </label>
                    <textarea
                      value={lesson.content}
                      onChange={(e) =>
                        updateLesson(mi, li, { content: e.target.value })
                      }
                      disabled={moduleLocked}
                      rows={3}
                      style={{
                        width: '100%',
                        marginTop: '0.3rem',
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontFamily: 'inherit',
                        fontSize: '0.95rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                {lesson.questions.map((question, qi) => (
                  <div
                    key={qi}
                    style={{
                      background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.8rem',
                      marginTop: '0.6rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.9rem' }}>
                        Questão {qi + 1}
                      </strong>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {question.xpValue} XP
                      </span>
                      {!moduleLocked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            updateLesson(mi, li, {
                              questions: lesson.questions.filter(
                                (_, k) => k !== qi,
                              ),
                            })
                          }
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gap: '0.6rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <Select
                        label="Tipo"
                        value={question.type}
                        onChange={(e) => {
                          const type = e.target.value as QuestionType;
                          updateQuestion(mi, li, qi, {
                            type,
                            config: emptyConfigFor(type) as unknown as Json,
                            xpValue: defaultXpFor(type),
                          });
                        }}
                        options={QUESTION_TYPE_OPTIONS}
                        disabled={moduleLocked}
                      />
                      <Input
                        label="Enunciado"
                        value={question.prompt}
                        onChange={(e) =>
                          updateQuestion(mi, li, qi, { prompt: e.target.value })
                        }
                        disabled={moduleLocked}
                      />
                      <div
                        style={
                          moduleLocked
                            ? { pointerEvents: 'none', opacity: 0.6 }
                            : undefined
                        }
                        aria-disabled={moduleLocked || undefined}
                      >
                        <QuestionConfigEditor
                          type={question.type}
                          config={question.config}
                          onChange={(config) =>
                            updateQuestion(mi, li, qi, { config })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {!moduleLocked && (
                  <div style={{ marginTop: '0.6rem' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateLesson(mi, li, {
                          questions: [
                            ...lesson.questions,
                            emptyQuestion(
                              'multiple_choice',
                              lesson.questions.length,
                            ),
                          ],
                        })
                      }
                    >
                      + Adicionar questão
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {!moduleLocked && (
              <div style={{ marginTop: '0.75rem' }}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    updateModule(mi, {
                      lessons: [
                        ...module.lessons,
                        emptyLesson(module.lessons.length),
                      ],
                    })
                  }
                >
                  + Adicionar aula
                </Button>
              </div>
            )}
          </section>
        );
      })}

      <Button
        type="button"
        variant="ghost"
        onClick={() =>
          setModules((prev) => [...prev, emptyModule(prev.length)])
        }
      >
        + Adicionar módulo
      </Button>

      {formError && (
        <div style={{ marginTop: '1rem' }}>
          <ErrorText>{formError}</ErrorText>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.5rem',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          type="button"
          variant="ghost"
          loading={save.isPending}
          onClick={() => handleSave('draft')}
        >
          Salvar rascunho
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={save.isPending}
          onClick={() => handleSave('published')}
        >
          Publicar
        </Button>
      </div>
    </div>
  );
}

export default CreateCoursePage;
