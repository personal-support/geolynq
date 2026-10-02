import { workflow, node, trigger, sticky, newCredential, ifElse, expr } from '@n8n/workflow-sdk';

const startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar Cadastro' }
});

const paramsNode = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Parâmetros do Cadastro',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'cnpj', name: 'cnpj', value: '00385181000111', type: 'string' },
          { id: 'slug', name: 'slug', value: 'cliente-novo', type: 'string' },
          { id: 'nome_cliente', name: 'nome_cliente', value: 'Cliente Novo (editar)', type: 'string' },
          { id: 'segmentos', name: 'segmentos', value: 'suplementos', type: 'string' },
          { id: 'ufs', name: 'ufs', value: '', type: 'string' },
          { id: 'cor', name: 'cor', value: '', type: 'string' },
          { id: 'status_inicial', name: 'status_inicial', value: 'trial', type: 'string' },
          { id: 'gravar', name: 'gravar', value: false, type: 'boolean' }
        ]
      }
    },
    output: [{ json: { cnpj: '00385181000111', slug: 'cliente-novo', nome_cliente: 'Cliente Novo (editar)', segmentos: 'suplementos', ufs: '', cor: '', status_inicial: 'trial', gravar: false } }]
  }
});

const codeValidarParametros = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Parâmetros',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const p = $input.first().json;\n" +
        "const cnpj = String(p.cnpj || '').replace(/\\D/g, '');\n" +
        "function dv(base, pesos) {\n" +
        "  let soma = 0;\n" +
        "  for (let i = 0; i < pesos.length; i++) soma += Number(base[i]) * pesos[i];\n" +
        "  const resto = soma % 11;\n" +
        "  return resto < 2 ? 0 : 11 - resto;\n" +
        "}\n" +
        "function cnpjValido(d) {\n" +
        "  if (d.length !== 14 || /^(\\d)\\1{13}$/.test(d)) return false;\n" +
        "  return dv(d, [5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[12]) && dv(d, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === Number(d[13]);\n" +
        "}\n" +
        "if (!cnpjValido(cnpj)) throw new Error('CNPJ inválido (dígito verificador): ' + p.cnpj);\n" +
        "if (cnpj.substring(8, 12) !== '0001') throw new Error('Informe o CNPJ da MATRIZ (final 0001). O cliente é cadastrado pela raiz do CNPJ.');\n" +
        "const slug = String(p.slug || '').trim();\n" +
        "if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) throw new Error('slug inválido (3 a 40 caracteres: minúsculas, números e hífen): ' + slug);\n" +
        "const nome = String(p.nome_cliente || '').trim();\n" +
        "if (!nome) throw new Error('nome_cliente é obrigatório');\n" +
        "return [{ json: {\n" +
        "  cnpj_digits: cnpj, slug: slug, nome_cliente: nome,\n" +
        "  segmentos: String(p.segmentos || ''), ufs: String(p.ufs || ''), cor: String(p.cor || '').trim(),\n" +
        "  status_inicial: String(p.status_inicial || 'trial').trim(), gravar: p.gravar === true || p.gravar === 'true'\n" +
        "} }];"
    },
    output: [{ json: { cnpj_digits: '00385181000111', slug: 'cliente-novo', nome_cliente: 'Cliente Novo (editar)', segmentos: 'suplementos', ufs: '', cor: '', status_inicial: 'trial', gravar: false } }]
  }
});

const httpBrasilApi = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Consultar CNPJ (BrasilAPI)',
    parameters: {
      method: 'GET',
      url: expr('https://brasilapi.com.br/api/cnpj/v1/{{ $json.cnpj_digits }}'),
      options: { response: { response: { neverError: true } }, timeout: 20000 }
    },
    output: [{ json: { cnpj: '00385181000111', razao_social: 'NM ALIMENTOS LTDA', nome_fantasia: 'NEW MILLEN', descricao_situacao_cadastral: 'ATIVA', codigo_situacao_cadastral: 2, data_inicio_atividade: '1995-01-05', cnae_fiscal: 1099607, cnae_fiscal_descricao: 'Fabricação de alimentos dietéticos e complementos alimentares', cnaes_secundarios: [{ codigo: 4763602, descricao: 'Comércio varejista de artigos esportivos' }], uf: 'SP', municipio: 'CAJAMAR', codigo_municipio: 6285, codigo_municipio_ibge: 3509205, cep: '07786450' } }]
  }
});

