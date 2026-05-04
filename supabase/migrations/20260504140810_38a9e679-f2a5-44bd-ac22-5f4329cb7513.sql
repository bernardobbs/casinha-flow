
-- Enums
CREATE TYPE public.vehicle_type AS ENUM ('carro', 'moto', 'caminhao', 'outro');
CREATE TYPE public.fuel_type AS ENUM ('gasolina', 'aditivada', 'etanol', 'diesel', 'gnv');

-- vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo vehicle_type NOT NULL DEFAULT 'carro',
  combustivel_principal fuel_type NOT NULL DEFAULT 'gasolina',
  flex BOOLEAN NOT NULL DEFAULT true,
  capacidade_tanque NUMERIC(6,2) NOT NULL DEFAULT 50,
  consumo_medio_kml NUMERIC(6,2) NOT NULL DEFAULT 10,
  odometro_atual NUMERIC(10,1) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  cor TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family vehicles" ON public.vehicles FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family vehicles" ON public.vehicles FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Update own family vehicles" ON public.vehicles FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family vehicles" ON public.vehicles FOR DELETE USING (family_id = get_user_family_id(auth.uid()));

-- fuel_fills
CREATE TABLE public.fuel_fills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  combustivel fuel_type NOT NULL,
  valor_pago NUMERIC(10,2) NOT NULL,
  preco_litro NUMERIC(8,3) NOT NULL,
  litros NUMERIC(8,3) NOT NULL,
  hodometro NUMERIC(10,1) NOT NULL,
  posto TEXT,
  tanque_cheio BOOLEAN NOT NULL DEFAULT true,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fuel_fills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family fills" ON public.fuel_fills FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family fills" ON public.fuel_fills FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Update own family fills" ON public.fuel_fills FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family fills" ON public.fuel_fills FOR DELETE USING (family_id = get_user_family_id(auth.uid()));
CREATE INDEX idx_fuel_fills_vehicle_data ON public.fuel_fills(vehicle_id, data DESC);

-- fuel_monthly_goals
CREATE TABLE public.fuel_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  mes DATE NOT NULL,
  valor_meta NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(family_id, vehicle_id, mes)
);
ALTER TABLE public.fuel_monthly_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family fuel goals" ON public.fuel_monthly_goals FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family fuel goals" ON public.fuel_monthly_goals FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Update own family fuel goals" ON public.fuel_monthly_goals FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family fuel goals" ON public.fuel_monthly_goals FOR DELETE USING (family_id = get_user_family_id(auth.uid()));

-- vehicle_maintenance_types
CREATE TABLE public.vehicle_maintenance_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  icone TEXT NOT NULL DEFAULT '🔧',
  intervalo_km INT,
  intervalo_meses INT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_maintenance_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family maint types" ON public.vehicle_maintenance_types FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family maint types" ON public.vehicle_maintenance_types FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Update own family maint types" ON public.vehicle_maintenance_types FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family maint types" ON public.vehicle_maintenance_types FOR DELETE USING (family_id = get_user_family_id(auth.uid()));

