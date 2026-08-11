# SKILL: casinha_atualiza
description: Adiciona item na lista de compras, lança uma transação rápida (gasto/receita), registra abastecimento de veículo e atualiza o estoque da despensa no Casinha Hub, a partir de mensagens do grupo de WhatsApp.
triggers:
  - pedido pra adicionar item na lista ("adiciona leite na lista", "põe arroz e ovo pra comprar")
  - relato de gasto ou receita ("gastei 50 no mercado", "recebi 200 de reembolso")
  - relato de abastecimento ("abasteci o carro, 30 litros a 5,20", "enchi o tanque da moto", "abasteci o Cronos, paguei 156 a 5,20 no débito, hodômetro 45230, tanque cheio")
  - relato de estoque acabando/mudando ("acabou o café", "usei metade do arroz", "comprei mais 2kg de açúcar fora da lista", "tem 3 rolos de papel higiênico sobrando")

---

## Objetivo

Complementa `casinha_consulta` (só leitura) com quatro ações de **escrita**.
Ao contrário do Sime, aqui **o Hermes é responsável por confirmar com a
pessoa antes de chamar o endpoint** — ele não tem uma etapa própria de
confirmação (diferente do `confirmar`/`recusar` do `sime_mesarios`, que
grava na hora). Motivo: aqui a IA extrai valor/item/veículo de texto livre,
que erra mais fácil que "SIM/NÃO" — vale a pena confirmar antes.

## Endpoint alvo

```
POST https://<seu-deploy>.vercel.app/api/hermes-atualiza
Authorization: Bearer <HERMES_SECRET_CASINHA>
Content-Type: application/json
```

## Regra de ouro: confirmar antes de gravar

```
1. Pessoa manda "gastei 50 no mercado no débito"
2. Hermes NÃO chama o endpoint ainda. Responde:
   "Confirma: despesa de R$ 50,00 — 'mercado' — no débito (BB Conta Corrente)?"
3. Pessoa responde "sim" / "confirma" / "isso"
4. SÓ AGORA Hermes chama casinha_atualiza {acao:'lancar_transacao', forma_pagamento:'debito', ...}
5. Devolve o resumo_wa da resposta
```

Se a pessoa disser "no crédito" sem nomear o cartão, o passo 2 já fica em
aberto até o endpoint responder — chame com `forma_pagamento:'credito'`
depois da confirmação; se vier `ambiguo:true` (mais de um cartão), passe a
`mensagem_wa` adiante e peça o nome do cartão antes de tentar de novo.

Exceção: se a mensagem já vier com todos os dados MUITO explícitos e sem
ambiguidade nenhuma (ex.: alguém respondendo a uma pergunta direta do próprio
Hermes), pode pular a confirmação — mas na dúvida, confirma.

## Ambiguidade — nunca adivinhar

Toda ação pode devolver `{"ok": false, "ambiguo": true, "opcoes": [...],
"mensagem_wa": "..."}` (mais de uma lista/conta/veículo/categoria bate com o
nome dado, ou nenhum nome foi dado e existe mais de uma opção) ou
`{"ok": false, "naoEncontrado": true, "mensagem_wa": "..."}`. Em ambos os
casos: **devolva `mensagem_wa` pra pessoa e espere ela especificar** — nunca
escolha por conta própria nem invente um valor.

## Ações

### 1. `adicionar_item_lista`
```json
{ "acao": "adicionar_item_lista", "nome": "Leite", "quantidade": 2, "unidade": "L" }
```
- `quantidade` (default `1`), `unidade` (default `"un"`), `preco_estimado`
  (opcional) — todos opcionais.
- `lista`: nome (ou parte) da lista, só necessário se houver **mais de uma**
  lista aberta ao mesmo tempo. Sem lista aberta nenhuma, cria uma nova
  automaticamente ("Lista de compras").

Resposta: `{"ok": true, "lista": "...", "item": {...}, "resumo_wa": "✅ ..."}`

### 2. `lancar_transacao`
```json
{ "acao": "lancar_transacao", "descricao": "Mercado", "valor": 50.00, "tipo": "despesa", "forma_pagamento": "debito" }
```
- `tipo`: `"despesa"` (default) ou `"receita"`.
- `conta` (opcional): nome exato da conta/cartão (ex.: "Nubank Roxinho") —
  use quando a pessoa citar o nome.
- `forma_pagamento` (opcional): `"debito"` ou `"credito"` — use quando a
  pessoa disser só "no débito"/"no crédito" sem nomear a conta. `"debito"`
  (ou nem `conta` nem `forma_pagamento` informados) cai na conta corrente
  padrão; `"credito"` restringe às contas tipo cartão — esta família tem
  **dois cartões** (BB visa Black, Nubank Roxinho), então "no crédito"
  sozinho fica ambíguo e o endpoint devolve `{ambiguo:true}` perguntando
  qual cartão.
