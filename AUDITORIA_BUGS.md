# Auditoria geral — casinha-flow — lista mestre de bugs

Consolidado a partir de 6 investigações paralelas cobrindo as 25 páginas do app,
em 12-13/08/2026. Cada bug tem um ID estável (`B-01`, `B-02`...) pra rastrear
progresso nas correções. Ordem: mais crítico → mais leve.

Legenda de categoria:
- 🔒 **DECISÃO** — não é bug de código, é modelo de permissão/produto. Não corrigir sem confirmar com o usuário.
- 🐛 **AUTO** — bug de lógica com correção clara (bate com padrão já usado em outro lugar do próprio app). Seguro corrigir sem perguntar.
- 📎 **DADO** — hardcoded ou desconectado de fonte real; precisa decidir de onde puxar o valor certo antes de corrigir.

---

## 🔴 Críticos (dinheiro/dado errado mostrado ou perdido)

| ID | Página/arquivo | Bug | Cat |
|---|---|---|---|
| B-01 | `estoque.tsx` (`salvarEstoque`) | Editar quantidade de um "filho" nunca grava o total da "mãe" no banco — só atualiza estado local. 8 produtos reais já corrompidos (mãe em 0 com filhos tendo estoque real). Padrão correto já existe em `estoque.revisao-semanal.tsx`. | 🐛 AUTO |
| B-02 | `compras.tsx` (import) | Mesmo bug de B-01 no fluxo de importação de compras — "mãe" nunca recalculada ao dar entrada em itens vinculados. | 🐛 AUTO |
| B-03 | `estoque.tsx` (filtro) | Card/filtro "Zerado" exclui incondicionalmente qualquer item com `estoque_atual <= 0` antes de aplicar o filtro de status — clicar em "Zerado" sempre mostra lista vazia. | 🐛 AUTO |
| B-04 | RPC `dre.tsx` query principal | Não filtra `tipo_especial`, somando pagamento de fatura/ajuste de saldo junto com receita/despesa real — quase dobra os totais anuais/mensais. | 🐛 AUTO |
| B-05 | `relatorios.tsx` (aba Orçado x Realizado) | Chama `get_budget_status` com `p_family_id`/`p_mes`, mas a função real é `_family_id`/`_mes` — RPC nunca retorna dado, aba sempre mostra "sem orçamento". Erro do Supabase é ignorado silenciosamente. | 🐛 AUTO |
| B-06 | `relatorios.tsx` (aba Evolução Mensal) + possivelmente seletor de mês em `month-view.tsx` | Chama `get_monthly_summary` com 2 argumentos (`p_family_id, p_months`), resolvendo pra uma sobrecarga antiga que só exclui `transferencia` (não `pagamento_fatura`/`ajuste_saldo`) — gráfico/tabela inflados. **Verificar primeiro** se `month-view.tsx` está de fato afetado (um dos 6 relatórios apontou que sim, outro que o seletor de mês usa a versão correta de 1 argumento) antes de decidir o que mexer. | 🐛 AUTO |
| B-07 | `relatorios.tsx` (aba Extrato) | Cards de Receitas/Despesas/Saldo do topo usam `.or("tipo_especial.is.null,tipo_especial.neq.transferencia")` — não exclui `pagamento_fatura`/`ajuste_saldo`. | 🐛 AUTO |
| B-08 | `month-view.tsx` (`totals`, aba Histórico de `/transactions`) | Cards de Receitas/Despesas/Saldo do mês somam todas as transações sem excluir `tipo_especial != 'normal'`. Mesma causa-raiz de B-04/B-06/B-07 — provavelmente uma correção comum resolve vários desses. | 🐛 AUTO |
| B-09 | `contas-a-pagar.tsx` + RPC `get_previsao_mes` | Filtra fatura de cartão por `mes_referencia` em vez de `data_vencimento` — mostra a fatura que vence no mês **seguinte**, escondendo a que vence no mês atual. | 🐛 AUTO |
| B-10 | `contas-a-pagar.tsx` + RPC `get_previsao_mes` | Só retorna itens dentro do mês calendário atual — contas/faturas atrasadas de meses passados (mesmo com `status='atrasado'`) somem da tela assim que o mês vira. Hoje soma ~R$297 mil escondidos. | 🐛 AUTO |
| B-11 | `contas-a-pagar.tsx` (`pagar()`) | Ao pagar fatura de cartão, insere a transação de saída manualmente **e** chama `pay_credit_card_bill` (que insere mais duas) — duplica o débito na conta pagadora. Ainda não corrompeu dado real (nenhuma fatura paga por essa tela até agora), mas vai corromper no próximo uso. | 🐛 AUTO |
| B-12 | `financial-state.tsx` + RPC `recalc_financial_state_safe` | Classifica gasto essencial/estilo de vida por `transactions.is_essencial` (nunca sincronizada com o switch do `EditDrawer`), enquanto dashboard/situação usam `categories.is_essencial` — dois números completamente diferentes pro mesmo mês, mesma família. | 🐛 AUTO (definir qual fonte é a certa — provavelmente `categories.is_essencial`, já usada em mais lugares) |
| B-13 | RPCs `activate_crisis` / `advance_crisis_stage` | Fazem INSERT/UPDATE em colunas `motivo`/`estagio` que não existem em `crisis_events` (colunas reais: `motivo_ativacao`/`estagio_atual`). Botões "Ativar Modo Crise"/"Avançar estágio" quebrados em 3 páginas. | 🐛 AUTO |
| B-14 | Edge Function `ai-assistant` | Chave do Gemini hardcoded como fallback no código-fonte. | ✅ **JÁ CORRIGIDO** em 12/08 (fallback removido, redeployado v7). Falta o usuário revogar a chave antiga no Google Cloud e configurar uma nova como secret na Vercel/Supabase. |