-- vehicle_maintenance_log
CREATE TABLE public.vehicle_maintenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL,
  user_id UUID NOT NULL,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type_id UUID REFERENCES public.vehicle_maintenance_types(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  hodometro NUMERIC(10,1) NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  local TEXT,
  tipo_oleo TEXT,
  observacao TEXT,
  transaction_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_maintenance_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own family maint log" ON public.vehicle_maintenance_log FOR SELECT USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Insert own family maint log" ON public.vehicle_maintenance_log FOR INSERT WITH CHECK (family_id = get_user_family_id(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Update own family maint log" ON public.vehicle_maintenance_log FOR UPDATE USING (family_id = get_user_family_id(auth.uid()));
CREATE POLICY "Delete own family maint log" ON public.vehicle_maintenance_log FOR DELETE USING (family_id = get_user_family_id(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_vehicles_upd BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fuel_goals_upd BEFORE UPDATE ON public.fuel_monthly_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default maintenance types when a vehicle is created
CREATE OR REPLACE FUNCTION public.seed_default_maintenance_types()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.vehicle_maintenance_types (family_id, vehicle_id, nome, icone, intervalo_km, intervalo_meses) VALUES
    (NEW.family_id, NEW.id, 'Troca de óleo', '🛢️', 5000, 6),
    (NEW.family_id, NEW.id, 'Revisão', '🔧', 10000, 12),
    (NEW.family_id, NEW.id, 'Rodízio de pneus', '🛞', 10000, NULL);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_seed_maint AFTER INSERT ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.seed_default_maintenance_types();

-- View: vehicle status
CREATE OR REPLACE VIEW public.v_vehicle_status
WITH (security_invoker = true) AS
SELECT
  v.id AS vehicle_id,
  v.family_id,
  v.nome,
  v.tipo,
  v.cor,
  v.flex,
  v.capacidade_tanque,
  v.consumo_medio_kml,
  v.odometro_atual,
  v.ativo,
  last_fill.data AS ultimo_abastec_data,
  last_fill.combustivel AS ultimo_abastec_combustivel,
  last_fill.preco_litro AS ultimo_abastec_preco_litro,
  last_fill.litros AS ultimo_abastec_litros,
  last_fill.hodometro AS ultimo_abastec_hodometro,
  last_fill.tanque_cheio AS ultimo_abastec_tanque_cheio,
  -- Tanque estimado (% restante)
  CASE
    WHEN last_fill.id IS NULL OR v.consumo_medio_kml <= 0 THEN NULL
    ELSE GREATEST(0, LEAST(100, ROUND(
      ((last_fill.litros - ((v.odometro_atual - last_fill.hodometro) / NULLIF(v.consumo_medio_kml,0)))
        / NULLIF(v.capacidade_tanque,0)) * 100, 1)))
  END AS tanque_pct,
  CASE
    WHEN last_fill.id IS NULL OR v.consumo_medio_kml <= 0 THEN NULL
    ELSE GREATEST(0, ROUND(
      (last_fill.litros - ((v.odometro_atual - last_fill.hodometro) / NULLIF(v.consumo_medio_kml,0)))
      * v.consumo_medio_kml, 0))
  END AS km_restantes,
  COALESCE(mes.gasto_mes, 0) AS gasto_mes
FROM public.vehicles v
LEFT JOIN LATERAL (
  SELECT * FROM public.fuel_fills f
   WHERE f.vehicle_id = v.id ORDER BY f.data DESC, f.created_at DESC LIMIT 1
) last_fill ON true
LEFT JOIN LATERAL (
  SELECT SUM(valor_pago) AS gasto_mes FROM public.fuel_fills f
   WHERE f.vehicle_id = v.id
     AND f.data >= date_trunc('month', CURRENT_DATE)::date
     AND f.data < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
) mes ON true;

-- Calc km/L per fill (between consecutive full tanks)
CREATE OR REPLACE FUNCTION public.get_fuel_history(p_vehicle_id UUID)
RETURNS TABLE (
  id UUID, data DATE, combustivel fuel_type, litros NUMERIC, preco_litro NUMERIC,
  valor_pago NUMERIC, hodometro NUMERIC, posto TEXT, tanque_cheio BOOLEAN, kml NUMERIC
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fam UUID;
BEGIN
  SELECT family_id INTO v_fam FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_fam IS NULL OR v_fam <> get_user_family_id(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  RETURN QUERY
  WITH ordered AS (
    SELECT f.*, LAG(f.hodometro) OVER (ORDER BY f.data, f.created_at) AS prev_hod,
           LAG(f.tanque_cheio) OVER (ORDER BY f.data, f.created_at) AS prev_full
    FROM public.fuel_fills f WHERE f.vehicle_id = p_vehicle_id
  )
  SELECT o.id, o.data, o.combustivel, o.litros, o.preco_litro, o.valor_pago,
         o.hodometro, o.posto, o.tanque_cheio,
         CASE WHEN o.tanque_cheio AND o.prev_full AND o.litros > 0
              THEN ROUND((o.hodometro - o.prev_hod) / NULLIF(o.litros,0), 2)
              ELSE NULL END AS kml
  FROM ordered o ORDER BY o.data DESC, o.created_at DESC;
END; $$;

-- Maintenance status
CREATE OR REPLACE FUNCTION public.get_maintenance_status(p_vehicle_id UUID)
RETURNS TABLE (
  type_id UUID, nome TEXT, icone TEXT, intervalo_km INT, intervalo_meses INT,
  ultima_data DATE, ultimo_hodometro NUMERIC, status TEXT, motivo TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_fam UUID; v_odo NUMERIC;
BEGIN
  SELECT family_id, odometro_atual INTO v_fam, v_odo FROM public.vehicles WHERE id = p_vehicle_id;
  IF v_fam IS NULL OR v_fam <> get_user_family_id(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  RETURN QUERY
  SELECT t.id, t.nome, t.icone, t.intervalo_km, t.intervalo_meses,
    last_log.data, last_log.hodometro,
    CASE
      WHEN last_log.data IS NULL THEN 'pendente'
      WHEN (t.intervalo_km IS NOT NULL AND v_odo - last_log.hodometro >= t.intervalo_km)
        OR (t.intervalo_meses IS NOT NULL AND last_log.data + (t.intervalo_meses || ' month')::interval <= CURRENT_DATE)
        THEN 'vencido'
      WHEN (t.intervalo_km IS NOT NULL AND v_odo - last_log.hodometro >= t.intervalo_km * 0.85)
        OR (t.intervalo_meses IS NOT NULL AND last_log.data + ((t.intervalo_meses * 0.85)::int || ' month')::interval <= CURRENT_DATE)
        THEN 'em_breve'
      ELSE 'ok'
    END AS status,
    CASE
      WHEN last_log.data IS NULL THEN 'Nunca registrado'
      WHEN t.intervalo_km IS NOT NULL THEN (v_odo - last_log.hodometro)::text || ' km desde a última'
      ELSE 'Última: ' || last_log.data::text
    END AS motivo
  FROM public.vehicle_maintenance_types t
  LEFT JOIN LATERAL (
    SELECT data, hodometro FROM public.vehicle_maintenance_log l
     WHERE l.vehicle_id = p_vehicle_id AND l.maintenance_type_id = t.id
     ORDER BY l.data DESC LIMIT 1
  ) last_log ON true
  WHERE t.vehicle_id = p_vehicle_id AND t.ativo = true
  ORDER BY t.nome;
END; $$;