const codeMapearPerfil = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Mapear Perfil da Receita',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const params = $('Validar Parâmetros').first().json;\n" +
        "const r = $input.first().json || {};\n" +
        "if (!r.razao_social) throw new Error('BrasilAPI não devolveu razão social para o CNPJ ' + params.cnpj_digits + '. Resposta: ' + JSON.stringify(r).slice(0, 300));\n" +
        "function semAcento(s) { return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim(); }\n" +
        "const porCodigo = { 1: 'nula', 2: 'ativa', 3: 'suspensa', 4: 'inapta', 8: 'baixada' };\n" +
        "let situacao = semAcento(r.descricao_situacao_cadastral);\n" +
        "if (['ativa', 'suspensa', 'inapta', 'baixada', 'nula'].indexOf(situacao) < 0) situacao = porCodigo[Number(r.codigo_situacao_cadastral)] || situacao;\n" +
        "const secundarios = (Array.isArray(r.cnaes_secundarios) ? r.cnaes_secundarios : []).map(function (x) { return Number(x && x.codigo); }).filter(function (n) { return n > 0; }).map(function (n) { return String(n); });\n" +
        "const avisos = [];\n" +
        "if (!r.cnae_fiscal) avisos.push('cnae_fiscal ausente na resposta');\n" +
        "if (!r.uf) avisos.push('uf ausente na resposta');\n" +
        "if (!r.codigo_municipio_ibge) avisos.push('codigo_municipio_ibge ausente na resposta');\n" +
        "if (!r.codigo_municipio) avisos.push('codigo_municipio (Receita) ausente na resposta');\n" +
        "if (!r.data_inicio_atividade) avisos.push('data_inicio_atividade ausente na resposta');\n" +
        "const profile = {\n" +
        "  cnpj_matriz: params.cnpj_digits,\n" +
        "  razao_social: r.razao_social,\n" +
        "  nome_fantasia: r.nome_fantasia || null,\n" +
        "  situacao_cadastral: situacao,\n" +
        "  data_abertura: r.data_inicio_atividade || null,\n" +
        "  porte: r.porte || r.descricao_porte || null,\n" +
        "  cnae_principal: r.cnae_fiscal != null ? String(r.cnae_fiscal) : null,\n" +
        "  cnae_principal_desc: r.cnae_fiscal_descricao || null,\n" +
        "  cnaes_secundarios: secundarios,\n" +
        "  uf: r.uf || null,\n" +
        "  municipio: r.municipio || null,\n" +
        "  municipio_ibge: r.codigo_municipio_ibge != null ? r.codigo_municipio_ibge : null,\n" +
        "  municipio_receita: r.codigo_municipio != null ? r.codigo_municipio : null,\n" +
        "  cep: r.cep != null ? String(r.cep) : null,\n" +
        "  fonte: 'brasilapi',\n" +
        "  consultado_em: new Date().toISOString()\n" +
        "};\n" +
        "const segmentos = params.segmentos.split(',').map(function (s) { return s.trim(); }).filter(Boolean);\n" +
        "const ufs = params.ufs.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);\n" +
        "const territorios = ufs.length > 0 ? ufs.map(function (u) { return { scope: 'uf', uf: u }; }) : [{ scope: 'brasil' }];\n" +
        "const payload = {\n" +
        "  p_slug: params.slug, p_name: params.nome_cliente, p_profile: profile, p_segments: segmentos,\n" +
        "  p_territories: territorios, p_primary_color: params.cor || null, p_status: params.status_inicial\n" +
        "};\n" +
        "return [{ json: {\n" +
        "  gravar: params.gravar,\n" +
        "  avisos: avisos,\n" +
        "  conferencia: {\n" +
        "    cliente: params.nome_cliente, slug: params.slug, status_inicial: params.status_inicial,\n" +
        "    razao_social: profile.razao_social, nome_fantasia: profile.nome_fantasia, situacao: situacao,\n" +
        "    cnpj_matriz: profile.cnpj_matriz, cnae_principal: profile.cnae_principal, cnae_principal_desc: profile.cnae_principal_desc,\n" +
        "    qtd_cnaes_secundarios: secundarios.length, uf: profile.uf, municipio: profile.municipio,\n" +
        "    municipio_ibge: profile.municipio_ibge, municipio_receita: profile.municipio_receita, cep: profile.cep,\n" +
        "    segmentos: segmentos, territorios: territorios\n" +
        "  },\n" +
        "  payload: payload\n" +
        "} }];"
    },
    output: [{ json: { gravar: false, avisos: [], conferencia: { cliente: 'Cliente Novo (editar)', slug: 'cliente-novo', status_inicial: 'trial', razao_social: 'NM ALIMENTOS LTDA', situacao: 'ativa', cnpj_matriz: '00385181000111', cnae_principal: '1099607', uf: 'SP', municipio: 'CAJAMAR', segmentos: ['suplementos'], territorios: [{ scope: 'brasil' }] }, payload: { p_slug: 'cliente-novo', p_name: 'Cliente Novo (editar)', p_profile: { cnpj_matriz: '00385181000111', razao_social: 'NM ALIMENTOS LTDA', situacao_cadastral: 'ativa', cnae_principal: '1099607', cnaes_secundarios: ['4763602'], fonte: 'brasilapi' }, p_segments: ['suplementos'], p_territories: [{ scope: 'brasil' }], p_primary_color: null, p_status: 'trial' } } }]
  }
});

