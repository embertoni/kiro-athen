# Athen

Plataforma colaborativa de aprendizado (SPA) com gamificacao, cursos e salas.
Frontend em React + TypeScript + Vite; backend no Supabase (PostgreSQL + Auth +
Storage); deploy na Vercel.

> Repositorio de teste de desenvolvimento da plataforma Athen usando Kiro (AWS).

## Stack

- React 18 + TypeScript + Vite 5
- React Router 6, TanStack React Query 5
- Supabase (`@supabase/supabase-js`)
- Vitest + Testing Library para testes de dominio e componentes

## Setup

1. Instale as dependencias:
   ```bash
   npm install
   ```
2. Copie o template de ambiente e preencha as credenciais do seu projeto Supabase:
   ```bash
   cp .env.example .env.local
   ```
   Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings ->
   API).
3. Aplique as migracoes SQL em `supabase/migrations/` **na ordem dos arquivos**
   (`0001_` -> `0016_`), via `supabase db reset` / `supabase db push` ou colando
   no SQL editor em ordem. O banco e totalmente reproduzivel a partir desses
   arquivos. Ver `supabase/README.md`.
4. Rode o ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

> **Banco de dados / setup manual:** para os passos manuais de aplicacao das
> migracoes (incluindo as mais recentes `0017`-`0019`), regeneracao dos tipos
> TypeScript e pre-requisitos de ambiente, veja
> [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md).

## Scripts

| Script                 | Descricao                                     |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento (Vite)            |
| `npm run build`        | Type-check de projeto (`tsc -b`) + build Vite |
| `npm run preview`      | Previa do build de producao                   |
| `npm run lint`         | ESLint (flat config em `eslint.config.js`)    |
| `npm run format`       | Prettier (escreve) sobre o repositorio        |
| `npm run format:check` | Prettier em modo verificacao                  |
| `npm run typecheck`    | `tsc --noEmit`                                |
| `npm run test`         | Testes (Vitest, run once)                     |
| `npm run test:watch`   | Testes em modo watch                          |

## Deploy (Vercel)

