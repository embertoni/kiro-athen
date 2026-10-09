# Setup manual do banco de dados (Supabase)

Este documento lista os passos **manuais** necessarios para garantir que o banco
Supabase esta atualizado e pronto para a versao atual da pagina, em especial
para a nova UI de edicao de cursos. Todos os passos sao especificos deste
repositorio e referenciam arquivos reais em `supabase/`.

> **Limitacao de ambiente.** Nenhum destes passos pode ser executado ou
> verificado no sandbox: nao ha um Supabase ao vivo aqui. RLS, triggers e
> funcoes SQL so podem ser exercitados contra um projeto real e **precisam ser
> rodados por um humano** nesse ambiente. No sandbox foi feita apenas revisao
> estrutural das migracoes (ordem, FKs, idempotencia).

## 1. Pre-requisitos de ambiente (`.env`)

O cliente Supabase le as credenciais das variaveis de ambiente do Vite. O
template esta em `.env.example`, que contem exatamente:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

1. Copie o template e preencha com as credenciais do seu projeto (Supabase ->
   Project Settings -> API):

   ```bash
   cp .env.example .env.local
   ```

2. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local`.

3. As mesmas variaveis precisam estar definidas no ambiente de deploy
   (**Vercel** -> Project Settings -> Environment Variables, para Production e
   Preview), conforme o `README.md`.

> `src/lib/supabase.ts` lanca um erro no startup se qualquer uma das duas
> variaveis estiver ausente (mensagem: `Missing Supabase env vars. Copy
.env.example to .env.local and set VITE_SUPABASE_URL and
VITE_SUPABASE_ANON_KEY.`), entao a falta de configuracao falha de forma
> visivel, nao silenciosa.

## 2. Aplicar as migracoes na ordem dos arquivos

O banco e **totalmente reproduzivel a partir dos arquivos SQL ordenados** em
`supabase/migrations/`. A **ordem importa**: migracoes posteriores referenciam
objetos criados antes (enums, FKs, funcoes, policies). Aplique sempre na ordem
do nome do arquivo.

O conjunto atual de migracoes neste repositorio e `0001_` ate `0019_`:

| Arquivo                                             | Conteudo (resumo)                                        |
| --------------------------------------------------- | -------------------------------------------------------- |
| `0001_extensions_and_enums.sql`                     | `pgcrypto`, `citext`, `unaccent`; enums                  |
| `0002_profiles.sql`                                 | `profiles` + `handle_new_user()`                         |
| `0003_courses_modules_lessons_questions.sql`        | hierarquia de conteudo dos cursos                        |
| `0004_enrollments_attempts_answers_completions.sql` | atividade de aprendizado + auditoria                     |
| `0005_rooms_members_announcements_missions.sql`     | salas                                                    |
| `0006_social_friendships_notifications.sql`         | grafo social                                             |
| `0007_medals_user_medals.sql`                       | catalogo de medalhas + premiacoes                        |
| `0008_reviews_comments.sql`                         | avaliacoes + comentarios                                 |
| `0009_notebook.sql`                                 | caderno pessoal                                          |
| `0010_domain_functions.sql`                         | funcoes de dominio servidor-autoritativas                |
| `0011_rls_policies.sql`                             | RLS habilitada + policies em todas as tabelas            |
| `0012_triggers.sql`                                 | new-user, updated_at, imutabilidade de role etc.         |
| `0013_seed.sql`                                     | catalogo de medalhas (obrigatorio) + demo opcional       |
| `0014_username_to_email.sql`                        | `resolve_login_email()` para login por username          |
| `0015_rankings.sql`                                 | view `global_ranking` + `friends_course_pac()`           |
| `0016_notifications_social_account.sql`             | preferencias de notificacao + funcoes de notificacao     |
| `0017_enroll_own_course.sql`                        | self-enroll no proprio curso (ver secao 3)               |
| `0018_no_xp_for_already_correct.sql`                | anti-regrind de XP (ver secao 3)                         |
| `0019_course_edit_gating.sql`                       | gating de edicao de curso + `published_at` (ver secao 3) |

> O `README.md` e o `supabase/README.md` ainda citam faixas antigas (ate `0015`
> / `0016`). A faixa real e correta e `0001` -> `0019`.

### Opcao A: Supabase CLI (recomendada)

```bash
supabase db reset          # banco local do zero, aplica TODAS as migracoes em ordem
# ou, contra um projeto ja vinculado (linked):
supabase db push
```

- `supabase db reset` recria o banco local e, com `[db.migrations] enabled` e
  `[db.seed] enabled` (ver `supabase/config.toml`), aplica todas as migracoes em
  ordem e roda `./seed.sql` ao final.
- `supabase db push` aplica as migracoes pendentes contra o projeto remoto
  vinculado.

O `supabase/config.toml` fixa `project_id = "kiro-athen"` e
`major_version = 17` (a versao major do Postgres remoto precisa ser a mesma).
Localmente `auth.email.enable_confirmations = false`, entao o signup nao exige
confirmacao de email no stack local.

### Opcao B: SQL editor (fallback)

Abra cada arquivo de `supabase/migrations/` **na ordem do nome** (`0001_` ->
`0019_`) e execute o conteudo no SQL editor do Supabase, um de cada vez, do
menor para o maior. Nao pule nenhum e nao altere a ordem.

## 3. Migracoes recentes que a pagina atual depende

As tres migracoes mais novas mudam comportamento/estrutura e **precisam estar
aplicadas** para a versao atual da pagina funcionar corretamente.

### `0017_enroll_own_course.sql`: matricular no proprio curso

Redefine a policy RLS `enrollments_insert_own` para que um usuario possa se
matricular tambem em um curso **que ele mesmo criou** (inclusive rascunho e/ou
privado), alem do caminho publico + publicado que ja valia para todos. Sem isso,
o criador nao consegue se matricular/finalizar a partir da aba "Criados por mim"
do catalogo no proprio curso.

### `0018_no_xp_for_already_correct.sql`: anti-regrind de XP

Faz `create or replace` de `finalize_attempt(uuid)`: se o usuario ja respondeu
**aquela questao corretamente** em uma tentativa anterior ja finalizada, a
questao passa a conceder **0 XP** ao ser respondida de novo. O `is_correct`
continua registrado de forma fiel (entao `correct_count` / `total_count`
permanecem corretos); apenas o `xp_earned` (por resposta e o somatorio da
tentativa que alimenta `profiles.xp_global` / `room_members.xp_internal`) exclui
questoes ja corretas. Vale tanto no contexto de curso quanto de sala.

### `0019_course_edit_gating.sql`: gating da edicao de curso

E a migracao que habilita a nova UI de edicao de cursos (FEAT-001). Ela:

- Adiciona a coluna `courses.published_at` (`timestamptz`, nullable) com
  `add column if not exists` e faz um **backfill idempotente** das linhas ja
  publicadas (usando `coalesce(updated_at, created_at)`).
- Cria a funcao + trigger `set_course_published_at` (BEFORE INSERT OR UPDATE em
  `courses`): carimba `published_at := now()` a cada transicao para `published`
  e limpa quando o status deixa de ser `published`, mantendo coerente o ciclo
  rascunho -> publicado -> rascunho -> publicado.
- Substitui as policies `FOR ALL *_write` de `0011` por policies **separadas de
  INSERT / UPDATE / DELETE** em `modules`, `lessons` e `questions`.

Comportamento resultante (com `public.is_admin()` sobrepondo tudo):

- **Curso em rascunho** (`status = 'draft'`): totalmente editavel pelo criador,
  podendo inserir, atualizar e remover qualquer modulo/aula/questao.
- **Curso publicado** (`status = 'published'`): pode receber **novos modulos**
  (e novas aulas/questoes dentro desses modulos novos, identificados por
  `modules.created_at > courses.published_at`), mas todo conteudo que ja existia
  na publicacao e **imutavel**: sem UPDATE e sem DELETE, e sem INSERT de
  aulas/questoes sob modulos anteriores a publicacao.

## 4. Regenerar os tipos TypeScript apos a `0019`

A `0019` adiciona a coluna `courses.published_at`, o que muda o shape do tipo
`Database` gerado. **Depois de aplicar a `0019`**, regenere os tipos:

```bash
# contra um projeto remoto (use a project ref do seu projeto Supabase):
supabase gen types typescript --project-id <project-ref> > src/types/database.ts

