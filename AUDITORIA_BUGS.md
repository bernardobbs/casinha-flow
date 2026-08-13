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
| B-01 | ✅ `estoque.tsx` (`salvarEstoque`) | Editar quantidade de um "filho" nunca grava o total da "mãe" no banco — só atualiza estado local. 8 produtos reais já corrompidos (mãe em 0 com filhos tendo estoque real). Padrão correto já existe em `estoque.revisao-semanal.tsx`. **Corrigido**: persiste o total da mãe no banco após cada edição de filho; os 8 produtos corrompidos foram reconciliados via migration. | 🐛 AUTO |
| B-02 | ✅ `compras.tsx` (import) | Mesmo bug de B-01 no fluxo de importação de compras — "mãe" nunca recalculada ao dar entrada em itens vinculados. **Corrigido**: recalcula cada mãe afetada como soma fresca dos filhos após o loop de entrada em estoque. | 🐛 AUTO |
| B-03 | ✅ `estoque.tsx` (filtro) | Card/filtro "Zerado" exclui incondicionalmente qualquer item com `estoque_atual <= 0` antes de aplicar o filtro de status — clicar em "Zerado" sempre mostra lista vazia. **Corrigido**: removida a exclusão incondicional. | 🐛 AUTO |
| B-04 | ✅ RPC `dre.tsx` query principal | Não filtra `tipo_especial`, somando pagamento de fatura/ajuste de saldo junto com receita/despesa real — quase dobra os totais anuais/mensais. **Corrigido**: query agora traz `tipo_especial` e `porMes` ignora tudo que não for `normal`. De quebra, corrigida a aba "Projeção Futura" (usava `recurring_transactions` receita, sempre R$0 pra esta família) pra usar `financial_state.renda_mensal` (fonte real de renda), inclusive nas comparações da aba "Mês Atual". | 🐛 AUTO |
| B-05 | ✅ `relatorios.tsx` (aba Orçado x Realizado) | Chama `get_budget_status` com `p_family_id`/`p_mes`, mas a função real é `_family_id`/`_mes` — RPC nunca retorna dado, aba sempre mostra "sem orçamento". **Corrigido**: nomes de parâmetro ajustados. | 🐛 AUTO |
| B-06 | ✅ `relatorios.tsx` (aba Evolução Mensal) | Chama `get_monthly_summary` com 2 argumentos (`p_family_id, p_months`), resolvendo pra uma sobrecarga antiga que só excluía `transferencia` (não `pagamento_fatura`/`ajuste_saldo`) — gráfico/tabela inflados. **Corrigido na própria RPC** (não no call site, pra manter as colunas `receita/despesa/saldo` que o frontend espera): agora filtra `COALESCE(tipo_especial,'normal')='normal'`, igual à sobrecarga de 1 argumento. Verificado que `month-view.tsx` usa a sobrecarga de 1 argumento (já correta), não esta — não precisou mexer lá por causa deste bug. | 🐛 AUTO |
| B-07 | ✅ `relatorios.tsx` (aba Extrato) | Cards de Receitas/Despesas/Saldo do topo usavam `.or("tipo_especial.is.null,tipo_especial.neq.transferencia")` — não excluía `pagamento_fatura`/`ajuste_saldo`. **Corrigido**: trocado para `.or("tipo_especial.is.null,tipo_especial.eq.normal")`. | 🐛 AUTO |
| B-08 | ✅ `month-view.tsx` (`totals`, aba Histórico de `/transactions`) | Cards de Receitas/Despesas/Saldo do mês somavam todas as transações sem excluir `tipo_especial != 'normal'`. **Corrigido**: `totals` agora pula qualquer transação com `tipo_especial` diferente de `normal`. | 🐛 AUTO |
| B-09 | ✅ `contas-a-pagar.tsx` + RPC `get_previsao_mes` | Filtrava fatura de cartão por `mes_referencia` em vez de `data_vencimento` — mostrava a fatura que vence no mês **seguinte**, escondendo a que vence no mês atual. **Corrigido na RPC**: agora filtra por `data_vencimento < fim do mês`. | 🐛 AUTO |
| B-10 | ✅ `contas-a-pagar.tsx` + RPC `get_previsao_mes` | Só retornava itens dentro do mês calendário atual — contas/faturas atrasadas de meses passados (mesmo com `status='atrasado'`) somiam da tela assim que o mês virava. **Corrigido**: removida a borda inferior de data nas 3 fontes (lembretes, faturas, parcelas) — agora traz tudo que vence até o fim do mês corrente e ainda não foi pago, incluindo atrasos antigos. | 🐛 AUTO |
| B-11 | ✅ `contas-a-pagar.tsx` (`pagar()`) | Ao pagar fatura de cartão OU parcela, inseria a transação de saída manualmente **e** chamava `pay_credit_card_bill`/deixava a transação já criada na compra — duplicando o débito. **Corrigido**: só o caminho `lembrete` cria transação nova; `fatura_cartao` delega inteiramente a `pay_credit_card_bill`; `parcela` só marca `status='pago'` (a transação já existe desde `create_installment_plan`). De quebra, achei que `create_installment_plan` nunca grava `installments.transaction_id` apesar da coluna existir — registrado como gap novo, não corrigido agora (fora do escopo desta lista, ver observação no rodapé). | 🐛 AUTO |
| B-12 | ✅ `financial-state.tsx` + RPC `recalc_financial_state_safe` | Classificava gasto essencial/estilo de vida por `transactions.is_essencial` (nunca sincronizada com o switch do `EditDrawer`), enquanto dashboard/situação usam `categories.is_essencial` — dois números completamente diferentes pro mesmo mês, mesma família. **Corrigido**: RPC agora faz join em `categories` e usa `c.is_essencial`, igual `get_dashboard_summary`/`get_projecao_categorias`; também exclui `categories.nome='Dívidas'` do bucket de estilo de vida (antes não excluía, só o de essenciais excluía). | 🐛 AUTO |
| B-13 | ✅ RPCs `activate_crisis` / `advance_crisis_stage` | Faziam INSERT/UPDATE em colunas `motivo`/`estagio` que não existem em `crisis_events` (colunas reais: `motivo_ativacao`/`estagio_atual`) — todo INSERT/UPDATE falhava com erro de coluna inexistente. **Corrigido**: RPCs recriadas com os nomes de coluna certos. | 🐛 AUTO |
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
| B-20 | ✅ RPC `finalizar_compra` | Somava `quantidade` do item direto no estoque sem multiplicar por `quantidade_por_embalagem` — subestimava drasticamente o estoque quando usada. **Corrigido**: multiplica por `quantidade_por_embalagem` (aplica ao estoque e ao registro em `stock_movements`). A sincronização mãe↔filho já estava correta nessa RPC (não precisou mexer). | 🐛 AUTO |
| B-21 | ✅ `compras.tsx` (fluxo "Finalizar compra") | Itens adicionados manualmente numa lista nunca recebem `product_id` (só o fluxo de "Importar" seta isso) — o loop de atualização de estoque dentro de `finalizar_compra` nunca encontra nada pra atualizar no caminho principal da UI, mas a mensagem de sucesso não deixava isso claro. **Corrigido de forma mínima**: adicionado aviso explicando o motivo quando `estoque_atualizado=0` mas houve itens comprados; não criei a tela de vincular produto (feature maior, fora do escopo de correção de bug). | 🐛 AUTO |
| B-22 | ✅ `gasolina.tsx` + RPC `get_maintenance_status` | Usava `COALESCE(mt.ultimo_km, 0)` — qualquer tipo de manutenção nunca registrado era automaticamente marcado "vencido". **Corrigido**: tipo sem nenhum registro (nem km nem data) agora cai num status próprio `sem_registro`. | 🐛 AUTO |
| B-23 | ✅ `gasolina.tsx` (`statusBadge`) | Testava string `"em_breve"`, mas o backend retorna `"proximo"` — o aviso amarelo nunca aparecia. **Corrigido**: badge e legenda de "motivo" ajustados pros status reais (`vencido`/`proximo`/`sem_registro`/`ok`); de quebra corrigi `key={r.type_id}` → `key={r.id}` e removi `r.icone`/`r.motivo` (colunas que nunca existiram no retorno da RPC, sempre undefined). | 🐛 AUTO |
| B-24 | ✅ `gasolina.tsx` + RPC `get_fuel_history` | km/L calculado sem checar se o abastecimento foi tanque cheio ou parcial — mesma sequência de abastecimentos do mesmo carro produzia de 3 a 43 km/L. **Corrigido**: `consumo_kml` só é calculado no abastecimento que fecha um ciclo (tanque cheio), dividindo a distância desde o cheio anterior pela soma de litros de todos os abastecimentos no meio (parciais inclusos) — cheio-a-cheio correto. Verificado com dados reais: valores agora ficam entre ~8,8 e ~9,4 km/L (um outlier de 38,88 km/L restou, mas é hodômetro com valor discrepante nos dados originais, não bug de fórmula). | 🐛 AUTO |
| B-25 | ✅ `vehicles.consumo_medio_km_l` + view `v_vehicle_status` | Campo estático editável sem validação, estava em 42 km/L pra um carro que consome ~9-13 km/L de verdade. **Corrigido**: a view agora calcula um `consumo_efetivo_km_l` a partir da média real do histórico (via `get_fuel_history`, já corrigida no B-24), caindo pro campo cadastrado só quando não há histórico suficiente; usado em todos os cálculos de litros/km/% restante. Também corrigido o valor cadastrado de `cronos` (42.03 → 11.02, a média real) como fallback atualizado. | 📎 DADO |
| B-26 | ✅ `gasolina.tsx` (editar/excluir abastecimento) | Não chamava `recalc_account_balance` depois de editar valor ou excluir um abastecimento. **Corrigido**: os dois caminhos agora buscam a conta da transação vinculada e recalculam o saldo. | 🐛 AUTO |
| B-27 | ✅ RPC `check_crisis_activation` | Calculava renda somando transações tipo receita do mês em vez de usar `financial_state.renda_mensal`. **Corrigido**: usa `renda_mensal` do mês (retorna `false` direto se não houver renda cadastrada, em vez de falso positivo). | 🐛 AUTO |
| B-28 | ✅ `financial-state.tsx` | Mostrava toast de "crise ativada automaticamente" mesmo quando a chamada ao RPC falhava. **Corrigido**: só mostra o toast (e só marca o banner) se `activate_crisis` retornar sem erro. | 🐛 AUTO |
| B-29 | ✅ `financial-state.tsx` (banner "Modo Crise ativado") | Nunca aparecia porque nenhuma função gravava `financial_state.modo_crise=true`. **Corrigido**: ao ativar crise com sucesso, atualiza `modo_crise=true` no registro do mês e reflete no estado local. | 🐛 AUTO |
| B-30 | ✅ `dashboard.tsx` (card "Comprometimento Mensal") | `salario: 11143.20` e `parcelas: 2543` **hardcoded** no código. **Corrigido**: `salario` agora vem de `get_dashboard_summary` (que já lê `financial_state.renda_mensal`); `parcelas` vem da soma real de `installments` pendentes com competência no mês atual. De quebra, removi 3 `console.log` de debug esquecidos (B-53). | 📎 DADO |
| B-31 | ✅ Edge Function `ai-assistant` + `configuracoes.tsx` | Contador "Uso hoje: X/Y" sempre mostrava 0 — RPC `count_ai_runs_today` lia de `daily_ai_runs`, mas a function grava em `ai_logs`. **Corrigido**: RPC agora lê de `ai_logs`. | 🐛 AUTO |
| B-32 | ✅ Edge Function `ai-assistant` + `configuracoes.tsx` | Campo "Limite diário de mensagens" configurável na UI não tinha efeito — limite real estava hardcoded em 20. **Corrigido**: a function agora lê `family_settings.ai_daily_limit` (fallback 20) e conta uso total do dia (antes contava só por `feature`, inconsistente com o contador exibido). Redeployado (v8). | 🐛 AUTO |

