# SKILL: casinha_consulta
description: Consulta saldo por categoria de orçamento, itens em falta no estoque e listas de compras abertas do Casinha Hub, pra responder perguntas no grupo de WhatsApp da família.
triggers:
  - pergunta sobre quanto ainda dá pra gastar numa categoria ("quanto sobrou de alimentação esse mês?")
  - pergunta sobre o que está em falta em casa ("o que tá acabando?", "falta algo?")
  - pergunta sobre a lista de compras ("o que tá na lista de compras?", "já tem lista feita?")

---

## Objetivo

Dar ao Hermes um caminho de **leitura** dos dados do Casinha Hub — orçamento,
estoque e compras — pra responder no grupo sem precisar abrir o app. Só
leitura: esta skill não grava nada no Casinha Hub (ao contrário do
`sime_updater`/`sime_mesarios` do Sime, que também escrevem).

## Endpoint alvo

```
POST https://<seu-deploy>.vercel.app/api/hermes-consulta
Authorization: Bearer <HERMES_SECRET_CASINHA>
Content-Type: application/json
```

O Casinha Hub é de uma família só — o Bearer não seleciona família (diferente
do Sime, que tem uma zona por segredo); o endpoint já sabe qual família
responder via `HERMES_FAMILY_ID` configurada no servidor.

## Ações

### 1. `saldo_categorias` — orçamento vs. gasto do mês
```json
{ "acao": "saldo_categorias", "mes": "2026-08" }
```
`mes` é opcional (formato `YYYY-MM`); default é o mês atual.

Resposta:
```json
{
  "ok": true,
  "mes": "2026-08",
  "categorias": [
    { "nome": "Alimentação", "planejado": 800, "gasto": 650, "saldo": 150,
      "pct_atingido": 81.25, "essencial": true }
  ],
  "resumo_wa": "💰 Saldo por categoria (2026-08):\n🟢 Alimentação: R$ 150,00 restante de R$ 800,00 (81% usado)\n..."
}
```
`saldo` negativo = categoria estourou o orçamento do mês.

### 2. `estoque` — itens em falta ou quase acabando
```json
{ "acao": "estoque" }
```
Por padrão devolve só itens com `status` `baixo` ou `critico` (evita listar os
~200 itens com status `ok`/`zerado` inativo). Pra ver tudo:
```json
{ "acao": "estoque", "todos": true }
```

Resposta:
```json
{
  "ok": true,
  "itens": [
    { "nome": "Arroz", "categoria": "Grãos", "estoque_atual": 2, "unidade": "kg",
      "status": "baixo", "dias_restantes": 3, "sugestao_compra": 5 }
  ],
  "resumo_wa": "📦 Estoque (baixo/crítico):\n🟡 Arroz: 2 kg (~3 dias) — repor 5 kg\n..."
}
```
Sem itens críticos/baixos → `resumo_wa` diz "Nada em falta — estoque OK. ✅".

### 3. `lista_compras` — listas abertas e seus itens pendentes
```json
{ "acao": "lista_compras" }
```
Devolve listas com status `aberta` ou `em_andamento` (não traz `concluida`).

Resposta:
```json
{
  "ok": true,
  "listas": [
    { "nome": "Compras da semana", "status": "aberta", "total_estimado": 120.5,
      "itens_pendentes": ["Arroz (5 kg)", "Leite (2 L)"] }
  ],
  "resumo_wa": "🛒 Compras da semana (aberta):\n  • Arroz (5 kg)\n  • Leite (2 L)\n  Total estimado: R$ 120,50"
}
```
Sem lista aberta → `resumo_wa` diz "Nenhuma lista de compras aberta no momento."

## Fluxo típico

```
1. Alguém no grupo pergunta "quanto sobrou de mercado esse mês?"
2. casinha_consulta {acao:'saldo_categorias'}
3. Hermes identifica a categoria perguntada na resposta e devolve só aquela
   linha (ou resumo_wa inteiro, se a pergunta for genérica: "como tá o orçamento?")
```

## CRÍTICO

- Só leitura — esta skill nunca grava no Casinha Hub. Perguntas do tipo "marca
  X como comprado" ou "adiciona Y na lista" ficam fora de escopo até existir
  uma skill de escrita equivalente (ver observação abaixo).
- `HERMES_FAMILY_ID` e `HERMES_SECRET_CASINHA` são segredos — nunca aparecem
  em mensagem nem em log de fora do servidor.
- `resumo_wa` já vem formatado pra WhatsApp; prefira devolver ele quase
  verbatim em vez de reconstruir a partir de `categorias`/`itens`/`listas` —
  reduz risco do modelo errar formatação/matemática.
- Se `ok:false` ou erro HTTP, avise no grupo que não conseguiu consultar agora
  e sugira tentar de novo — nunca invente saldo/estoque.

## Escopo futuro (não implementado)

Ações de escrita (marcar item como comprado, adicionar item na lista) exigiriam
uma skill nova com seu próprio endpoint (`/api/hermes-atualiza`, por exemplo),
seguindo o mesmo padrão de auth. Fora de escopo desta skill.
