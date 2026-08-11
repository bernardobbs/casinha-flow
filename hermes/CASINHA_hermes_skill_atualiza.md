# SKILL: casinha_atualiza
description: Adiciona item na lista de compras, lança uma transação rápida (gasto/receita) e registra abastecimento de veículo no Casinha Hub, a partir de mensagens do grupo de WhatsApp.
triggers:
  - pedido pra adicionar item na lista ("adiciona leite na lista", "põe arroz e ovo pra comprar")
  - relato de gasto ou receita ("gastei 50 no mercado", "recebi 200 de reembolso")
  - relato de abastecimento ("abasteci o carro, 30 litros a 5,20", "enchi o tanque da moto")

---

## Objetivo

Complementa `casinha_consulta` (só leitura) com três ações de **escrita**. Ao
contrário do Sime, aqui **o Hermes é responsável por confirmar com a pessoa
antes de chamar o endpoint** — ele não tem uma etapa própria de confirmação
(diferente do `confirmar`/`recusar` do `sime_mesarios`, que grava na hora).
Motivo: aqui a IA extrai valor/item/veículo de texto livre, que erra mais
fácil que "SIM/NÃO" — vale a pena confirmar antes.

## Endpoint alvo

```
POST https://<seu-deploy>.vercel.app/api/hermes-atualiza
Authorization: Bearer <HERMES_SECRET_CASINHA>
Content-Type: application/json
```

## Regra de ouro: confirmar antes de gravar

```
1. Pessoa manda "gastei 50 no mercado"
2. Hermes NÃO chama o endpoint ainda. Responde:
   "Confirma: despesa de R$ 50,00 — 'mercado' — na conta BB Conta Corrente?"
3. Pessoa responde "sim" / "confirma" / "isso"
4. SÓ AGORA Hermes chama casinha_atualiza {acao:'lancar_transacao', ...}
5. Devolve o resumo_wa da resposta
```

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
{ "acao": "lancar_transacao", "descricao": "Mercado", "valor": 50.00, "tipo": "despesa" }
```
- `tipo`: `"despesa"` (default) ou `"receita"`.
- `conta` (opcional): nome da conta; sem isso, usa a conta corrente padrão
  (não escolhe cartão de crédito sozinho).
- `categoria` (opcional): se não vier, tenta categorizar automaticamente só
  quando há uma regra já aprendida com alta confiança — senão fica sem
  categoria (a pessoa classifica depois no app; **melhor sem categoria do
  que categoria errada**).
- `data` (opcional, `YYYY-MM-DD`): default hoje.

Resposta inclui `transacao.categoria` (pode vir `null` — nesse caso,
mencione no resumo que falta classificar).

### 3. `registrar_abastecimento`
```json
{ "acao": "registrar_abastecimento", "litros": 30, "valor_pago": 156.00, "hodometro": 45230, "veiculo": "Cronos" }
```
- `preco_litro` (opcional): se não vier, calcula `valor_pago / litros`.
- `veiculo`: nome (ou parte) do veículo — **obrigatório sempre que a família
  tiver mais de um veículo ativo** (é o caso normal aqui: carro e moto).
- `combustivel` (opcional, default `"gasolina"`), `posto` (opcional),
  `tanque_cheio` (opcional, default `true`), `conta` (opcional, mesmo
  padrão de `lancar_transacao`), `data` (opcional, default hoje).
- A categoria de despesa é resolvida automaticamente por veículo (existe uma
  categoria "Gasolina" por veículo) — não precisa perguntar isso pra pessoa.

## CRÍTICO

- **Sempre confirme antes de gravar** (ver seção acima) — as três ações
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