## 🟠 Segurança — precisam de decisão de produto, não só código

| ID | Página/tabela | Bug | Cat |
|---|---|---|---|
| B-15 | RPC `reset_family_data` + `configuracoes.tsx` | Qualquer membro (não só admin) pode apagar todos os dados financeiros da família — sem checagem de `role` na UI nem na RPC. | 🔒 DECISÃO |
| B-16 | RLS `family_members` | Policy só checa `family_id`, não `role` — qualquer membro autenticado pode se auto-promover a admin ou remover o admin via API direta do Supabase (fora da UI). | 🔒 DECISÃO |
| B-17 | RLS `family_invites` | Qualquer membro (não só admin) pode gerar convites para novas pessoas entrarem na família. | 🔒 DECISÃO |
| B-18 | Postgres Auth config | "Leaked password protection" desabilitada — combinado com validação de senha só no cliente, permite criar conta com senha comprometida via chamada direta à API. | 🔒 DECISÃO (mas de baixo esforço pra ligar) |
| B-19 | RPCs `accept_invite`, `get_user_family_id`, `reset_family_data` | Expostas ao role `anon` (não autenticado) — `reset_family_data` já se protege internamente, mas é gap de *defense-in-depth*. | 🔒 DECISÃO (hardening, baixo risco hoje) |

## 🟡 Altos (funcionalidade quebrada ou número enganoso, sem risco de segurança)

