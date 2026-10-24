-- GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
-- Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
-- total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
-- Unauthorized copying, replication, redistribution or commercial use is prohibited.
-- ============================================================
-- spatial_ref_sys (tabela de referência do PostGIS, no schema public): liga o RLS e deixa só leitura para anon/authenticated.
-- O alerta "RLS Disabled in Public" do Supabase aponta esta tabela. SEPARADO da migration de endurecimento porque só o DONO da tabela
-- consegue alterá-la: no Supabase o dono pode ser supabase_admin, e então este arquivo falha com "must be owner of table". Se falhar,
-- o risco que sobra é só o de alguém com a chave anônima escrever na tabela de referência de projeções (a API já não expõe TRUNCATE);
-- nesse caso fica como risco aceito, documentado em status.md.
-- ============================================================
alter table public.spatial_ref_sys enable row level security;
create policy leitura_publica on public.spatial_ref_sys for select to anon, authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.spatial_ref_sys from anon, authenticated;
