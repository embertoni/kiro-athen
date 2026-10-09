import type {
  FillBlankConfig,
  MatchConfig,
  MultipleChoiceConfig,
  SumAlternativesConfig,
} from '@/types/domain';
import type { QuestionType } from '@/types/db';
import type { Json } from '@/types/db';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { expectedSum, newOptionId } from '../questionConfig';

interface QuestionConfigEditorProps {
  type: QuestionType;
  config: Json;
  onChange: (config: Json) => void;
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  marginBottom: '0.5rem',
};

/**
 * Per-type configuration editor. Emits config in the exact jsonb shape the SQL
 * grader reads (see src/types/domain.ts / questionConfig.ts).
 */
export function QuestionConfigEditor({
  type,
  config,
  onChange,
}: QuestionConfigEditorProps) {
  if (type === 'match') {
    const c = config as unknown as MatchConfig;
    const pairs = c.pairs ?? [];
    return (
      <div>
        <p style={labelHint}>Associe cada item da esquerda ao da direita.</p>
        {pairs.map((pair, i) => (
          <div key={i} style={rowStyle}>
            <Input
              placeholder="Esquerda"
              value={pair.left}
              onChange={(e) => {
                const next = pairs.map((p, j) =>
                  j === i ? { ...p, left: e.target.value } : p,
                );
                onChange({ pairs: next } as unknown as Json);
              }}
            />
            <span aria-hidden>↔</span>
            <Input
              placeholder="Direita"
              value={pair.right}
              onChange={(e) => {
                const next = pairs.map((p, j) =>
                  j === i ? { ...p, right: e.target.value } : p,
                );
                onChange({ pairs: next } as unknown as Json);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  pairs: pairs.filter((_, j) => j !== i),
                } as unknown as Json)
              }
              aria-label="Remover par"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              pairs: [...pairs, { left: '', right: '' }],
            } as unknown as Json)
          }
        >
          + Adicionar par
        </Button>
      </div>
    );
  }

  if (type === 'multiple_choice') {
    const c = config as unknown as MultipleChoiceConfig;
    const options = c.options ?? [];
    return (
      <div>
        <p style={labelHint}>
          Marque uma ou mais alternativas corretas. A correção exige o conjunto
          exato.
        </p>
        {options.map((opt, i) => (
          <div key={opt.id} style={rowStyle}>
            <input
              type="checkbox"
              checked={opt.correct}
              aria-label="Correta"
              onChange={(e) => {
                const next = options.map((o, j) =>
                  j === i ? { ...o, correct: e.target.checked } : o,
                );
                onChange({ options: next } as unknown as Json);
              }}
            />
            <Input
              placeholder={`Alternativa ${i + 1}`}
              value={opt.text}
              onChange={(e) => {
                const next = options.map((o, j) =>
                  j === i ? { ...o, text: e.target.value } : o,
                );
                onChange({ options: next } as unknown as Json);
              }}
              style={{ flex: 1 }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  options: options.filter((_, j) => j !== i),
                } as unknown as Json)
              }
              aria-label="Remover alternativa"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              options: [
                ...options,
                { id: newOptionId(), text: '', correct: false },
              ],
            } as unknown as Json)
          }
        >
          + Adicionar alternativa
        </Button>
      </div>
    );
  }

  if (type === 'fill_blank') {
    const c = config as unknown as FillBlankConfig;
    const answers = c.answers ?? [];
    return (
      <div>
        <p style={labelHint}>
          Use o enunciado para indicar a lacuna. Liste todas as respostas
          aceitas (comparação ignora acentos, maiúsculas e espaços extras).
        </p>
        {answers.map((answer, i) => (
          <div key={i} style={rowStyle}>
            <Input
              placeholder={`Resposta aceita ${i + 1}`}
              value={answer}
              onChange={(e) => {
                const next = answers.map((a, j) =>
                  j === i ? e.target.value : a,
                );
                onChange({ answers: next } as unknown as Json);
              }}
              style={{ flex: 1 }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  answers: answers.filter((_, j) => j !== i),
                } as unknown as Json)
              }
              aria-label="Remover resposta"
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({ answers: [...answers, ''] } as unknown as Json)
          }
        >
          + Adicionar resposta aceita
        </Button>
      </div>
    );
  }

  // sum_alternatives
  const c = config as unknown as SumAlternativesConfig;
  const statements = c.statements ?? [];
  const sum = expectedSum(c);
  return (
    <div>
      <p style={labelHint}>
        Numere as afirmativas com valores (ex.: 1, 2, 4, 8...) e marque as
        corretas. A soma esperada é calculada automaticamente.
      </p>
      {statements.map((st, i) => (
        <div key={i} style={rowStyle}>
          <input
            type="checkbox"
            checked={st.correct}
            aria-label="Correta"
            onChange={(e) => {
              const next = statements.map((s, j) =>
                j === i ? { ...s, correct: e.target.checked } : s,
              );
              onChange({ statements: next } as unknown as Json);
            }}
          />
          <Input
            type="number"
            value={st.value}
            aria-label={`Valor da afirmativa ${i + 1}`}
            onChange={(e) => {
              const next = statements.map((s, j) =>
                j === i ? { ...s, value: Number(e.target.value) || 0 } : s,
              );
              onChange({ statements: next } as unknown as Json);
            }}
            style={{ width: '6rem' }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                statements: statements.filter((_, j) => j !== i),
              } as unknown as Json)
            }
            aria-label="Remover afirmativa"
          >
            ✕
          </Button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              statements: [...statements, { value: 1, correct: false }],
            } as unknown as Json)
          }
        >
          + Adicionar afirmativa
        </Button>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Soma esperada: <strong>{sum}</strong>
        </span>
      </div>
    </div>
  );
}

const labelHint: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.82rem',
  color: 'var(--color-text-muted)',
};

export default QuestionConfigEditor;
