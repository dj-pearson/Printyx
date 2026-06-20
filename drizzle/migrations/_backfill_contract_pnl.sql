-- US-SUPER-003: Contract P&L X-ray — per-tenant settings + two materialized views.
-- Idempotent; hand-runnable:
--   psql "$DATABASE_URL" -f drizzle/migrations/_backfill_contract_pnl.sql
--
-- The views store RAW trailing-12-month aggregates only (copies, base, labor
-- hours, parts count, supplies cost); the dollar cost of labor/parts/financing
-- is applied at read time from contract_pnl_settings, so rate changes never
-- require a refresh. Refresh nightly (refresh-contract-pnl cron) + on-demand:
--   REFRESH MATERIALIZED VIEW contract_pnl_v;
--   REFRESH MATERIALIZED VIEW contract_pnl_monthly_v;
--
-- Cost/revenue attribution model (interpretable, v1):
--   * revenue   : meter_readings.black_copies/color_copies (per-period deltas)
--                 × contracts.black_rate/color_rate, attributed via
--                 meter_readings.contract_id; plus monthly_base.
--   * service   : service_tickets attributed to a contract via the
--                 (contract_id, equipment_id) pairs seen in meter_readings.
--   * supplies  : auto_supply_orders joined by equipment.serial_number (text,
--                 globally unique) to sidestep that table's integer tenant_id
--                 drift; guarded so the views still build where it is absent.