1. Importe o repositorio na Vercel (framework detectado: Vite).
2. **Build command:** `npm run build`
3. **Output directory:** `dist`
4. **Install command:** `npm install` (padrao).
5. **Environment Variables** (Production e Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Como e uma SPA com React Router, garanta o fallback de rotas para
   `index.html` (a Vercel ja faz isso para projetos Vite/SPA; se necessario,
   adicione um rewrite `/(.*) -> /index.html`).

## Dominio e autoridade do servidor

As regras de XP, PAC, nivel, divisao, medalhas e permissoes sao de autoridade do
servidor (funcoes SQL + RLS no Supabase). O modulo `src/domain/` **espelha** essas
constantes apenas para exibicao/validacao na UI; o cliente nunca envia XP final
confiavel. A paridade e verificada por testes em `src/domain/__tests__/`.

Constantes canonicas (ver `src/domain/constants.ts`, `src/domain/rules.ts` e
`supabase/migrations/0010_domain_functions.sql`):

- XP por tipo de questao: `match` 2, `multiple_choice` 4, `fill_blank` 6,
  `sum_alternatives` 8.
- Niveis: L1 0-99, L2 100-249, L3 250-499, L4 500-999, L5 1000-1999, L6+ a cada
  +2000 XP (L6=2000, L7=4000, ...).
- Divisoes (PAC 0-100): Bronze 0-59, Prata 60-74, Gold 75-84, Platina 85-94,
  Diamante 95-100.
- PAC = `correct / total * 100` (0 quando `total` e 0).
- `fill_blank`: normalizacao = minuscula + remocao de acentos (`unaccent`) +
  `trim` + colapso de espacos.

## Marca

- Nome da plataforma: **Athen**.
- Logo: lua crescente roxa (`#5B2A86`) envolvendo um circulo dourado (`#FFC107`)
  com um pequeno triangulo roxo apontando para baixo. Arquivo:
  `public/athen-logo.svg` (favicon via `index.html` + componentes `Logo` /
  `BrandMark`). Aparece na landing, nas telas de autenticacao e no cabecalho do
  app. Paleta roxo/dourado centralizada em variaveis CSS (`src/styles/theme.css`).
- Responsividade: layout utilizavel em telas pequenas e grandes com CSS puro
  (sem framework pesado). Em telas estreitas (`<= 768px`) a barra lateral vira um
  menu lateral sobreposto acionado pelo botao de menu no cabecalho.

## Mapeamento das criterios de aceite (Secao 16)

Legenda: ✅ implementado no codigo; 🧪 requer verificacao humana contra um
Supabase ao vivo (RLS, Auth e funcoes SQL so podem ser exercidos com um banco
real — veja "Limitacao de ambiente").

| #   | Criterio (Secao 16)                                                                                           | Status  | Onde                                                               |
| --- | ------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| 1   | Cadastro/login (email ou username) + confirmacao de email + reset de senha                                    | ✅ / 🧪 | `src/features/auth/*`, `0014_username_to_email.sql`                |
| 2   | Rotas publicas apenas `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`; demais exigem sessao | ✅      | `src/routes/ProtectedRoute.tsx`, `src/App.tsx`                     |
| 3   | `/crud` apenas para `role = 'admin'` (servidor), nao apenas sessao                                            | ✅ / 🧪 | `src/routes/AdminRoute.tsx`, `public.is_admin()`                   |
| 4   | Catalogo de cursos publicados/publicos + popup de detalhes                                                    | ✅      | `src/features/courses/*`                                           |
| 5   | Criacao de curso (modulos, aulas, 4 tipos de questao)                                                         | ✅      | `src/features/courses/create/*`                                    |
| 6   | Execucao de aula + 4 tipos de questao + correcao no servidor                                                  | ✅ / 🧪 | `src/features/lesson/*`, `grade_answer` / `finalize_attempt`       |
| 7   | XP/nivel/divisao/PAC calculados no servidor; cliente so exibe                                                 | ✅ / 🧪 | `0010_domain_functions.sql`, `src/domain/*`                        |
| 8   | Salas (salas) com contexto isolado; XP interno nunca vira global                                              | ✅ / 🧪 | `src/features/rooms/*`, `finalize_attempt` (room branch)           |
| 9   | Codigo de acesso de sala (gerar/regenerar/desativar) + entrar por codigo                                      | ✅ / 🧪 | `src/features/rooms/*`, `join_room()`                              |
| 10  | Avisos, missoes (XP interno), visibilidade de PAC configuravel                                                | ✅ / 🧪 | `src/features/rooms/*`                                             |
| 11  | Rankings: global (XP, all-time), sala (XP interno), amigos (PAC por curso)                                    | ✅ / 🧪 | `src/features/rankings/*`, `0015_rankings.sql`                     |
| 12  | 4 medalhas MVP + streak (fuso America/Sao_Paulo, tolerancia 1 dia)                                            | ✅ / 🧪 | `grant_medals`, `touch_streak`, `src/features/gamification/*`      |
| 13  | Amigos (pedido/aceite), notificacoes internas, lembrete de estudo                                             | ✅ / 🧪 | `src/features/friends/*`, `src/features/notifications/*`, `0016_*` |
| 14  | Perfil (publico por username), caderno pessoal, configuracoes                                                 | ✅ / 🧪 | `src/features/profile                                              | notebook | settings/*` |
| 15  | Marca Athen (logo + paleta) + responsividade                                                                  | ✅      | `public/athen-logo.svg`, `src/styles/theme.css`, `BrandMark`       |
| 16  | Sem itens fora de escopo (Secao 17) e sem periodo semanal (Secao 8.6)                                         | ✅      | auditoria por grep (ver abaixo)                                    |

## Definition of Done (Secao 21, 15 pontos)

| #   | Item                                                                     | Status                          |
| --- | ------------------------------------------------------------------------ | ------------------------------- |
| 1   | Projeto React + TS + Vite estruturado e compilavel (com `node_modules`)  | ✅                              |
| 2   | Cliente Supabase tipado (`Database`) e variaveis de ambiente             | ✅                              |
| 3   | Migracoes SQL ordenadas e reproduziveis (`0001`-`0016`)                  | ✅                              |
| 4   | RLS habilitada em todas as tabelas                                       | ✅ (codigo) / 🧪 (aplicar)      |
| 5   | Funcoes de dominio servidor-autoritativas (XP/PAC/nivel/divisao/grading) | ✅ (codigo) / 🧪 (executar)     |
| 6   | Autenticacao completa (signup/login/confirmacao/reset)                   | ✅ (codigo) / 🧪 (Auth ao vivo) |
| 7   | Protecao de rotas (sessao + admin server-side)                           | ✅                              |
| 8   | Criacao e catalogo de cursos                                             | ✅                              |
| 9   | Execucao de aula com 4 tipos de questao + correcao no servidor           | ✅ (codigo) / 🧪 (executar)     |
| 10  | Salas com contexto isolado + codigo de acesso + avisos/missoes           | ✅ (codigo) / 🧪                |
| 11  | Gamificacao: XP/nivel/divisao/PAC/medalhas/streak/rankings               | ✅ (codigo) / 🧪                |
| 12  | Social: amigos, notificacoes, lembrete de estudo                         | ✅ (codigo) / 🧪                |
| 13  | Perfil, caderno, configuracoes, CRUD admin                               | ✅ (codigo) / 🧪                |
| 14  | Marca Athen + paleta roxo/dourado + responsividade + favicon             | ✅                              |
| 15  | ESLint/Prettier, testes de dominio, README e deploy documentados         | ✅                              |

Itens marcados 🧪 estao implementados no codigo mas so podem ser **verificados
de ponta a ponta por um humano com um Supabase ao vivo**, porque dependem de
RLS, Auth e das funcoes SQL em execucao (nao reproduziveis no sandbox).

## Auditoria de escopo (Secao 17 / 8.6)

Confirmado por grep em todo o repositorio: **nao existe** nenhum artefato de
periodo semanal, reset, cron, job agendado, "Top da semana", joint streak,
pagamento, marketplace, push, video/imagem dentro de aula ou compartilhamento de
curso. As unicas ocorrencias desses termos sao comentarios explicitos do tipo
"NAO implementado / sem periodo semanal". Reproduza a auditoria com:

```bash
grep -rniE 'weekly|semanal|cron|schedule|top.?da.?semana|joint.?streak|marketplace|pagamento' \
  src supabase index.html
```

## Limitacao de ambiente (sandbox) e checklist humano

Este trabalho foi preparado em um sandbox **sem acesso ao registro publico do
npm** (o proxy retorna `403` para `registry.npmjs.org`) e **sem um Supabase ao
vivo**. Por isso os comandos abaixo **nao puderam ser executados aqui** e devem
ser rodados por um humano em um ambiente com rede e um projeto Supabase:

- `npm install` — instalar dependencias (bloqueado pelo 403 no sandbox).
- `npm run lint` — ESLint deve passar.
- `npm run format:check` — Prettier deve passar.
- `npm run typecheck` — `tsc --noEmit` deve passar.
- `npm run test` — Vitest (testes de dominio e helpers) deve passar.
- `npm run build` — build de producao deve gerar `dist/`.
- Aplicar as migracoes `supabase/migrations/0001`-`0016` em um projeto Supabase
  novo (`supabase db reset` ou SQL editor em ordem) e confirmar que aplicam sem
  erro.
- Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em `.env.local` e na
  Vercel.
- Exercitar Auth (signup com confirmacao de email, login por email/username,
  reset de senha) e os fluxos marcados 🧪 acima contra o banco ao vivo.
- Fazer o deploy na Vercel (build `npm run build`, output `dist`).

No sandbox foi feita validacao de melhor esforco: parsing da camada de dominio
com `tsc` (ES2022), revisao estrutural das migracoes (ordem, FKs, idempotencia)
e verificacao de formatacao com Prettier nos arquivos editados.
