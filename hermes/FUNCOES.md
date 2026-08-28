# Hermes Agent × Casinha Hub — referência completa

Documento de referência com todas as funções que o Hermes (agente de
WhatsApp) tem hoje para conversar com o Casinha Hub, e como essa comunicação
funciona por baixo dos panos. Para a configuração passo a passo, ver
`README.md`; para os arquivos que o próprio Hermes lê (formato de skill,
com regras de confirmação e ambiguidade), ver `CASINHA_hermes_skill_consulta.md`
e `CASINHA_hermes_skill_atualiza.md`. Este arquivo é o mapa geral.

## Como a comunicação funciona

```
                 ┌─────────────────────────┐
  grupo WhatsApp │   Hermes Agent           │
  da família ───▶│   (Raspberry Pi, Baileys)│
                 └───────────┬─────────────┘
                              │ POST HTTPS
                              │ Authorization: Bearer <HERMES_SECRET_CASINHA>
                              ▼
                 ┌─────────────────────────┐
                 │ Vercel (casinha-flow)    │
                 │  /api/hermes-consulta    │  ← só leitura
                 │  /api/hermes-atualiza    │  ← leitura + escrita
                 └───────────┬─────────────┘
                              │ service role (ignora RLS)
                              ▼
                 ┌─────────────────────────┐
                 │ Supabase (Postgres)      │
                 │ mmqoyozyeidxbgbxqnda     │
                 └─────────────────────────┘
```

- **Quem inicia a conexão**: sempre o Hermes. Os dois endpoints são
  serverless functions públicas na Vercel, mas protegidas por um segredo
  fixo — o Casinha Hub nunca abre conexão de volta pro Hermes nem sabe que
  ele existe além de receber esses POSTs.
- **Autenticação**: header `Authorization: Bearer <HERMES_SECRET_CASINHA>`
  em toda chamada. Sem o header certo, `401`. Não existe segredo por
  família (diferente do projeto irmão Sime, que é multi-tenant) — o
  Casinha Hub é de uma família só.
- **Qual família responder**: nunca vem no corpo da requisição. Os
  endpoints leem `HERMES_FAMILY_ID` (env var da Vercel) e usam esse UUID
  fixo pra toda consulta/gravação — impede alguém pedir dado de outra
  família mesmo com o segredo certo.
- **Quem fica registrado como autor**: ações de escrita usam
  `HERMES_USER_ID` (outra env var) como `user_id` da transação/movimento —
  o perfil "dono" de tudo que o Hermes lança.
- **Acesso ao banco**: os dois endpoints usam a `SUPABASE_SERVICE_ROLE_KEY`,
  que ignora Row Level Security. Isso significa que a filtragem por família
  é responsabilidade inteira do código do endpoint (via `HERMES_FAMILY_ID`),
  não da policy do banco.
- **Formato de resposta**: toda resposta é JSON e inclui um campo
  `resumo_wa` — texto já formatado pra colar quase verbatim na mensagem de
  WhatsApp (emojis, valores em R$, tudo pronto). Isso existe pra reduzir o
  risco do modelo do Hermes errar formatação ou matemática ao reconstruir a
  resposta.
- **Ambiguidade — nunca adivinha**: quando um nome (lista, conta, veículo,
  categoria, produto) bate com mais de uma opção, ou nenhum foi dado e
  existe mais de uma, a resposta é `{"ok": false, "ambiguo": true,
  "opcoes": [...], "mensagem_wa": "..."}`. Quando não bate com nada:
  `{"ok": false, "naoEncontrado": true, "mensagem_wa": "..."}`. Em ambos os
  casos o Hermes devolve a `mensagem_wa` pra pessoa e espera ela
  especificar — nunca escolhe sozinho.
- **Confirmação antes de escrever**: `/api/hermes-consulta` não precisa,
  é só leitura. `/api/hermes-atualiza` grava direto quando chamado — a
  responsabilidade de confirmar com a pessoa antes de chamar é do Hermes
  (do lado da skill/prompt), o endpoint em si não tem etapa de
  confirmação própria.

## Endpoint 1 — `/api/hermes-consulta` (só leitura)

Arquivo: `api/hermes-consulta.ts`. Nunca grava nada no Casinha Hub.

| Ação | O que faz | Parâmetros |
|---|---|---|
| `saldo_categorias` | Orçamento planejado vs. gasto real do mês, por categoria | `mes` opcional (`YYYY-MM`, default mês atual) |
| `estoque` | Itens da despensa em falta ou quase acabando | `todos` opcional (default só `baixo`/`critico`) |
| `lista_compras` | Listas de compras abertas/em andamento e itens pendentes | nenhum |

Detalhes:

- **`saldo_categorias`**: devolve `categorias[]` completo (todas as
  categorias com orçamento no mês, não só as com problema), ordenado da
  mais crítica pra mais folgada por `saldo`. Cada item tem `planejado`,
  `gasto`, `saldo`, `pct_atingido`, `essencial`. `saldo` negativo = estourou
  o orçamento do mês. Legenda usada no `resumo_wa`: 🔴 saldo negativo, 🟡
  `pct_atingido >= 90` (mas ainda positivo), 🟢 o resto.