-- ---------------------------------------------------------------------------
-- contract_pnl_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "contract_pnl_settings" (
	"tenant_id" varchar PRIMARY KEY NOT NULL,
	"tech_burdened_rate" numeric(10,2) NOT NULL DEFAULT '75.00',
	"avg_part_cost" numeric(10,2) NOT NULL DEFAULT '45.00',
	"financing_rate" double precision NOT NULL DEFAULT 0,
	"gp_alert_threshold" integer NOT NULL DEFAULT 20,
	"digest_enabled" boolean NOT NULL DEFAULT true,
	"last_refreshed_at" timestamp,
	"updated_by_user_id" varchar,
	"updated_at" timestamp NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- contract_pnl_v — one row per contract (trailing 12 months)
-- ---------------------------------------------------------------------------
DO $outer$
DECLARE
	has_supply boolean := to_regclass('public.auto_supply_orders') IS NOT NULL;
BEGIN
	IF to_regclass('public.contract_pnl_v') IS NOT NULL THEN
		RETURN; -- already created; nothing to do (idempotent)
	END IF;

	EXECUTE format($mv$
		CREATE MATERIALIZED VIEW contract_pnl_v AS
		WITH ce AS (
			SELECT DISTINCT contract_id, equipment_id, tenant_id
			FROM meter_readings
			WHERE contract_id IS NOT NULL
		),
		rev AS (
			SELECT mr.contract_id,
				SUM(COALESCE(mr.black_copies, 0)) AS black_copies,
				SUM(COALESCE(mr.color_copies, 0)) AS color_copies
			FROM meter_readings mr
			WHERE mr.contract_id IS NOT NULL
				AND mr.reading_date >= (now() - interval '12 months')
			GROUP BY mr.contract_id
		),
		svc AS (
			SELECT ce.contract_id,
				COALESCE(SUM(COALESCE(st.labor_hours, 0)), 0) AS labor_hours,
				COALESCE(SUM(COALESCE(array_length(st.parts_used, 1), 0)), 0) AS parts_count
			FROM ce
			JOIN service_tickets st
				ON st.equipment_id = ce.equipment_id
				AND st.tenant_id = ce.tenant_id
				AND st.created_at >= (now() - interval '12 months')
			GROUP BY ce.contract_id
		),
		sup AS (
			%s
		)
		SELECT
			c.tenant_id,
			c.id AS contract_id,
			c.contract_number,
			c.customer_id,
			c.start_date,
			c.end_date,
			c.status,
			c.monthly_base,
			COALESCE(rev.black_copies, 0) AS black_copies_12mo,
			COALESCE(rev.color_copies, 0) AS color_copies_12mo,
			(COALESCE(rev.black_copies, 0) * COALESCE(c.black_rate, 0)
				+ COALESCE(rev.color_copies, 0) * COALESCE(c.color_rate, 0)) AS copies_revenue_12mo,
			(COALESCE(c.monthly_base, 0) * 12) AS base_revenue_12mo,
			COALESCE(svc.labor_hours, 0) AS labor_hours_12mo,
			COALESCE(svc.parts_count, 0) AS parts_count_12mo,
			COALESCE(sup.supplies_cost, 0) AS supplies_cost_12mo
		FROM contracts c
		LEFT JOIN rev ON rev.contract_id = c.id
		LEFT JOIN svc ON svc.contract_id = c.id
		LEFT JOIN sup ON sup.contract_id = c.id
	$mv$,
		CASE WHEN has_supply THEN $sup$
			SELECT ce.contract_id,
				COALESCE(SUM(COALESCE(aso.total_price, 0) + COALESCE(aso.shipping_cost, 0)), 0) AS supplies_cost
			FROM ce
			JOIN equipment e ON e.id = ce.equipment_id
			JOIN auto_supply_orders aso ON aso.serial_number = e.serial_number
				AND aso.order_date >= (now() - interval '12 months')
			GROUP BY ce.contract_id
		$sup$ ELSE $nosup$
			SELECT NULL::varchar AS contract_id, 0::numeric AS supplies_cost WHERE false
		$nosup$ END);
END
$outer$;

CREATE UNIQUE INDEX IF NOT EXISTS "contract_pnl_v_contract_idx"
	ON "contract_pnl_v" ("contract_id");
CREATE INDEX IF NOT EXISTS "contract_pnl_v_tenant_idx"
	ON "contract_pnl_v" ("tenant_id");

-- ---------------------------------------------------------------------------
-- contract_pnl_monthly_v — one row per (contract, month) for the last 12 months
-- ---------------------------------------------------------------------------
DO $outer$
DECLARE
	has_supply boolean := to_regclass('public.auto_supply_orders') IS NOT NULL;
BEGIN
	IF to_regclass('public.contract_pnl_monthly_v') IS NOT NULL THEN
		RETURN;
	END IF;

	EXECUTE format($mv$
		CREATE MATERIALIZED VIEW contract_pnl_monthly_v AS
		WITH ce AS (
			SELECT DISTINCT contract_id, equipment_id, tenant_id
			FROM meter_readings
			WHERE contract_id IS NOT NULL
		),
		months AS (
			SELECT generate_series(
				date_trunc('month', now()) - interval '11 months',
				date_trunc('month', now()),
				interval '1 month'
			) AS month
		),
		rev AS (
			SELECT mr.contract_id, date_trunc('month', mr.reading_date) AS month,
				SUM(COALESCE(mr.black_copies, 0)) AS black_copies,
				SUM(COALESCE(mr.color_copies, 0)) AS color_copies
			FROM meter_readings mr
			WHERE mr.contract_id IS NOT NULL
				AND mr.reading_date >= date_trunc('month', now()) - interval '11 months'
			GROUP BY mr.contract_id, date_trunc('month', mr.reading_date)
		),
		svc AS (
			SELECT ce.contract_id, date_trunc('month', st.created_at) AS month,
				SUM(COALESCE(st.labor_hours, 0)) AS labor_hours,
				SUM(COALESCE(array_length(st.parts_used, 1), 0)) AS parts_count
			FROM ce
			JOIN service_tickets st
				ON st.equipment_id = ce.equipment_id AND st.tenant_id = ce.tenant_id
			WHERE st.created_at >= date_trunc('month', now()) - interval '11 months'
			GROUP BY ce.contract_id, date_trunc('month', st.created_at)
		),
		sup AS (
			%s
		)
		SELECT
			c.tenant_id,
			c.id AS contract_id,
			m.month,
			c.monthly_base,
			(COALESCE(rev.black_copies, 0) * COALESCE(c.black_rate, 0)
				+ COALESCE(rev.color_copies, 0) * COALESCE(c.color_rate, 0)) AS copies_revenue,
			COALESCE(c.monthly_base, 0) AS base_revenue,
			COALESCE(svc.labor_hours, 0) AS labor_hours,
			COALESCE(svc.parts_count, 0) AS parts_count,
			COALESCE(sup.supplies_cost, 0) AS supplies_cost
		FROM contracts c
		CROSS JOIN months m
		LEFT JOIN rev ON rev.contract_id = c.id AND rev.month = m.month
		LEFT JOIN svc ON svc.contract_id = c.id AND svc.month = m.month
		LEFT JOIN sup ON sup.contract_id = c.id AND sup.month = m.month
	$mv$,
		CASE WHEN has_supply THEN $sup$
			SELECT ce.contract_id, date_trunc('month', aso.order_date) AS month,
				SUM(COALESCE(aso.total_price, 0) + COALESCE(aso.shipping_cost, 0)) AS supplies_cost
			FROM ce
			JOIN equipment e ON e.id = ce.equipment_id
			JOIN auto_supply_orders aso ON aso.serial_number = e.serial_number
			WHERE aso.order_date >= date_trunc('month', now()) - interval '11 months'
			GROUP BY ce.contract_id, date_trunc('month', aso.order_date)
		$sup$ ELSE $nosup$
			SELECT NULL::varchar AS contract_id, now() AS month, 0::numeric AS supplies_cost WHERE false
		$nosup$ END);
END
$outer$;

CREATE INDEX IF NOT EXISTS "contract_pnl_monthly_v_tenant_idx"
	ON "contract_pnl_monthly_v" ("tenant_id");
CREATE INDEX IF NOT EXISTS "contract_pnl_monthly_v_contract_idx"
	ON "contract_pnl_monthly_v" ("contract_id", "month");
