-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- CNPJ alfanumérico — RASCUNHO, NÃO APLICADO EM PRODUÇÃO
--
-- Por quê: desde jul/2026 a Receita emite CNPJ com letras (IN RFB 2.229/2024). Na carga da base de out/2026 já apareceu 1 caso real
-- (arquivo Estabelecimentos0). Até aqui o banco e o importador só aceitavam 14 dígitos: um cliente ou revendedor novo com letra no
-- CNPJ seria recusado como "inválido".
--
-- Regra (conferida contra o exemplo oficial 12.ABC.345/01DE-35 e contra 10 mil CNPJs numéricos, ver abaixo):
--   * 14 posições; as 12 primeiras são 0-9 ou A-Z; os 2 dígitos verificadores continuam numéricos.
--   * dígito verificador: módulo 11, mesmos pesos de sempre; cada caractere vale (código ASCII − 48): '0'..'9' = 0..9, 'A' = 17, 'B' = 18 ...
--   * CNPJ só numérico continua valendo igual (o cálculo dá o mesmo resultado).
--
-- O que muda (tudo CREATE OR REPLACE, exceto os 3 CHECKs, que precisam de DROP/ADD):
--   1. public.cnpj_normalizar(text)   — tira máscara e põe em maiúsculas (mantém letras)
--   2. public.is_valid_cnpj(text)     — aceita letras
--   3. CHECKs de tenant_profiles (cnpj_raiz, cnpj_matriz) e resellers (cnpj): trocam '^[0-9]{..}$' por letras permitidas
--   4. provision_tenant e import_reseller: usam cnpj_normalizar() em vez de regexp_replace('\D')
--
-- Como aplicar: SQL Editor do Supabase (NÃO pelo conector: tem DROP). Roda de uma vez; é idempotente. Dados existentes continuam válidos
-- (todos numéricos). Teste local: ver supabase/tests/13_cnpj_alfanumerico.sql.
-- ============================================================

