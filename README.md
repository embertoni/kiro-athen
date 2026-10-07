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
   Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Project Settings -> API).
3. Aplique as migracoes SQL em `supabase/migrations/` (via `supabase db push` ou
   colando no SQL editor na ordem dos arquivos). _As migracoes chegam em features
   posteriores._
4. Rode o ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

## Scripts

| Script              | Descricao                                 |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento (Vite)        |
| `npm run build`     | Type-check de projeto + build de producao |
| `npm run preview`   | Previa do build de producao               |
| `npm run lint`      | ESLint                                     |
| `npm run typecheck` | `tsc --noEmit`                            |
| `npm run test`      | Testes (Vitest, run once)                 |
| `npm run test:watch`| Testes em modo watch                      |

## Deploy (Vercel)

- Build command: `npm run build`
- Output directory: `dist`
- Variaveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Dominio e autoridade do servidor

As regras de XP, PAC, nivel, divisao, medalhas e permissoes sao de autoridade do
servidor (funcoes SQL + RLS no Supabase). O modulo `src/domain/` **espelha** essas
constantes apenas para exibicao/validacao na UI; o cliente nunca envia XP final
confiavel.

Constantes canonicas (ver `src/domain/constants.ts` e `src/domain/rules.ts`):

- XP por tipo de questao: `match` 2, `multiple_choice` 4, `fill_blank` 6,
  `sum_alternatives` 8.
- Niveis: L1 0-99, L2 100-249, L3 250-499, L4 500-999, L5 1000-1999, L6+ a cada
  +2000 XP.
- Divisoes (PAC 0-100): Bronze 0-59, Prata 60-74, Gold 75-84, Platina 85-94,
  Diamante 95-100.
- PAC = `correct / total * 100` (0 quando `total` e 0).

## Marca

- Nome da plataforma: **Athen**.
- Logo: lua crescente roxa (`#5B2A86`) envolvendo um circulo dourado (`#FFC107`)
  com um pequeno triangulo roxo apontando para baixo. Arquivo:
  `public/athen-logo.svg` (favicon + componente `Logo`). Paleta roxo/dourado.

## Limitacao de ambiente (sandbox)

No sandbox de desenvolvimento o registro publico do npm fica bloqueado (proxy
retorna 403), entao `npm install`, `vite build` e `vitest` nao rodam ali. Os
arquivos de configuracao e codigo-fonte estao corretos; execute os comandos acima
em um ambiente com acesso ao registro npm.