const ifGravar = ifElse({
  version: 2.3,
  config: {
    name: 'Gravar no Banco?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json.gravar }}'), operator: { type: 'boolean', operation: 'equals' }, rightValue: true }],
        combinator: 'and'
      }
    },
    output: [{ json: { gravar: true, avisos: [], conferencia: { cliente: 'Cliente Novo (editar)', slug: 'cliente-novo' }, payload: { p_slug: 'cliente-novo', p_name: 'Cliente Novo (editar)' } } }]
  }
});

const httpProvisionTenant = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Cadastrar Cliente (provision_tenant)',
    parameters: {
      method: 'POST',
      url: 'https://vshlsisnuaugeceafipt.supabase.co/rest/v1/rpc/provision_tenant',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ $json.payload }}'),
      options: { timeout: 20000 }
    },
    credentials: { supabaseApi: newCredential('Supabase account') },
    output: [{ json: { tenant_id: 'b0000000-0000-0000-0000-000000000000', slug: 'cliente-novo', status: 'trial', cnpj_raiz: '00385181' } }]
  }
});

const noopSomenteConferencia = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: {
    name: 'Somente Conferência (nada foi gravado)',
    output: [{ json: { gravar: false, avisos: [], conferencia: { cliente: 'Cliente Novo (editar)', slug: 'cliente-novo' } } }]
  }
});

const setupNote = sticky(
  '## Cadastro de cliente por CNPJ\n' +
  '1. Edite o nó "Parâmetros do Cadastro": cnpj da MATRIZ (final 0001), slug, nome_cliente, segmentos (ex.: suplementos), ufs (vazio = Brasil inteiro).\n' +
  '2. Execute com gravar = false: o fluxo só CONSULTA a Receita e mostra, no nó "Somente Conferência", o que seria gravado. Confira razão social, situação (deve ser ativa), CNAE, cidade e a lista de avisos.\n' +
  '3. Para gravar: mude gravar para true e vincule a credencial Supabase (chave service_role) no nó "Cadastrar Cliente (provision_tenant)". O cliente nasce como trial; o widget só atende cliente active.\n' +
  '4. Nunca cole a chave service_role em campo de texto do fluxo: só na credencial.',
  [startTrigger, paramsNode],
  { color: 4 }
);

const gravarBranch = ifGravar.onTrue(httpProvisionTenant).onFalse(noopSomenteConferencia);

export default workflow('geolynq-cadastro-cliente', 'GeoLynq — Cadastro de Cliente por CNPJ')
  .add(startTrigger)
  .to(paramsNode.to(codeValidarParametros.to(httpBrasilApi.to(codeMapearPerfil.to(gravarBranch)))))
  .add(setupNote);
