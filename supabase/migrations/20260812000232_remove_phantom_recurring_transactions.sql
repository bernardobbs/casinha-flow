-- generate_recurring_transactions (chamada automaticamente em toda sessão
-- via RecurringAutoGen.tsx) criava uma transação já "paga" assim que a data
-- do mês chegava, sem confirmação nenhuma — e quando a pessoa confirmava o
-- pagamento de verdade em /contas-a-pagar, uma SEGUNDA transação era criada
-- pro mesmo item (contas-a-pagar.tsx's `pagar()`). Toda conta recorrente
-- confirmada acabava contada duas vezes em essenciais/DRE/orçamento/saldo.
--
-- O código (RecurringAutoGen.tsx) parou de chamar generate_recurring_transactions
-- nesta mesma leva de mudanças — recorrente agora só vira transação real
-- através da confirmação de pagamento em /contas-a-pagar.
--
-- Esta migração remove as 5 transações "fantasma" de agosto/2026 que já
-- tinham sido criadas por esse bug (nenhuma tinha lembrete pago
-- correspondente — dinheiro nunca confirmado como tendo saído da conta) e
-- recalcula o saldo da conta afetada e o estado financeiro do mês.
-- Idempotente: um id que já não existe simplesmente não é afetado.

DELETE FROM transactions WHERE id IN (
  'c8414842-ab38-4851-b66e-6509e6efccb4', -- Escola Alana, R$800
  'b186cd38-7a9d-4cb2-8743-b3c7a7be7bc2', -- Intellectus Clara, R$700
  '17ac7fae-3726-4e5a-9c4d-fdda4320ae4f', -- Equatorial Energia, R$800
  'a85a333e-a363-47b7-9ecc-9c7b4ba1be2b', -- Água Mineral Galão, R$120
  '1fb157e6-2855-445d-99d4-5eb04e065b35'  -- Diarista Mensal, R$1000
);

SELECT recalc_account_balance('b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid);
SELECT recalc_financial_state('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, date_trunc('month', current_date)::date);