| ID | Página/arquivo | Bug | Cat |
|---|---|---|---|
| B-20 | RPC `finalizar_compra` | Soma `quantidade` do item direto no estoque sem multiplicar por `quantidade_por_embalagem` — subestima drasticamente o estoque quando usada (ainda não foi usada com sucesso em produção). | 🐛 AUTO |
| B-21 | `compras.tsx` (fluxo "Finalizar compra") | Itens adicionados manualmente numa lista nunca recebem `product_id` (só o fluxo de "Importar" seta isso) — o loop de atualização de estoque dentro de `finalizar_compra` nunca encontra nada pra atualizar no caminho principal da UI, mas a mensagem de sucesso finge que atualizou. | 🐛 AUTO (ou remover a promessa da UI até existir tela de vincular produto) |
| B-22 | `gasolina.tsx` + RPC `get_maintenance_status` | Usa `COALESCE(mt.ultimo_km, 0)` — qualquer tipo de manutenção nunca registrado é automaticamente marcado "vencido" (km "restante" fica negativo em relação ao hodômetro total do carro). | 🐛 AUTO |
| B-23 | `gasolina.tsx` (`statusBadge`) | Testa string `"em_breve"`, mas o backend retorna `"proximo"` — o aviso amarelo nunca aparece, tudo cai em "✅ OK". | 🐛 AUTO |
| B-24 | `gasolina.tsx` + RPC `get_fuel_history` / view `v_fuel_consumption` | km/L calculado sem checar se o abastecimento foi tanque cheio ou parcial — mesma sequência de abastecimentos do mesmo carro produz de 3 a 43 km/L. | 🐛 AUTO |
| B-25 | `vehicles.consumo_medio_km_l` + view `v_vehicle_status` | Campo estático editável sem validação, hoje em 42 km/L pra um carro que consome ~10 km/L de verdade — "% tanque estimado"/"km restantes" mostram muito mais combustível do que existe de fato. Risco real de ficar sem gasolina confiando no indicador. | 📎 DADO (corrigir o valor cadastrado + considerar calcular a partir do histórico real em vez de campo editável solto) |
| B-26 | `gasolina.tsx` (editar/excluir abastecimento) | Não chama `recalc_account_balance` depois de editar valor ou excluir um abastecimento — saldo da conta fica desatualizado até outra ação disparar recálculo. | 🐛 AUTO |
| B-27 | RPC `check_crisis_activation` | Calcula renda somando transações tipo receita do mês em vez de usar `financial_state.renda_mensal` (fonte documentada/usada em outros lugares) — dispara falso positivo de crise quase sempre (renda real da família não vem de transações). | 🐛 AUTO |
| B-28 | `financial-state.tsx` | Mostra toast de "crise ativada automaticamente" mesmo quando a chamada ao RPC falha (erro não checado). Consequência direta de B-13. | 🐛 AUTO |
| B-29 | `financial-state.tsx` (banner "Modo Crise ativado") | Nunca aparece porque nenhuma função grava `financial_state.modo_crise=true` (consequência de B-13/B-27). | 🐛 AUTO |
| B-30 | `dashboard.tsx` (card "Comprometimento Mensal") | `salario: 11143.20` e `parcelas: 2543` **hardcoded** no código — não vêm do banco. Parcelas reais hoje = R$0; renda real varia R$10.996–22.737/mês conforme o mês. | 📎 DADO (decidir: puxar de `financial_state.renda_mensal` + `installments`, ou remover o card) |
| B-31 | Edge Function `ai-assistant` + `configuracoes.tsx` | Contador "Uso hoje: X/Y" sempre mostra 0 — RPC `count_ai_runs_today` lê de `daily_ai_runs`, mas a function grava em `ai_logs`. | 🐛 AUTO |
| B-32 | Edge Function `ai-assistant` + `configuracoes.tsx` | Campo "Limite diário de mensagens" configurável na UI não tem efeito nenhum — limite real está hardcoded em 20 na Edge Function, nunca lê `family_settings.ai_daily_limit`. | 🐛 AUTO |

## 🟢 Médios

| ID | Página/arquivo | Bug | Cat |
|---|---|---|---|
| B-33 | `get_dashboard_summary` (score de saúde) | Penaliza duas vezes o mesmo fato ("gasto > renda") via duas condições redundantes, sem gradação por severidade. | 🐛 AUTO |
| B-34 | `revisao-semanal.tsx` | Janela "semana atual" (8 dias, ambos extremos inclusive) vs "semana anterior" (7 dias) — infla o comparativo mesmo sem mudança real de comportamento. | 🐛 AUTO |
| B-35 | `compras.tsx` (listas concluídas) | `total_real` NULL exibido como "R$ 0,00" sem fallback pro `total_estimado`, em pelo menos 2 listas reais de ~R$326 e ~R$1.549 (parecem ter sido inseridas por integração externa, "endpoint do Hermes" citado em comentário de RPC). | 🐛 AUTO |
| B-36 | `auth.tsx` | Fluxo de "nova senha" duplicado e morto dentro do arquivo — o fluxo real sempre usa a rota separada `/auth/reset-password`. Risco de manutenção (uma cópia pode ser corrigida e a outra esquecida). | 🐛 AUTO (remover código morto) |
| B-37 | RPC `accept_invite` | Race condition (TOCTOU) — `SELECT` de convite pendente sem `FOR UPDATE` antes do `UPDATE status='accepted'`. Impacto baixo (token de 64 hex chars). | 🐛 AUTO |
| B-38 | `gasolina.tsx` (`MaintDialog`) | Escolhe a conta de pagamento automaticamente (primeira conta não-cartão), sem campo de seleção — funciona "por sorte" hoje (só existe 1 conta não-cartão). | 🐛 AUTO (adicionar seletor) |
| B-39 | Trigger `after_fuel_fill` / view `v_fuel_consumption` | `LIMIT 5` aplicado depois da agregação (não limita nada); cálculo tanque-cheio-a-tanque-cheio ignora litros de reabastecimentos parciais no meio do caminho, subestimando consumo real. | 🐛 AUTO |

