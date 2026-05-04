
-- Enums
CREATE TYPE public.stock_location AS ENUM ('geladeira', 'freezer', 'despensa', 'armario', 'outro');
CREATE TYPE public.stock_unit AS ENUM ('un', 'kg', 'g', 'L', 'ml', 'pct');
CREATE TYPE public.stock_movement_type AS ENUM ('entrada', 'saida', 'ajuste', 'perda');

-- products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  marca TEXT,
  unidade stock_unit NOT NULL DEFAULT 'un',
  localizacao stock_location NOT NULL DEFAULT 'despensa',
  quantidade_atual NUMERIC(10,3) NOT NULL DEFAULT 0,
  quantidade_minima NUMERIC(10,3) NOT NULL DEFAULT 1,
  preco_atual NUMERIC(10,2),
  data_validade DATE,
  codigo_barras TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family products" ON public.products FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family products" ON public.products FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Update own family products" ON public.products FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family products" ON public.products FOR DELETE USING (family_id = get_user_family_id(auth.uid()));
CREATE INDEX idx_products_family ON public.products(family_id, ativo);

-- stock_movements
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tipo stock_movement_type NOT NULL,
  quantidade NUMERIC(10,3) NOT NULL,
  preco_unitario NUMERIC(10,2),
  motivo TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family movements" ON public.stock_movements FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family movements" ON public.stock_movements FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Update own family movements" ON public.stock_movements FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family movements" ON public.stock_movements FOR DELETE USING (family_id = get_user_family_id(auth.uid()));
CREATE INDEX idx_movements_product ON public.stock_movements(product_id, data DESC);

-- price_history
CREATE TABLE public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  preco NUMERIC(10,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family prices" ON public.price_history FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family prices" ON public.price_history FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()));
CREATE INDEX idx_price_hist ON public.price_history(product_id, data DESC);

-- consumption_history
CREATE TABLE public.consumption_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  mes DATE NOT NULL,
  quantidade_consumida NUMERIC(10,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, mes)
);
ALTER TABLE public.consumption_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family consumption" ON public.consumption_history FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family consumption" ON public.consumption_history FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Update own family consumption" ON public.consumption_history FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));

-- cycle_config (frequência de compras por família)
CREATE TABLE public.cycle_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL UNIQUE,
  frequencia_dias INT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cycle_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family cycle" ON public.cycle_config FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family cycle" ON public.cycle_config FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Update own family cycle" ON public.cycle_config FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_products_upd BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cycle_upd BEFORE UPDATE ON public.cycle_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: registrar price_history quando preco_atual muda
CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.preco_atual IS NOT NULL AND NEW.preco_atual <> COALESCE(OLD.preco_atual, -1) THEN
    INSERT INTO public.price_history (family_id, product_id, preco, data)
    VALUES (NEW.family_id, NEW.id, NEW.preco_atual, CURRENT_DATE);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_price_log_ins AFTER INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_price_change();
CREATE TRIGGER trg_price_log_upd AFTER UPDATE OF preco_atual ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_price_change();

-- Trigger: aplicar movimento na quantidade do produto
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delta NUMERIC;
BEGIN
  v_delta := CASE NEW.tipo
    WHEN 'entrada' THEN NEW.quantidade
    WHEN 'saida' THEN -NEW.quantidade
    WHEN 'perda' THEN -NEW.quantidade
    WHEN 'ajuste' THEN NEW.quantidade
  END;
  IF NEW.tipo = 'ajuste' THEN
    UPDATE public.products SET quantidade_atual = NEW.quantidade, updated_at = now()
      WHERE id = NEW.product_id;
  ELSE
    UPDATE public.products SET quantidade_atual = GREATEST(0, quantidade_atual + v_delta), updated_at = now()
      WHERE id = NEW.product_id;
  END IF;
  -- Atualiza preço se entrada com preço informado
  IF NEW.tipo = 'entrada' AND NEW.preco_unitario IS NOT NULL THEN
    UPDATE public.products SET preco_atual = NEW.preco_unitario WHERE id = NEW.product_id;
  END IF;
  -- Consumo histórico (saída/perda)
  IF NEW.tipo IN ('saida','perda') THEN
    INSERT INTO public.consumption_history (family_id, product_id, mes, quantidade_consumida)
    VALUES (NEW.family_id, NEW.product_id, date_trunc('month', NEW.data)::date, NEW.quantidade)
    ON CONFLICT (product_id, mes) DO UPDATE
      SET quantidade_consumida = consumption_history.quantidade_consumida + EXCLUDED.quantidade_consumida;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_apply_movement AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- View: v_stock_status
