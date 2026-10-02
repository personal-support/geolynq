-- ============================================================
-- B0.3a — import_reseller: grava revendedor + endereço de uma vez, com upsert por (tenant, CNPJ) (só service_role)
-- Aditiva; CREATE OR REPLACE; sem DROP/DELETE.
--
-- POR QUE EXISTE: o importador do n8n só sabia INSERIR (reimportar a planilha duplicava tudo). O upsert do PostgREST/nó Supabase não
-- consegue usar o índice único PARCIAL resellers_tenant_cnpj_uq (where cnpj is not null); já o ON CONFLICT dentro do Postgres consegue
-- (inferência pelo predicado do índice). Por isso o upsert mora aqui, numa função.
--
-- Regras:
--   * com CNPJ: upsert por (tenant_id, cnpj). A planilha é a fonte da verdade: nome, tipo, status, telefone, whatsapp e site são sobrescritos.
--     verification_status/verified_at NÃO são tocados (a verificação mensal é outro processo).
--   * sem CNPJ: sempre insere (comportamento antigo, usado só no tenant demo). O importador novo exige CNPJ para cliente real.
--   * endereço (opcional): 1 por revendedor. Atualiza o existente ou insere. Se a nova geocodificação falhou (lat/lon nulos) e o endereço
--     não mudou, MANTÉM as coordenadas antigas (não apaga geocodificação boa por causa de uma falha do Nominatim).
-- p_reseller: name*, type*, status, phone, whatsapp, website, cnpj (com ou sem máscara)
-- p_address : city*, state*, cep, street, number, neighborhood, latitude, longitude, geocoded_at
-- ============================================================
create or replace function public.import_reseller(
  p_tenant_id uuid,
  p_reseller  jsonb,
  p_address   jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cnpj      text;
  v_id        uuid;
  v_inserted  boolean;
  v_addr      text := 'none';
  v_lat       double precision;
  v_lon       double precision;
  v_geo_at    timestamptz;
  v_cep       text;
  v_street    text;
  v_number    text;
  v_neigh     text;
  v_city      text;
  v_state     text;
begin
  if p_reseller is null or jsonb_typeof(p_reseller) <> 'object' then
    raise exception 'p_reseller deve ser um objeto json' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'tenant % não existe', p_tenant_id using errcode = '23503';
  end if;
  if coalesce(btrim(p_reseller ->> 'name'), '') = '' then
    raise exception 'nome do revendedor obrigatório' using errcode = '22023';
  end if;

  v_cnpj := nullif(regexp_replace(coalesce(p_reseller ->> 'cnpj', ''), '\D', '', 'g'), '');
  if v_cnpj is not null and not public.is_valid_cnpj(v_cnpj) then
    raise exception 'CNPJ inválido (dígito verificador): %', v_cnpj using errcode = '22023';
  end if;

  if v_cnpj is not null then
    insert into public.resellers (tenant_id, name, type, status, phone, whatsapp, website, cnpj)
    values (p_tenant_id, btrim(p_reseller ->> 'name'), p_reseller ->> 'type', coalesce(nullif(p_reseller ->> 'status', ''), 'active'),
            nullif(p_reseller ->> 'phone', ''), nullif(p_reseller ->> 'whatsapp', ''), nullif(p_reseller ->> 'website', ''), v_cnpj)
    on conflict (tenant_id, cnpj) where cnpj is not null do update
       set name = excluded.name, type = excluded.type, status = excluded.status, phone = excluded.phone,
           whatsapp = excluded.whatsapp, website = excluded.website, updated_at = now()
    returning id, (xmax = 0) into v_id, v_inserted;
  else
    insert into public.resellers (tenant_id, name, type, status, phone, whatsapp, website)
    values (p_tenant_id, btrim(p_reseller ->> 'name'), p_reseller ->> 'type', coalesce(nullif(p_reseller ->> 'status', ''), 'active'),
            nullif(p_reseller ->> 'phone', ''), nullif(p_reseller ->> 'whatsapp', ''), nullif(p_reseller ->> 'website', ''))
    returning id, true into v_id, v_inserted;
  end if;

  if p_address is not null and jsonb_typeof(p_address) = 'object' then
    v_city  := nullif(btrim(p_address ->> 'city'), '');
    v_state := nullif(btrim(p_address ->> 'state'), '');
    if v_city is null or v_state is null then
      raise exception 'endereço exige city e state' using errcode = '22023';
    end if;
    v_cep    := nullif(p_address ->> 'cep', '');
    v_street := nullif(p_address ->> 'street', '');
    v_number := nullif(p_address ->> 'number', '');
    v_neigh  := nullif(p_address ->> 'neighborhood', '');
    v_lat    := nullif(p_address ->> 'latitude', '')::double precision;
    v_lon    := nullif(p_address ->> 'longitude', '')::double precision;
    v_geo_at := nullif(p_address ->> 'geocoded_at', '')::timestamptz;

    update public.addresses a
       set cep = v_cep, street = v_street, number = v_number, neighborhood = v_neigh, city = v_city, state = v_state,
           latitude    = case when v_lat is not null and v_lon is not null then v_lat
                              when a.cep is not distinct from v_cep and a.street is not distinct from v_street
                               and a.number is not distinct from v_number and a.city = v_city and a.state = v_state then a.latitude end,
           longitude   = case when v_lat is not null and v_lon is not null then v_lon
                              when a.cep is not distinct from v_cep and a.street is not distinct from v_street
                               and a.number is not distinct from v_number and a.city = v_city and a.state = v_state then a.longitude end,
           geocoded_at = case when v_lat is not null and v_lon is not null then coalesce(v_geo_at, now())
                              when a.cep is not distinct from v_cep and a.street is not distinct from v_street
                               and a.number is not distinct from v_number and a.city = v_city and a.state = v_state then a.geocoded_at end
     where a.reseller_id = v_id;
    if found then
      v_addr := 'updated';
    else
      insert into public.addresses (tenant_id, reseller_id, cep, street, number, neighborhood, city, state, latitude, longitude, geocoded_at)
      values (p_tenant_id, v_id, v_cep, v_street, v_number, v_neigh, v_city, v_state,
              case when v_lat is not null and v_lon is not null then v_lat end,
              case when v_lat is not null and v_lon is not null then v_lon end,
              case when v_lat is not null and v_lon is not null then coalesce(v_geo_at, now()) end);
      v_addr := 'inserted';
    end if;
  end if;

  return jsonb_build_object('reseller_id', v_id, 'name', btrim(p_reseller ->> 'name'), 'inserted', v_inserted, 'address', v_addr, 'cnpj', v_cnpj);
end;
$$;

revoke all on function public.import_reseller(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.import_reseller(uuid, jsonb, jsonb) to service_role;
