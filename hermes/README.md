# Hermes Agent — configuração para o Casinha Hub

Integração de leitura para o Hermes (agente de WhatsApp) consultar saldo por
categoria, estoque e lista de compras direto no grupo da família. Segue o
mesmo modelo do projeto Sime (`bernardobbs/sime/hermes/`): o Hermes sempre
inicia a conexão, nunca precisa ser alcançado de fora.

```
Hermes ──POST──▶ /api/hermes-consulta   (saldo_categorias | estoque | lista_compras)
```

Diferença em relação ao Sime: o Casinha Hub é de uma família só (não
multi-tenant por "zona"), então não existe segredo por família — só um
`HERMES_SECRET_CASINHA` e uma `HERMES_FAMILY_ID` fixos.

## Configuração

Duas env vars na Vercel (Project Settings → Environment Variables):

| Nome | Valor |
|---|---|
| `HERMES_SECRET_CASINHA` | segredo forte, gerado com `openssl rand -base64 32` |
| `HERMES_FAMILY_ID` | o UUID da família (`select id from families`) |

E no Hermes (`~/.hermes/config.env` no Raspberry Pi, ou equivalente):

```
CASINHA_VERCEL_URL=https://<seu-deploy>.vercel.app
CASINHA_SECRET=<o mesmo valor de HERMES_SECRET_CASINHA>
```

Copiar `CASINHA_hermes_skill_consulta.md` para a pasta de skills do Hermes
(`~/.hermes/skills/casinha/`, ou onde a instância local espera).

## Testar sem esperar alguém perguntar no grupo

```bash
curl -sS -X POST https://<seu-deploy>.vercel.app/api/hermes-consulta \
  -H "Authorization: Bearer <HERMES_SECRET_CASINHA>" \
  -H 'Content-Type: application/json' \
  -d '{"acao":"saldo_categorias"}'
```

- `{"ok":true,...}` → autenticou e respondeu
- `401` → o segredo não bate com o da Vercel
- `500` com `HERMES_FAMILY_ID não configurado` → falta a env var na Vercel

## Segurança

- Só leitura. Nenhuma ação nesta integração escreve no banco.
- `HERMES_SECRET_CASINHA` não filtra por família (só existe uma) — mas trate
  como qualquer outro segredo: nunca commitado, nunca em log.
- O endpoint usa a `SUPABASE_SERVICE_ROLE_KEY` (já configurada na Vercel para
  o `/api/keepalive`) — ela ignora RLS, então a checagem de família acontece
  inteiramente no código do endpoint (`HERMES_FAMILY_ID`), não na policy do
  banco. Não adicionar ações novas a este arquivo sem repetir esse filtro.