CREATE OR REPLACE VIEW public.v_stock_status
WITH (security_invoker = true) AS
SELECT
  p.id AS product_id,
  p.family_id,
  p.nome, p.categoria, p.marca, p.unidade, p.localizacao,
  p.quantidade_atual, p.quantidade_minima, p.preco_atual,
  p.data_validade, p.ativo,
  -- Consumo médio diário (últimos 90 dias)
  COALESCE((
    SELECT SUM(quantidade) / 90.0 FROM public.stock_movements m
     WHERE m.product_id = p.id AND m.tipo IN ('saida','perda')
       AND m.data >= CURRENT_DATE - INTERVAL '90 days'
  ), 0) AS consumo_diario,
  -- Dias restantes
  CASE
    WHEN COALESCE((
      SELECT SUM(quantidade) / 90.0 FROM public.stock_movements m
       WHERE m.product_id = p.id AND m.tipo IN ('saida','perda')
         AND m.data >= CURRENT_DATE - INTERVAL '90 days'
    ), 0) > 0
    THEN ROUND(p.quantidade_atual / (
      SELECT SUM(quantidade) / 90.0 FROM public.stock_movements m
       WHERE m.product_id = p.id AND m.tipo IN ('saida','perda')
         AND m.data >= CURRENT_DATE - INTERVAL '90 days'
    ))::int
    ELSE NULL
  END AS dias_restantes,
  -- Status
  CASE
    WHEN p.quantidade_atual <= 0 THEN 'critico'
    WHEN p.quantidade_atual <= p.quantidade_minima THEN 'baixo'
    WHEN p.quantidade_atual <= (p.quantidade_minima * 1.5) THEN 'atencao'
    ELSE 'normal'
  END AS status,
  -- Risco de ruptura: dias_restantes <= 7 OU qtd <= mínima
  CASE
    WHEN p.quantidade_atual <= p.quantidade_minima THEN true
    WHEN COALESCE((
      SELECT SUM(quantidade) / 90.0 FROM public.stock_movements m
       WHERE m.product_id = p.id AND m.tipo IN ('saida','perda')
         AND m.data >= CURRENT_DATE - INTERVAL '90 days'
    ), 0) > 0
      AND p.quantidade_atual / NULLIF((
        SELECT SUM(quantidade) / 90.0 FROM public.stock_movements m
         WHERE m.product_id = p.id AND m.tipo IN ('saida','perda')
           AND m.data >= CURRENT_DATE - INTERVAL '90 days'
      ), 0) <= 7 THEN true
    ELSE false
  END AS risco_ruptura,
  -- Dias para vencer
  CASE WHEN p.data_validade IS NOT NULL
    THEN (p.data_validade - CURRENT_DATE)::int
    ELSE NULL END AS dias_para_vencer,
  -- Variação % preço (vs preço anterior do histórico)
  CASE
    WHEN p.preco_atual IS NULL THEN NULL
    WHEN prev.preco IS NULL OR prev.preco = 0 THEN NULL
    ELSE ROUND(((p.preco_atual - prev.preco) / prev.preco) * 100, 1)
  END AS variacao_preco_pct,
  prev.preco AS preco_anterior
FROM public.products p
LEFT JOIN LATERAL (
  SELECT preco FROM public.price_history h
   WHERE h.product_id = p.id
   ORDER BY h.data DESC, h.created_at DESC
   OFFSET 1 LIMIT 1
) prev ON true
WHERE p.ativo = true;
