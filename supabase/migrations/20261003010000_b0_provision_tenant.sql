-- ============================================================
-- B0.2a — provision_tenant: cadastra um cliente a partir do perfil da Receita (só service_role)
-- Desenho: docs/b0-cadastro-por-cnpj.md (seção 3). Aditiva. Roda de uma vez (CREATE OR REPLACE; sem DROP).
--
-- A função NÃO conhece o formato de nenhuma API: quem chama (workflow n8n, B0.3) converte a resposta da BrasilAPI
-- para as chaves abaixo. Assim o SQL valida e grava, e o mapeamento fica num lugar só, testado contra a API real.
--
-- p_profile (jsonb), chaves iguais às colunas de tenant_profiles:
--   cnpj_matriz (obrigatório; 14 dígitos, com ou sem máscara; deve ser a MATRIZ, final 0001), razao_social (obrigatório),
--   situacao_cadastral (obrigatório; só 'ativa' cadastra), nome_fantasia, data_abertura (AAAA-MM-DD), porte,
--   cnae_principal (aceita número ou texto; completa com zeros à esquerda até 7 dígitos), cnae_principal_desc,
--   cnaes_secundarios (array de códigos), uf, municipio, municipio_ibge, municipio_receita, cep, website, fonte, consultado_em
-- Cliente novo nasce 'trial': o widget só atende tenant 'active' (is_active_tenant), então ninguém o vê até o Junior ativar.
-- Quadro societário nunca entra aqui.
-- ============================================================
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
  v_cnpj      text := regexp_replace(coalesce(p_profile ->> 'cnpj_matriz', ''), '\D', '', 'g');
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

-- só o backend (service_role) cadastra cliente; o Supabase concede EXECUTE a anon/authenticated por padrão, então revogar de forma explícita
revoke all on function public.provision_tenant(text, text, jsonb, text[], jsonb, text, text) from public, anon, authenticated;
grant execute on function public.provision_tenant(text, text, jsonb, text[], jsonb, text, text) to service_role;