# ou contra o stack local (supabase start / db reset):
supabase gen types typescript --local > src/types/database.ts
```

- `src/types/database.ts` reflete o schema vivo e **nao deve ser editado a mao**:
  regenere pelo comando acima para mante-lo fiel as migracoes.
- O build TypeScript continua verde contra o shape gerado por causa do shim
  `NormalizeDatabase` em `src/types/supabase-compat.ts` (usado por
  `src/lib/supabase.ts`).
- O codigo cliente **nao consulta `published_at` diretamente** (o gating da UI e
  dirigido por `courses.status`, que ja existia); ainda assim, regenerar os
  tipos mantem `database.ts` fiel ao schema real.

## 5. Checklist final (humano, contra um Supabase ao vivo)

1. `.env.local` preenchido com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (e as mesmas variaveis definidas na Vercel).
2. Migracoes `0001` -> `0019` aplicadas em ordem (`supabase db reset` /
   `supabase db push`, ou SQL editor em ordem) sem erro.
3. Tipos regenerados com `supabase gen types` apos a `0019`.
4. Exercitar manualmente o que depende de RLS/triggers/funcoes SQL: criar curso
   (rascunho totalmente editavel), publicar, confirmar que o curso publicado so
   aceita novos modulos e que o conteudo anterior fica imutavel; matricular-se
   no proprio curso; confirmar que respostas ja corretas nao concedem XP de
   novo. Esses fluxos **nao sao reproduziveis no sandbox** e precisam de um
   banco real.
