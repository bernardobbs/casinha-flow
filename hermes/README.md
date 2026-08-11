# Hermes Agent — configuração para o Casinha Hub

Integração com o Hermes (agente de WhatsApp) pro grupo da família consultar
e atualizar dados do Casinha Hub. Segue o mesmo modelo do projeto Sime
(`bernardobbs/sime/hermes/`): o Hermes sempre inicia a conexão, nunca
precisa ser alcançado de fora.

```
Hermes ──POST──▶ /api/hermes-consulta   (saldo_categorias | estoque | lista_compras)
Hermes ──POST──▶ /api/hermes-atualiza   (adicionar_item_lista | lancar_transacao | registrar_abastecimento | atualizar_estoque)
```

Diferença em relação ao Sime: o Casinha Hub é de uma família só (não
multi-tenant por "zona"), então não existe segredo por família — só um
`HERMES_SECRET_CASINHA`, uma `HERMES_FAMILY_ID` e um `HERMES_USER_ID` fixos.

## Configuração

Três env vars na Vercel (Project Settings → Environment Variables):

| Nome | Valor |
|---|---|
| `HERMES_SECRET_CASINHA` | segredo forte, gerado com `openssl rand -base64 32` |
| `HERMES_FAMILY_ID` | o UUID da família (`select id from families`) |
| `HERMES_USER_ID` | o UUID do perfil a quem atribuir o que o Hermes lança (`select id from profiles`) |

E no Hermes (`~/.hermes/config.env` no Raspberry Pi, ou equivalente):

```
CASINHA_VERCEL_URL=https://<seu-deploy>.vercel.app
CASINHA_SECRET=<o mesmo valor de HERMES_SECRET_CASINHA>
```

Copiar `CASINHA_hermes_skill_consulta.md` e `CASINHA_hermes_skill_atualiza.md`
para a pasta de skills do Hermes (`~/.hermes/skills/casinha/`, ou onde a
instância local espera).

## Testar sem esperar alguém perguntar no grupo

```bash
# leitura
curl -sS -X POST https://<seu-deploy>.vercel.app/api/hermes-consulta \
  -H "Authorization: Bearer <HERMES_SECRET_CASINHA>" \
  -H 'Content-Type: application/json' \
  -d '{"acao":"saldo_categorias"}'

# escrita — cuidado, isso grava de verdade
curl -sS -X POST https://<seu-deploy>.vercel.app/api/hermes-atualiza \
  -H "Authorization: Bearer <HERMES_SECRET_CASINHA>" \
  -H 'Content-Type: application/json' \
  -d '{"acao":"adicionar_item_lista","nome":"Teste Hermes","quantidade":1}'
```

- `{"ok":true,...}` → autenticou e respondeu/gravou
- `{"ok":false,"ambiguo":true,...}` ou `{"ok":false,"naoEncontrado":true,...}` → autenticou, mas precisa de mais informação (nome de lista/conta/veículo/categoria)
- `401` → o segredo não bate com o da Vercel
- `500` com `HERMES_FAMILY_ID / HERMES_USER_ID não configurados` → falta env var na Vercel

## Segurança

- `/api/hermes-consulta` é só leitura. `/api/hermes-atualiza` escreve no
  banco (lista de compras, transações, abastecimentos, estoque) — a
  responsabilidade de confirmar com a pessoa antes de chamar é do Hermes,
  descrita na skill `CASINHA_hermes_skill_atualiza.md`; o endpoint em si
  não pede confirmação, só executa.
- `HERMES_SECRET_CASINHA` não filtra por família (só existe uma) — mas trate
  como qualquer outro segredo: nunca commitado, nunca em log.
- Os dois endpoints usam a `SUPABASE_SERVICE_ROLE_KEY` (já configurada na
  Vercel para o `/api/keepalive`) — ela ignora RLS, então a checagem de
  família acontece inteiramente no código do endpoint (`HERMES_FAMILY_ID`),
  não na policy do banco. Não adicionar ações novas a estes arquivos sem
  repetir esse filtro.