## 🟢 Médios

| ID | Página/arquivo | Bug | Cat |
|---|---|---|---|
| B-33 | ✅ `get_dashboard_summary` (score de saúde) | Penalizava duas vezes o mesmo fato ("gasto > renda") via duas condições redundantes, sem gradação por severidade. **Corrigido**: consolidado numa única penalidade graduada (−30 se estourou &gt;20%, −20 se estourou até 20%), mantendo a penalidade independente de essenciais&gt;60% da renda. | 🐛 AUTO |
| B-34 | ✅ `revisao-semanal.tsx` | Janela "semana atual" (8 dias, ambos extremos inclusive) vs "semana anterior" (7 dias) — inflava o comparativo mesmo sem mudança real de comportamento. **Corrigido**: as duas janelas agora têm exatamente 7 dias cada, contíguas. | 🐛 AUTO |
| B-35 | ✅ `compras.tsx` (listas concluídas) | `total_real` NULL exibido como "R$ 0,00" sem fallback pro `total_estimado`. **Corrigido**: fallback adicionado. | 🐛 AUTO |
| B-36 | ✅ `auth.tsx` | Fluxo de "nova senha" duplicado e morto dentro do arquivo. **Corrigido**: removido (schema, estado, handler, detecção de hash de recovery e o bloco JSX inteiro) — o fluxo real continua só em `/auth/reset-password`. | 🐛 AUTO |
| B-37 | ✅ RPC `accept_invite` | Race condition (TOCTOU) — `SELECT` de convite pendente sem `FOR UPDATE`. **Corrigido**: adicionado `FOR UPDATE` na busca do convite. | 🐛 AUTO |
| B-38 | ✅ `gasolina.tsx` (`MaintDialog`) | Escolhia a conta de pagamento automaticamente, sem campo de seleção. **Corrigido**: adicionado seletor de conta (só aparece quando há valor &gt; 0), igual ao padrão do `FillDialog`. | 🐛 AUTO |
| B-39 | ✅ Trigger `after_fuel_fill` / view `v_fuel_consumption` | `LIMIT 5` aplicado depois da agregação (não limitava nada); cálculo tanque-cheio-a-tanque-cheio ignorava litros de reabastecimentos parciais no meio do caminho. **Corrigido**: `v_fuel_consumption` agora soma litros de todos os abastecimentos (parciais inclusos) entre dois tanques cheios, mesma lógica de `get_fuel_history` (B-24); `after_fuel_fill` agora usa subquery com `ORDER BY ... LIMIT 5` antes do `avg()`, limitando de verdade às últimas 5 leituras. | 🐛 AUTO |

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
| B-54 | RPC `create_installment_plan` | Cria a transação de cada parcela corretamente, mas nunca grava o `id` dela de volta em `installments.transaction_id` (coluna existe, sempre fica NULL). Achado ao investigar B-11. Sem consumidor conhecido desse campo hoje, então não corrompe nada, mas qualquer feature futura que dependa desse vínculo vai encontrar tudo NULL. |

---

## Não são bugs — contexto/gaps de dado registrados, sem ação de código

- Nubank Roxinho sem `limite_credito` cadastrado (null) — dado faltando, não bug.
- `credit_card_bills`: ~21 faturas antigas com status desatualizado, não reconciliadas com pagamentos reais feitos fora do app.
- `financial_state` vazio para a família (0 linhas) — usado como fonte de renda em vários lugares (B-12, B-27, B-30); populá-lo corrige vários bugs de uma vez.
- Baixa taxa de vinculação produto↔item em compras históricas — a maioria das compras de mercado nunca deu entrada no estoque (comportamento intencional do fluxo atual, não bug).
