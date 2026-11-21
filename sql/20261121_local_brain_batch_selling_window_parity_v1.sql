-- BIG BROTHER Local Brain V5/V6 - Batch Editor Selling Window Parity
-- 21-Nov-2026 | Safe, idempotent schema + RPC update; NO batch/invoice/stock data changes.
-- Apply ONLY to the offline local PostgreSQL container, AFTER a full local backup.
-- This keeps existing Local Brain functions if already compatible; fails closed
-- if their signatures or security rules differ from the expected implementation.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '90s';

DO $preflight$
BEGIN
  IF to_regclass('public.stock_batches') IS NULL OR
     to_regclass('public.invoices') IS NULL OR
     to_regclass('public.system_activity_log') IS NULL THEN
    RAISE EXCEPTION 'Required BIG BROTHER Local Brain tables are missing. No changes applied.';
  END IF;
  IF to_regprocedure('public.bb_stock_batch_edit_options(text)') IS NULL OR
     to_regprocedure('public.bb_sales_open_batches()') IS NULL OR
     to_regprocedure('public.bb_is_admin()') IS NULL OR
     to_regprocedure('public.bb_actor_staff_id()') IS NULL OR
     to_regprocedure('public.bb_actor_name()') IS NULL THEN
    RAISE EXCEPTION 'Required Local Brain RPCs are missing. Do NOT apply partial patch.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='stock_batches' AND column_name='batch_date'
  ) THEN
    RAISE EXCEPTION 'Local stock_batches schema is not compatible.';
  END IF;
END;
$preflight$;

-- Legacy batches can stay NULL (no retroactive restriction).
ALTER TABLE public.stock_batches ADD COLUMN IF NOT EXISTS selling_date_from date;
ALTER TABLE public.stock_batches ADD COLUMN IF NOT EXISTS selling_date_to date;