-- 1. normalização: só 0-9 e A-Z, em maiúsculas
create or replace function public.cnpj_normalizar(p text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, pg_temp
as $$
  select upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g'));
$$;

-- 2. validação
create or replace function public.is_valid_cnpj(p text)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog, pg_temp
as $$
declare
  d  text := upper(regexp_replace(p, '[^0-9A-Za-z]', '', 'g'));
  w1 int[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  w2 int[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  s  int;
  i  int;
  r  int;
begin
  if d !~ '^[0-9A-Z]{12}[0-9]{2}$' or d ~ '^(.)\1{13}$' then return false; end if;
  s := 0;
  for i in 1..12 loop s := s + (ascii(substr(d, i, 1)) - 48) * w1[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  if r <> substr(d, 13, 1)::int then return false; end if;
  s := 0;
  for i in 1..13 loop s := s + (ascii(substr(d, i, 1)) - 48) * w2[i]; end loop;
  r := s % 11; r := case when r < 2 then 0 else 11 - r end;
  return r = substr(d, 14, 1)::int;
end;
$$;

-- 3. CHECKs (nomes conferidos no banco local; no Supabase de produção são os mesmos criados pela migration 20261003000000)
alter table public.tenant_profiles drop constraint if exists tenant_profiles_cnpj_raiz_check;
alter table public.tenant_profiles add constraint tenant_profiles_cnpj_raiz_check
  check (cnpj_raiz ~ '^[0-9A-Z]{8}$');

alter table public.tenant_profiles drop constraint if exists tenant_profiles_check;
alter table public.tenant_profiles add constraint tenant_profiles_check
  check (cnpj_matriz ~ '^[0-9A-Z]{12}[0-9]{2}$' and public.is_valid_cnpj(cnpj_matriz) and substr(cnpj_matriz, 1, 8) = cnpj_raiz);

alter table public.resellers drop constraint if exists resellers_cnpj_check;
alter table public.resellers add constraint resellers_cnpj_check
  check (cnpj is null or (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$' and public.is_valid_cnpj(cnpj)));

-- 4a. provision_tenant (igual à versão 20261003010000; única mudança: v_cnpj usa cnpj_normalizar)
create or replace function public.provision_tenant(
  p_slug          text,
  p_name          text,
  p_profile       jsonb,
  p_segments      text[] default '{}',
  p_territories   jsonb  default null,
  p_primary_color text   default null,
  p_status        text   default 'trial'
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cnpj      text := public.cnpj_normalizar(p_profile ->> 'cnpj_matriz');
  v_raiz      text;
  v_sit       text := lower(coalesce(p_profile ->> 'situacao_cadastral', ''));
  v_cnae      text := nullif(regexp_replace(coalesce(p_profile ->> 'cnae_principal', ''), '\D', '', 'g'), '');
  v_sec       text[];
  v_tenant    uuid;
  v_seg       text;
  v_terr      jsonb := coalesce(nullif(p_territories, 'null'::jsonb), '[{"scope":"brasil"}]'::jsonb);
  v_t         jsonb;
  v_color     text;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'slug inválido (use 3 a 40 caracteres: minúsculas, números e hífen)' using errcode = '22023';
  end if;
  if p_name is null or btrim(p_name) = '' or char_length(p_name) > 120 then
    raise exception 'nome do cliente obrigatório (até 120 caracteres)' using errcode = '22023';
  end if;
  if p_status not in ('trial', 'active') then
    raise exception 'status inicial deve ser trial ou active' using errcode = '22023';
  end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'perfil (p_profile) deve ser um objeto json' using errcode = '22023';
  end if;

  if not public.is_valid_cnpj(v_cnpj) then
    raise exception 'CNPJ inválido (dígito verificador)' using errcode = '22023';
  end if;
  if substr(v_cnpj, 9, 4) <> '0001' then
    raise exception 'informe o CNPJ da MATRIZ (final 0001); o cliente é cadastrado pela raiz do CNPJ' using errcode = '22023';
  end if;
  v_raiz := substr(v_cnpj, 1, 8);
  if v_sit <> 'ativa' then
    raise exception 'situação cadastral deve ser ativa (recebido: %)', nullif(v_sit, '') using errcode = '22023';
  end if;
  if coalesce(btrim(p_profile ->> 'razao_social'), '') = '' then
    raise exception 'razão social obrigatória' using errcode = '22023';
  end if;

  if exists (select 1 from public.tenant_profiles where cnpj_raiz = v_raiz) then
    raise exception 'já existe cliente com a raiz de CNPJ %', v_raiz using errcode = '23505';
  end if;
  if exists (select 1 from public.tenants where slug = p_slug) then
    raise exception 'slug % já está em uso', p_slug using errcode = '23505';
  end if;

  if v_cnae is not null then v_cnae := lpad(v_cnae, 7, '0'); end if;
  if jsonb_typeof(p_profile -> 'cnaes_secundarios') = 'array' then
    select coalesce(array_agg(distinct lpad(regexp_replace(x, '\D', '', 'g'), 7, '0')), '{}')
      into v_sec
      from jsonb_array_elements_text(p_profile -> 'cnaes_secundarios') as t(x)
     where regexp_replace(x, '\D', '', 'g') <> '';
  else
    v_sec := '{}';
  end if;

  foreach v_seg in array coalesce(p_segments, '{}') loop
    if not exists (select 1 from public.segments where id = v_seg and ativo) then
      raise exception 'segmento % não existe ou está inativo', v_seg using errcode = '22023';
    end if;
  end loop;

  if jsonb_typeof(v_terr) <> 'array' or jsonb_array_length(v_terr) = 0 then
    raise exception 'territórios deve ser um array não vazio, ex.: [{"scope":"brasil"}]' using errcode = '22023';
  end if;

  v_color := case when p_primary_color ~ '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$' then p_primary_color end;

  insert into public.tenants (name, slug, status, primary_color)
  values (btrim(p_name), p_slug, p_status, v_color)
  returning id into v_tenant;

  insert into public.tenant_profiles (
    tenant_id, cnpj_raiz, cnpj_matriz, razao_social, nome_fantasia, situacao_cadastral, data_abertura, porte,
    cnae_principal, cnae_principal_desc, cnaes_secundarios, uf, municipio, municipio_ibge, municipio_receita,
    cep, website, fonte, consultado_em
  ) values (
    v_tenant, v_raiz, v_cnpj, btrim(p_profile ->> 'razao_social'), nullif(btrim(p_profile ->> 'nome_fantasia'), ''),
    v_sit, nullif(p_profile ->> 'data_abertura', '')::date, nullif(p_profile ->> 'porte', ''),
    v_cnae, nullif(p_profile ->> 'cnae_principal_desc', ''), v_sec,
    nullif(upper(p_profile ->> 'uf'), ''), nullif(p_profile ->> 'municipio', ''),
    nullif(p_profile ->> 'municipio_ibge', '')::integer, nullif(p_profile ->> 'municipio_receita', '')::integer,
    nullif(regexp_replace(coalesce(p_profile ->> 'cep', ''), '\D', '', 'g'), ''),
    nullif(p_profile ->> 'website', ''),
    coalesce(nullif(p_profile ->> 'fonte', ''), 'manual'),
    nullif(p_profile ->> 'consultado_em', '')::timestamptz
  );

  foreach v_seg in array coalesce(p_segments, '{}') loop
    insert into public.tenant_segments (tenant_id, segment_id) values (v_tenant, v_seg) on conflict do nothing;
  end loop;

  for v_t in select * from jsonb_array_elements(v_terr) loop
    insert into public.tenant_territories (tenant_id, scope, uf, municipio_ibge)
    values (v_tenant, v_t ->> 'scope', nullif(upper(v_t ->> 'uf'), ''), nullif(v_t ->> 'municipio_ibge', '')::integer)
    on conflict do nothing;
  end loop;

  return jsonb_build_object('tenant_id', v_tenant, 'slug', p_slug, 'status', p_status, 'cnpj_raiz', v_raiz);
end;
$$;

revoke all on function public.provision_tenant(text, text, jsonb, text[], jsonb, text, text) from public, anon, authenticated;
grant execute on function public.provision_tenant(text, text, jsonb, text[], jsonb, text, text) to service_role;

-- 4b. import_reseller (igual à versão 20261003030000; única mudança: v_cnpj usa cnpj_normalizar)
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

  v_cnpj := nullif(public.cnpj_normalizar(p_reseller ->> 'cnpj'), '');
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