- `categoria` (opcional): se não vier, tenta categorizar automaticamente só
  quando há uma regra já aprendida com alta confiança — senão fica sem
  categoria (a pessoa classifica depois no app; **melhor sem categoria do
  que categoria errada**).
- `data` (opcional, `YYYY-MM-DD`): default hoje.

Resposta inclui `transacao.categoria` (pode vir `null` — nesse caso,
mencione no resumo que falta classificar).

### 3. `registrar_abastecimento`
```json
{ "acao": "registrar_abastecimento", "valor_pago": 156.00, "preco_litro": 5.20, "hodometro": 45230, "veiculo": "Cronos", "forma_pagamento": "debito", "tanque_cheio": true }
```
Forma normal de relato desta família: **hodômetro, valor pago, valor da
gasolina (preço/litro), débito ou crédito, se completou o tanque** — sem
falar quantos litros. Por isso `litros` e `preco_litro` são
intercambiáveis:
- Informe **um dos dois**: `litros` (o endpoint calcula `preco_litro =
  valor_pago / litros`) ou `preco_litro` (o endpoint calcula `litros =
  valor_pago / preco_litro`). Se a pessoa só disser "abasteci e paguei
  R$156" sem preço nem litros, pergunte o preço do litro antes de confirmar.
- `veiculo`: nome (ou parte) do veículo — **obrigatório sempre que a família
  tiver mais de um veículo ativo** (é o caso normal aqui: carro e moto).
- `forma_pagamento` (opcional): `"debito"` ou `"credito"`, mesmo
  comportamento/ambiguidade de dois cartões descrito em `lancar_transacao`.
  `conta` (opcional) também aceito se a pessoa nomear a conta/cartão.
- `combustivel` (opcional, default `"gasolina"`), `posto` (opcional),
  `tanque_cheio` (opcional, default `true`), `data` (opcional, default hoje).
- A categoria de despesa é resolvida automaticamente por veículo (existe uma
  categoria "Gasolina" por veículo) — não precisa perguntar isso pra pessoa.

### 4. `atualizar_estoque`
```json
{ "acao": "atualizar_estoque", "produto": "café", "modo": "acabou" }
```
- `produto`: nome do item, do jeito que a pessoa fala normalmente — o nome
  **genérico** ("arroz", "café", "papel higiênico"), não a marca. O
  endpoint resolve pelo nome genérico primeiro; só pede pra especificar a
  marca se houver **mais de uma marca cadastrada** para aquele item (ex.:
  "arroz" bate com Arroz Ideal 5kg, Arroz Tio João 1kg, Arroz Painho 1kg —
  aí vem `ambiguo:true` perguntando qual). Com uma marca só (caso mais
  comum), resolve direto.
- `modo`:
  - `"acabou"` (default se `quantidade` não vier) — zera o estoque. Pra
    "acabou o café", "zerou o desodorante".
  - `"consumo"` (default se `quantidade` vier sem `modo`) — subtrai
    `quantidade` do estoque atual (nunca fica negativo). Pra "usei 200g de
    café", "gastei uns 2 rolos de papel higiênico".
  - `"entrada"` — soma `quantidade` ao estoque atual. Pra reposição fora do
    fluxo normal de lista de compras (ex.: "minha mãe trouxe 3kg de arroz").
  - `"definir"` — define o estoque como `quantidade` exata. Pra quando a
    pessoa contou fisicamente ("tem 3 rolos de papel higiênico sobrando").
- `quantidade`: **no mesmo tipo de unidade que o produto usa** (kg, g, L,
  ml, un, rolos etc. — mesma unidade que aparece em `casinha_consulta
  {acao:'estoque'}`). Se não tiver certeza da unidade, pergunte antes de
  confirmar, ou consulte o estoque primeiro.
- Resposta inclui `resumo_wa` tipo `"📤 Café Moído: 500g → 300g."` — use
  quase verbatim.

**Nota**: comprar tudo de uma lista de compras (marcar itens como
comprados e dar entrada em massa) é feito **no app**, não por esta ação —
`atualizar_estoque` é pra ajustes pontuais fora desse fluxo.

## CRÍTICO

- **Sempre confirme antes de gravar** (ver seção acima) — as quatro ações
  desta skill escrevem no banco de verdade, sem desfazer automático.
- **Nunca resolva ambiguidade sozinho.** Se vier `ambiguo` ou `naoEncontrado`,
  devolva a `mensagem_wa` e espere resposta.
- Valor sempre em reais (número, não string formatada) — "50 reais" vira
  `50`, não `"R$ 50,00"`.
- `lancar_transacao` sem categoria resolvida **não é erro** — é
  intencional. Prefira isso a uma categoria errada.
- Se `ok:false` sem `ambiguo`/`naoEncontrado` (erro genérico/500), avise que
  não deu pra gravar agora e sugira tentar de novo ou usar o app — nunca diga
  que gravou se não gravou.
