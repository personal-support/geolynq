-- ============================================================
-- B0.2b — catálogo de CNAEs conferidos + segmento "suplementos" (PONTO DE PARTIDA, não verdade)
-- Aditiva e idempotente (só INSERT ... ON CONFLICT; sem DROP/DELETE).
--
-- FONTE DAS DESCRIÇÕES: API oficial do IBGE (servicodados.ibge.gov.br/api/v2/cnae/subclasses/{codigo}), consultada
-- pela VPS do Junior em 2026-10-02. Os 16 códigos abaixo existem e o texto é o oficial (caixa alta como o IBGE devolve).
--
-- O QUE É JULGAMENTO E NÃO MEDIÇÃO: quais códigos entram como canal do segmento e o PESO (1 a 3, quanto mais alto, mais
-- provável de revender suplementos). Isso é só o ponto de partida para cliente sem lista de revendedores. O canal DE
-- VERDADE de cada cliente é medido a partir dos CNPJs dos revendedores dele (B0.5) e substitui estes pesos.
--
-- Ficaram de fora de propósito (no catálogo, mas sem canal): 4789099 (guarda-chuva "outros produtos"), 4711301/4711302/
-- 4712100 (supermercados e mercearias vendem suplemento, mas são ruído enorme), 4724500 (hortifrúti).
-- 4729699 também é guarda-chuva: exige filtro por nome fantasia e score de aderência antes de virar candidato (B3).
-- ============================================================
insert into public.cnae_catalog (cnae, descricao) values
  ('1099607', 'FABRICAÇÃO DE ALIMENTOS DIETÉTICOS E COMPLEMENTOS ALIMENTARES'),
  ('4729699', 'COMÉRCIO VAREJISTA DE PRODUTOS ALIMENTÍCIOS EM GERAL OU ESPECIALIZADO EM PRODUTOS ALIMENTÍCIOS NÃO ESPECIFICADOS ANTERIORMENTE'),
  ('4763602', 'COMÉRCIO VAREJISTA DE ARTIGOS ESPORTIVOS'),
  ('4771701', 'COMÉRCIO VAREJISTA DE PRODUTOS FARMACÊUTICOS, SEM MANIPULAÇÃO DE FÓRMULAS'),
  ('4771702', 'COMÉRCIO VAREJISTA DE PRODUTOS FARMACÊUTICOS, COM MANIPULAÇÃO DE FÓRMULAS'),
  ('4637199', 'COMÉRCIO ATACADISTA ESPECIALIZADO EM OUTROS PRODUTOS ALIMENTÍCIOS NÃO ESPECIFICADOS ANTERIORMENTE'),
  ('4639701', 'COMÉRCIO ATACADISTA DE PRODUTOS ALIMENTÍCIOS EM GERAL'),
  ('4691500', 'COMÉRCIO ATACADISTA DE MERCADORIAS EM GERAL, COM PREDOMINÂNCIA DE PRODUTOS ALIMENTÍCIOS'),
  ('4617600', 'REPRESENTANTES COMERCIAIS E AGENTES DO COMÉRCIO DE PRODUTOS ALIMENTÍCIOS, BEBIDAS E FUMO'),
  ('4619200', 'REPRESENTANTES COMERCIAIS E AGENTES DO COMÉRCIO DE MERCADORIAS EM GERAL NÃO ESPECIALIZADO'),
  ('9313100', 'ATIVIDADES DE CONDICIONAMENTO FÍSICO'),
  ('4789099', 'COMÉRCIO VAREJISTA DE OUTROS PRODUTOS NÃO ESPECIFICADOS ANTERIORMENTE'),
  ('4711301', 'COMÉRCIO VAREJISTA DE MERCADORIAS EM GERAL, COM PREDOMINÂNCIA DE PRODUTOS ALIMENTÍCIOS HIPERMERCADOS'),
  ('4711302', 'COMÉRCIO VAREJISTA DE MERCADORIAS EM GERAL, COM PREDOMINÂNCIA DE PRODUTOS ALIMENTÍCIOS - SUPERMERCADOS'),
  ('4712100', 'COMÉRCIO VAREJISTA DE MERCADORIAS EM GERAL, COM PREDOMINÂNCIA DE PRODUTOS ALIMENTÍCIOS - MINIMERCADOS, MERCEARIAS E ARMAZÉNS'),
  ('4724500', 'COMÉRCIO VAREJISTA DE HORTIFRUTIGRANJEIROS')
on conflict (cnae) do nothing;

insert into public.segments (id, nome) values ('suplementos', 'Suplementos alimentares e nutrição esportiva')
on conflict (id) do nothing;

insert into public.segment_channel_cnaes (segment_id, cnae, tipo_canal, peso) values
  ('suplementos', '4729699', 'varejo',        3),
  ('suplementos', '4763602', 'varejo',        2),
  ('suplementos', '4771701', 'varejo',        2),
  ('suplementos', '4771702', 'varejo',        1),
  ('suplementos', '9313100', 'outro',         1),
  ('suplementos', '4637199', 'atacado',       2),
  ('suplementos', '4639701', 'atacado',       1),
  ('suplementos', '4691500', 'atacado',       1),
  ('suplementos', '4617600', 'representante', 2),
  ('suplementos', '4619200', 'representante', 1)
on conflict (segment_id, cnae) do nothing;