## ⚪ Baixos / cosméticos / gaps de dado sem impacto ativo

| ID | Página/arquivo | Bug |
|---|---|---|
| B-40 | `transactions.tsx`, `month-view.tsx` | Tipo TS de `tipo_especial` não inclui `'ajuste_saldo'` — badge não aparece pra esses lançamentos. |
| B-41 | `transactions.tsx` (checagem de duplicata manual) | Usa `.eq("amount", ...)` puro em vez de `COALESCE`; RPC `check_duplicate_transaction` já faz certo. |
| B-42 | `transactions.tsx` | `totals` (useMemo) calculado mas nunca usado no JSX — código morto. |
| B-43 | `conciliacao.tsx` | `.limit(100)` em transações pendentes; contador usa `list.length` em vez de count exato — subestima se passar de 100 (hoje 53, sem impacto). |
| B-44 | `reconciliation-panel.tsx` | Mesmo padrão de B-43 com `.limit(500)` (hoje 50/681, sem impacto). |
| B-45 | `contas-a-pagar.tsx` | `new Date(r.data_vencimento).getMonth()` sem `"T00:00:00"` — sujeito a bug de fuso horário (nenhum caso ativo hoje). |
| B-46 | `dre.tsx` | `CAT_REC` declarado e nunca usado — código morto. |
| B-47 | `relatorios.tsx` | 3 abas declaradas no `TabsList` (Preços, Comprometimento, Estoque) mas os componentes correspondentes nunca são renderizados em `TabsContent` — clicar não mostra nada. |
| B-48 | `relatorios.tsx` (`ComprometimentoRelatorio`, código morto por B-47) | `salario`/`parcelas` hardcoded — mesma classe de B-30, mas em componente que nem está acessível hoje. |
| B-49 | `configuracoes.tsx` | Campo `ai_provider` existe no estado mas não tem UI pra editar — sempre Gemini na prática. |
| B-50 | `use-family.ts` | `clearFamilyCache()` exportada mas nunca chamada — cache pode ficar stale em cenários hoje raros. |
| B-51 | `crisis.tsx` | Badge "manual" vs "automática" nunca bate com o texto real salvo (latente — crise nunca fica ativa hoje por causa de B-13/B-27). |
| B-52 | `crisis.tsx` | Alerta de gastos não-essenciais não filtra `tipo_especial` (latente pelo mesmo motivo). |
| B-53 | `dashboard.tsx` | `console.log` de debug esquecido nas linhas 157-159. |

---

## Não são bugs — contexto/gaps de dado registrados, sem ação de código

- Nubank Roxinho sem `limite_credito` cadastrado (null) — dado faltando, não bug.
- `credit_card_bills`: ~21 faturas antigas com status desatualizado, não reconciliadas com pagamentos reais feitos fora do app.
- `financial_state` vazio para a família (0 linhas) — usado como fonte de renda em vários lugares (B-12, B-27, B-30); populá-lo corrige vários bugs de uma vez.
- Baixa taxa de vinculação produto↔item em compras históricas — a maioria das compras de mercado nunca deu entrada no estoque (comportamento intencional do fluxo atual, não bug).