- **`estoque`**: por padrão só itens `baixo`/`critico` (evita listar ~280
  itens `ok`). Cada item tem `estoque_atual`, `unidade`, `status`,
  `dias_restantes` e `sugestao_compra` (esses dois últimos podem vir `null`
  se não houver histórico de consumo suficiente ainda). Sem nada em
  falta → `resumo_wa` diz "Nada em falta — estoque OK. ✅".
- **`lista_compras`**: só listas com status `aberta` ou `em_andamento`
  (não traz `concluida`). Cada lista tem `itens_pendentes[]` (itens ainda
  não marcados como comprados) e `total_estimado`.

## Endpoint 2 — `/api/hermes-atualiza` (leitura + escrita)

Arquivo: `api/hermes-atualiza.ts`. Grava no banco de verdade — a
responsabilidade de confirmar com a pessoa antes de chamar é do Hermes.

| Ação | O que faz | Obrigatórios | Opcionais principais |
|---|---|---|---|
| `adicionar_item_lista` | Adiciona item numa lista de compras (cria lista nova se não houver uma aberta) | `nome` | `quantidade`, `unidade`, `preco_estimado`, `lista` |
| `lancar_transacao` | Lança uma despesa ou receita rápida | `descricao`, `valor` | `tipo`, `conta`, `forma_pagamento`, `categoria`, `data` |
| `registrar_abastecimento` | Registra abastecimento de veículo | `valor_pago`, `hodometro`, (`litros` ou `preco_litro`) | `veiculo`, `forma_pagamento`/`conta`, `combustivel`, `posto`, `tanque_cheio`, `data` |
| `atualizar_estoque` | Ajusta o estoque de um produto da despensa | `produto` | `modo`, `quantidade` |

Detalhes:

- **`adicionar_item_lista`**: `lista` só é necessário se houver mais de
  uma lista aberta ao mesmo tempo; sem lista nenhuma aberta, cria
  automaticamente ("Lista de compras"). Recalcula o `total_estimado` da
  lista a cada item adicionado.
- **`lancar_transacao`**: `tipo` é `"despesa"` (default) ou `"receita"`.
  Conta é resolvida por `conta` (nome exato) ou `forma_pagamento`
  (`"debito"`/`"credito"`) — `"debito"` (ou nenhum dos dois informado) cai
  na conta corrente padrão, nunca escolhe cartão sozinho; `"credito"`
  restringe às contas tipo cartão (fica ambíguo se houver mais de um
  cartão). Sem `categoria`, tenta categorizar automaticamente só quando há
  uma regra já aprendida com alta confiança (nível 1) — senão fica sem
  categoria de propósito, é melhor que categoria errada.
- **`registrar_abastecimento`**: `litros` e `preco_litro` são
  intercambiáveis — informe um, o endpoint calcula o outro a partir de
  `valor_pago`. `veiculo` é obrigatório sempre que houver mais de um
  veículo ativo. A categoria de despesa (gasolina) é resolvida
  automaticamente cruzando o tipo do veículo (carro/moto) com o nome da
  categoria — não precisa perguntar isso pra pessoa. Mesma lógica de
  `conta`/`forma_pagamento` de `lancar_transacao`.
- **`atualizar_estoque`**: resolve o produto pelo **nome genérico**
  ("arroz", "café"), não pela marca — só pede pra especificar a marca se
  houver mais de uma cadastrada pro mesmo item genérico. `modo` pode ser
  `"acabou"` (zera, default sem `quantidade`), `"consumo"` (subtrai,
  default com `quantidade` sem `modo`), `"entrada"` (soma, reposição fora
  do fluxo de lista de compras) ou `"definir"` (define valor exato, pra
  contagem física). `quantidade` deve vir na mesma unidade que o produto
  usa no estoque (kg, g, L, ml, un, rolos etc.).

## Regras que valem pras duas skills

- **`resumo_wa` é a resposta preferencial** — já formatado pra WhatsApp
  (emojis, R$, quebras de linha certas). O Hermes deve devolvê-lo quase
  verbatim em vez de reconstruir a partir dos campos estruturados, pra não
  arriscar errar formatação ou matemática.
- **Erro genérico (500) ou `ok:false` sem `ambiguo`/`naoEncontrado`**: o
  Hermes deve avisar que não conseguiu processar agora e sugerir tentar de
  novo ou usar o app — nunca inventar um resultado nem dizer que gravou se
  não gravou.
- **Nada disso substitui o app** — funcionalidades como marcar item da
  lista como comprado, editar/excluir uma transação já lançada, ou fechar
  uma lista de compras (`finalizar_compra`, que já mexe em estoque e
  lança a transação de uma vez) continuam só no app; não têm equivalente
  no Hermes ainda.

## Configuração resumida

Ver `README.md` para o passo a passo completo. Em suma: três env vars na
Vercel (`HERMES_SECRET_CASINHA`, `HERMES_FAMILY_ID`, `HERMES_USER_ID`) e os
dois arquivos de skill (`CASINHA_hermes_skill_consulta.md`,
`CASINHA_hermes_skill_atualiza.md`) copiados pra pasta de skills da
instância do Hermes.