-- Preserve exact existing Local stock edit logic; extend only its JSON response.
DO $add_window_read$
DECLARE
  v_old text;
  v_marker text := '''batchDate'',v_batch.batch_date::text,';
  v_extra text :=
    chr(10)||'      ''sellingDateFrom'',v_batch.selling_date_from::text,'||
    chr(10)||'      ''sellingDateTo'',v_batch.selling_date_to::text,';
BEGIN
  v_old := pg_get_functiondef('public.bb_stock_batch_edit_options(text)'::regprocedure);
  IF position('''sellingDateFrom''' IN v_old)>0 AND position('''sellingDateTo''' IN v_old)>0 THEN
    RAISE NOTICE 'Batch Editor RPC already includes allowed selling dates';
  ELSIF position('''sellingDateFrom''' IN v_old)>0 OR position('''sellingDateTo''' IN v_old)>0 THEN
    RAISE EXCEPTION 'Partial selling-date response detected; manual inspection required';
  ELSIF position(v_marker IN v_old)=0 THEN
    RAISE EXCEPTION 'Unknown Local Batch Editor RPC shape; no changes applied';
  ELSE
    EXECUTE replace(v_old,v_marker,v_marker||v_extra);
  END IF;
END;
$add_window_read$;

-- Install exact Cloud-equivalent Admin-only save RPC if absent.
-- Never overwrite a pre-existing Local function with different safeguards.
DO $admin_install$
DECLARE v_current text;
BEGIN
  IF to_regprocedure('public.bb_stock_admin_update_selling_window_v1(text,date,date,text)') IS NULL THEN
    EXECUTE $cloud_admin$
      CREATE OR REPLACE FUNCTION public.bb_stock_admin_update_selling_window_v1(p_batch_id text, p_from date, p_to date, p_reason text)
       RETURNS jsonb
       LANGUAGE plpgsql
       SECURITY DEFINER
       SET search_path TO ''
      AS $function$
      DECLARE v_batch public.stock_batches%ROWTYPE;
      BEGIN
       IF auth.uid() IS NULL OR NOT public.bb_is_admin() THEN
         RAISE EXCEPTION 'Only Admin may change an issued Batch date range'; END IF;
       IF length(btrim(coalesce(p_reason,'')))<5 THEN
         RAISE EXCEPTION 'Enter an audit reason (at least 5 characters)'; END IF;
       IF p_from IS NULL OR p_to IS NULL OR p_to<p_from THEN
         RAISE EXCEPTION 'Invalid Batch date window'; END IF;
       SELECT * INTO v_batch FROM public.stock_batches
       WHERE batch_id=btrim(coalesce(p_batch_id,'')) FOR UPDATE;
       IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;
       IF upper(btrim(v_batch.status)) <> 'OPEN' THEN
         RAISE EXCEPTION 'Only open Batch date windows can be corrected'; END IF;
       IF EXISTS (SELECT 1 FROM public.invoices i
         WHERE (i.batch_id=v_batch.batch_id OR i.batch_number=v_batch.batch_id)
           AND (i.invoice_date<p_from OR i.invoice_date>p_to))
       THEN RAISE EXCEPTION 'Existing Batch invoices fall outside the proposed date range'; END IF;
       UPDATE public.stock_batches
       SET selling_date_from=p_from,selling_date_to=p_to
       WHERE batch_id=v_batch.batch_id;
       INSERT INTO public.system_activity_log(
         actor_user_id,actor_staff_id,actor_name,module_key,action,
         entity_type,entity_id,location_code,summary,metadata)
       VALUES(auth.uid(),public.bb_actor_staff_id(),public.bb_actor_name(),
         'Stock Management','BATCH_SELLING_WINDOW_UPDATE',
         'stock_batches',v_batch.batch_id,v_batch.location_code,
         'Admin updated Batch selling-date window - '||v_batch.batch_id,
         jsonb_build_object('reason',p_reason,
            'oldFrom',v_batch.selling_date_from,'oldTo',v_batch.selling_date_to,
            'newFrom',p_from,'newTo',p_to));
       RETURN jsonb_build_object('success',true,'batchId',v_batch.batch_id,
         'sellingDateFrom',p_from,'sellingDateTo',p_to);
      END;$function$
    $cloud_admin$;
    RAISE NOTICE 'Installed local Admin-only Batch selling window correction RPC';
  ELSE
    v_current := pg_get_functiondef('public.bb_stock_admin_update_selling_window_v1(text,date,date,text)'::regprocedure);
    IF position('public.bb_is_admin()' IN v_current)=0 OR
       position('BATCH_SELLING_WINDOW_UPDATE' IN v_current)=0 OR
       position('Existing Batch invoices fall outside' IN v_current)=0 OR
       position('Only open Batch date windows' IN v_current)=0 THEN
      RAISE EXCEPTION 'Local selling-window save RPC differs from protected Cloud version; abort';
    END IF;
    RAISE NOTICE 'Existing protected Admin-only correction RPC preserved';
  END IF;
END;
$admin_install$;

-- Limit API execution to signed-in users; function also checks real Admin role.
REVOKE EXECUTE ON FUNCTION public.bb_stock_admin_update_selling_window_v1(text,date,date,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bb_stock_admin_update_selling_window_v1(text,date,date,text)
  TO authenticated;

-- Ensure Invoice Generator receives the identical ranges from the Batch selector.
-- Existing session and location permissions remain checked in the same RPC.
DO $invoice_window$
DECLARE v_old text;
BEGIN
  v_old := pg_get_functiondef('public.bb_sales_open_batches()'::regprocedure);
  IF position('sellingDateFrom' IN v_old)>0 AND position('sellingDateTo' IN v_old)>0 THEN
    RAISE NOTICE 'Invoice Generator batch picker already exposes selling windows';
  ELSE
    IF to_regprocedure('public.bb_sales_open_batches_core_access_v1()') IS NULL THEN
      RAISE EXCEPTION 'Invoice Batch core_access_v1 is unavailable: do not replace older Local API';
    END IF;
    IF position('public.bb_stock_open_batches_v2_internal()' IN v_old)=0 AND
       position('public.bb_sales_open_batches_core_access_v1()' IN v_old)=0 THEN
      RAISE EXCEPTION 'Unknown Local Invoice Generator batch picker: no changes applied';
    END IF;
    EXECUTE $cloud_invoice$
      CREATE OR REPLACE FUNCTION public.bb_sales_open_batches()
       RETURNS jsonb
       LANGUAGE plpgsql
       STABLE SECURITY DEFINER
       SET search_path TO 'public'
      AS $function$
      declare v jsonb; v_batches jsonb;
      begin
        if not (public.bb_has_module_access('invoice_generator','view') or public.bb_has_module_access('invoice_generator','create')) then raise exception 'Invoice Generator access denied'; end if;
        v:=public.bb_sales_open_batches_core_access_v1();
        select coalesce(jsonb_agg(
          x || jsonb_build_object('sellingDateFrom',b.selling_date_from,'sellingDateTo',b.selling_date_to)
          ),'[]'::jsonb) into v_batches
        from jsonb_array_elements(coalesce(v->'batches','[]'::jsonb)) x
        join public.stock_batches b on b.batch_id=x->>'batchId'
        where public.bb_has_location_access(x->>'locationCode');
        return jsonb_set(v,'{batches}',v_batches,true);
      end;$function$
    $cloud_invoice$;
    RAISE NOTICE 'Invoice Generator batch picker now provides allowed dates';
  END IF;
END;
$invoice_window$;

-- Fail closed if anything is incomplete. Transaction rolls back in that case.
DO $verify$
DECLARE v_editor text; v_invoice text;
BEGIN
  v_editor := pg_get_functiondef('public.bb_stock_batch_edit_options(text)'::regprocedure);
  v_invoice := pg_get_functiondef('public.bb_sales_open_batches()'::regprocedure);
  IF position('''sellingDateFrom''' IN v_editor)=0 OR
     position('''sellingDateTo''' IN v_editor)=0 OR
     position('''sellingDateFrom''' IN v_invoice)=0 OR
     position('''sellingDateTo''' IN v_invoice)=0 THEN
    RAISE EXCEPTION 'Local Batch selling-window verification failed; rollback';
  END IF;
END;
$verify$;

COMMIT;

SELECT
  'OK - Local Batch selling-window parity installed' AS result,
  (SELECT count(*) FROM public.stock_batches WHERE selling_date_from IS NOT NULL
      AND selling_date_to IS NOT NULL) AS batches_with_date_range,
  to_regprocedure('public.bb_stock_admin_update_selling_window_v1(text,date,date,text)') IS NOT NULL
      AS admin_rpc_ready,
  has_function_privilege('authenticated',
      'public.bb_stock_admin_update_selling_window_v1(text,date,date,text)'::regprocedure,
      'EXECUTE') AS signed_in_permission_ready;
