# Casinha Hub × Securo — comparativo técnico

Comparação entre este projeto e [securo-finance/securo](https://github.com/securo-finance/securo)
(AGPL-3.0, self-hosted, v0.14.4 na data desta análise).

## Resumo

Os dois resolvem problemas diferentes que se sobrepõem parcialmente. **Securo** é um
gerenciador de finanças pessoais self-hosted, com foco em soberania de dados e
integração bancária. **Casinha Hub** é um hub de gestão doméstica — finanças são um
dos módulos, ao lado de estoque, compras, manutenção, veículos e rotina da família.

Securo é mais profundo em finanças; Casinha Hub é mais largo em domínio doméstico e
muito mais leve de operar.

## Arquitetura

| | Casinha Hub | Securo |
|---|---|---|
| Topologia | SPA + BaaS (sem backend próprio) | Frontend + backend + worker + Postgres + Redis |
| Backend | Supabase (Postgres, Auth, RLS) | FastAPI + SQLAlchemy 2 + Alembic + Celery |
| Frontend | React 19, Vite, TanStack Router/Query, Tailwind 4, shadcn/Radix | React 19, Vite, React Router 7, TanStack Query, Tailwind 4, Radix |
| Autorização | RLS no Postgres, escopo por família | Camada de serviço no backend, escopo por workspace |
| Deploy | Vercel + Cloudflare (`vercel.json`, `wrangler.jsonc`) | Docker Compose, imagens GHCR, Helm chart |
| Multi-tenant | `families` / `family_members` | `workspaces` / `groups` |

O padrão comum às duas bases: React 19 + Vite + Tailwind 4 + Radix + TanStack Query.
A divergência real é o backend — Casinha Hub fala direto com o Postgres via
`supabase-js`, Securo tem ~434 arquivos Python entre `api/`, `services/`, `models/`,
`providers/` e `agents/`.

## Escopo funcional

**Só no Casinha Hub:** estoque com consumo médio e alertas de validade, listas de
compras que alimentam o estoque, manutenção da casa, veículos e abastecimento
(`gasolina`, `vehicle_maintenance_*`, `fuel_fills`), revisão semanal, modo crise
(`crisis_events`, `crisis_stage_history`), DRE doméstico, parcelamentos
(`installment_plans`/`installments`), histórico de preços de produtos.

**Só no Securo:** import de arquivos (OFX/QIF/CAMT/CSV), sincronização bancária via
Pluggy / Enable Banking / SimpleFIN, multi-moeda com FX automático, gestão de ativos
com valorização (inclusive Tesouro Direto), metas de poupança, splits e liquidação
entre pessoas, 2FA TOTP e passkeys, login OIDC, painel admin, i18n, backup
criptografado, agentes de IA self-hosted com RAG e MCP server.

**Nos dois:** contas, transações, categorias, orçamentos, recorrentes, regras de
categorização, faturas de cartão, relatórios, IA sobre os dados próprios.

## Engenharia

A diferença mais relevante não é de features, é de processo.

| | Casinha Hub | Securo |
|---|---|---|
| Testes | nenhum | 134 arquivos de teste no backend + Vitest no frontend |
| CI | nenhum | 4 workflows (CI, release, badge, prepare-release) |
| Migrations | 20+ SQL gerados pelo Lovable, nomes por UUID | Alembic versionado |
| Versionamento | sem releases | versão semântica, changelog, imagens publicadas |
| Contribuição | — | CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, pre-commit, Renovate |

## IA

Casinha Hub usa a API da Anthropic para análise pontual (ex.: `crisis-ai-analysis`),
consumindo dados reais via Supabase. Securo tem uma camada de agentes com registry de
provedores (Anthropic, OpenAI, Ollama, OpenAI-compatible), executor com tool-use, base
de conhecimento RAG com pgvector e embeddings locais, e um MCP server dedicado.

A abordagem do Securo é a mais próxima do que o roadmap do Casinha Hub descreve como
"IA doméstica com contexto completo da casa".

## O que vale trazer

Em ordem de custo/benefício, mantendo a arquitetura Supabase atual:

1. **Testes e CI.** Hoje não há nenhuma rede de segurança. Vitest nas regras de
   negócio (consumo médio, recálculo de estoque, geração de recorrentes) e um workflow
   rodando lint + build + testes já mudariam o patamar.
2. **Import de extrato (OFX/CSV).** É o maior atrito de entrada de dados no Casinha
   Hub hoje, e a peça do Securo mais reaproveitável conceitualmente.
3. **Motor de regras de categorização.** Já existe `categorization_rules`; o
   `rule_engine` do Securo é uma referência boa de como estruturar condições e ações.
4. **Camada de agentes com tool-use.** Substituir a chamada pontual de IA por um
   executor com ferramentas sobre os dados da casa.
5. **Migrations com nomes descritivos.** Os UUIDs gerados pelo Lovable tornam o
   histórico do schema ilegível.
6. **Sync bancário via Pluggy.** Alto valor no contexto brasileiro, mas exige um
   backend com segredos — provavelmente uma Edge Function do Supabase.

## Licença

Securo é AGPL-3.0: reaproveitar código dele obriga o Casinha Hub a abrir o próprio
código sob a mesma licença. As recomendações acima são de **padrões e arquitetura**,
não de cópia de código.
