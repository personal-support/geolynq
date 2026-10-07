import { workflow, node, trigger, sticky, placeholder, newCredential, ifElse, merge, expr } from '@n8n/workflow-sdk';

const startTrigger = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Iniciar Importação' }
});

const paramsNode = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Parâmetros da Importação',
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'tenant_id', name: 'tenant_id', value: placeholder('UUID do tenant no Supabase — editar antes de cada execução'), type: 'string' },
          { id: 'import_source', name: 'import_source', value: 'google_sheets_import', type: 'string' },
          { id: 'exigir_cnpj', name: 'exigir_cnpj', value: true, type: 'boolean' }
        ]
      }
    },
    output: [{ json: { tenant_id: 'a0000000-0000-0000-0000-000000000000', import_source: 'google_sheets_import', exigir_cnpj: true } }]
  }
});

const readProdutos = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Ler Aba Produtos',
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'list', value: '', cachedResultName: 'GeoLynq — Planilha Modelo Catálogo' },
      sheetName: { __rl: true, mode: 'name', value: 'Produtos' }
    },
    credentials: { googleApi: newCredential('Google Drive account') },
    output: [{ json: { sku: 'WPI-900', nome: 'Whey Protein Isolado 900g', categoria: 'proteina', claims: 'sem lactose, sem gluten', alergenos: 'leite', imagem: 'https://exemplo.com.br/img/wpi-900.jpg' } }]
  }
});

const readRevendedores = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Ler Aba Revendedores',
    executeOnce: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'list', value: '', cachedResultName: 'GeoLynq — Planilha Modelo Catálogo' },
      sheetName: { __rl: true, mode: 'name', value: 'Revendedores' }
    },
    credentials: { googleApi: newCredential('Google Drive account') },
    output: [{ json: { cnpj: '00385181000111', nome: 'Farmácia Saúde Total', tipo: 'farmacia', telefone: '13999990000', whatsapp: '13999990000', site: '', cep: '11015-000', rua: 'Av. Ana Costa', numero: '100', bairro: 'Gonzaga', cidade: 'Santos', estado: 'SP' } }]
  }
});

const readCobertura = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Ler Aba Cobertura',
    executeOnce: true,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      documentId: { __rl: true, mode: 'list', value: '', cachedResultName: 'GeoLynq — Planilha Modelo Catálogo' },
      sheetName: { __rl: true, mode: 'name', value: 'Cobertura' }
    },
    credentials: { googleApi: newCredential('Google Drive account') },
    output: [{ json: { sku_produto: 'WPI-900', cnpj_revendedor: '00385181000111', nome_revendedor: 'Farmácia Saúde Total', prioridade: '0' } }]
  }
});

const codeValidarProdutos = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Produtos',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const tenantId = $('Parâmetros da Importação').first().json.tenant_id;\n" +
        "const rows = $('Ler Aba Produtos').all();\n" +
        "const seenSku = {};\n" +
        "const out = [];\n" +
        "rows.forEach(function (item, idx) {\n" +
        "  const row = idx + 2;\n" +
        "  const d = item.json;\n" +
        "  const sku = (d.sku || '').toString().trim();\n" +
        "  const nome = (d.nome || '').toString().trim();\n" +
        "  if (!sku || !nome) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Produtos', _row: row, _error: 'sku e nome são obrigatórios' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  if (seenSku[sku]) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Produtos', _row: row, _error: 'SKU duplicado no lote: ' + sku } });\n" +
        "    return;\n" +
        "  }\n" +
        "  seenSku[sku] = true;\n" +
        "  const claims = (d.claims || '').toString().split(',').map(function (s) { return s.trim(); }).filter(Boolean);\n" +
        "  const alergenos = (d.alergenos || '').toString().split(',').map(function (s) { return s.trim(); }).filter(Boolean);\n" +
        "  // Foto: a planilha é a fonte da verdade (vazio = sem foto). Só link https:// (o widget recusa o resto); inválido não derruba o produto, vira AVISO.\n" +
        "  const img = (d.imagem || '').toString().trim();\n" +
        "  let imageUrl = null;\n" +
        "  let aviso = null;\n" +
        "  if (img) {\n" +
        "    if (/^https:\\/\\/[^\\s]+$/i.test(img) && img.length >= 12 && img.length <= 500) imageUrl = img;\n" +
        "    else aviso = 'AVISO: foto ignorada; use um link que comece com https:// (até 500 caracteres) e sem espaços';\n" +
        "  }\n" +
        "  out.push({ json: {\n" +
        "    _valid: true, _sheet: 'Produtos', _row: row, _aviso: aviso,\n" +
        "    row: { tenant_id: tenantId, sku: sku, name: nome, category: (d.categoria || '').toString().trim() || null, claims: claims, allergens: alergenos, image_url: imageUrl, active: true }\n" +
        "  } });\n" +
        "});\n" +
        "return out;"
    },
    output: [{ json: { _valid: true, _sheet: 'Produtos', _row: 2, row: { tenant_id: 'a0000000-0000-0000-0000-000000000000', sku: 'WPI-900', name: 'Whey Protein Isolado 900g', category: 'proteina', claims: ['sem lactose'], allergens: ['leite'], image_url: null, active: true } } }]
  }
});

const ifProdutoValido = ifElse({
  version: 2.3,
  config: {
    name: 'Produto Válido?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json._valid }}'), operator: { type: 'boolean', operation: 'equals' }, rightValue: true }],
        combinator: 'and'
      }
    },
    output: [{ json: { _valid: true, _sheet: 'Produtos', _row: 2, row: { tenant_id: 'a0000000-0000-0000-0000-000000000000', sku: 'WPI-900', name: 'Whey Protein Isolado 900g', category: 'proteina', claims: ['sem lactose'], allergens: ['leite'], image_url: null, active: true } } }]
  }
});

const httpGravarProdutos = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Gravar Produtos (upsert)',
    onError: 'continueErrorOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'POST',
      url: 'https://vshlsisnuaugeceafipt.supabase.co/rest/v1/products?on_conflict=tenant_id,sku',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=representation' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ $json.row }}'),
      options: { timeout: 20000 }
    },
    credentials: { supabaseApi: newCredential('Supabase account') },
    output: [{ json: { id: 'b0000000-0000-0000-0000-000000000000', tenant_id: 'a0000000-0000-0000-0000-000000000000', sku: 'WPI-900', name: 'Whey Protein Isolado 900g' } }]
  }
});

const codeValidarRevendedores = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Revendedores',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const params = $('Parâmetros da Importação').first().json;\n" +
        "const tenantId = params.tenant_id;\n" +
        "const exigirCnpj = params.exigir_cnpj === true || params.exigir_cnpj === 'true';\n" +
        "const rows = $('Ler Aba Revendedores').all();\n" +
        "const tiposValidos = ['loja_fisica', 'farmacia', 'online', 'distribuidor', 'outro'];\n" +
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
        "const vistos = {};\n" +
        "const out = [];\n" +
        "rows.forEach(function (item, idx) {\n" +
        "  const row = idx + 2;\n" +
        "  const d = item.json;\n" +
        "  const nome = (d.nome || '').toString().trim();\n" +
        "  const tipo = (d.tipo || '').toString().trim();\n" +
        "  const cidade = (d.cidade || '').toString().trim();\n" +
        "  const estado = (d.estado || '').toString().trim();\n" +
        "  if (!nome || !tipo || !cidade || !estado) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'nome, tipo, cidade e estado são obrigatórios' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  if (tiposValidos.indexOf(tipo) < 0) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'tipo inválido: ' + tipo + ' (use ' + tiposValidos.join('/') + ')' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  let cnpj = (d.cnpj || '').toString().replace(/\\D/g, '');\n" +
        "  if (cnpj.length > 0 && cnpj.length < 14) cnpj = cnpj.padStart(14, '0');\n" +
        "  if (!cnpj) {\n" +
        "    if (exigirCnpj) {\n" +
        "      out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'CNPJ é obrigatório para este cliente (coluna cnpj)' } });\n" +
        "      return;\n" +
        "    }\n" +
        "  } else if (!cnpjValido(cnpj)) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'CNPJ inválido (dígito verificador): ' + d.cnpj } });\n" +
        "    return;\n" +
        "  } else if (vistos[cnpj]) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'CNPJ repetido no lote (já na linha ' + vistos[cnpj] + '): ' + cnpj } });\n" +
        "    return;\n" +
        "  } else {\n" +
        "    vistos[cnpj] = row;\n" +
        "  }\n" +
        "  const cepDigits = (d.cep || '').toString().replace(/\\D/g, '');\n" +
        "  if (d.cep && cepDigits.length !== 8) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Revendedores', _row: row, _error: 'CEP inválido: ' + d.cep } });\n" +
        "    return;\n" +
        "  }\n" +
        "  const rua = (d.rua || '').toString().trim();\n" +
        "  const numero = (d.numero || '').toString().trim();\n" +
        "  const bairro = (d.bairro || '').toString().trim();\n" +
        "  out.push({ json: {\n" +
        "    _valid: true, _sheet: 'Revendedores', _row: row,\n" +
        "    tenant_id: tenantId, cnpj: cnpj || null, name: nome, type: tipo, status: 'active',\n" +
        "    phone: (d.telefone || '').toString().trim() || null,\n" +
        "    whatsapp: (d.whatsapp || '').toString().trim() || null,\n" +
        "    website: (d.site || '').toString().trim() || null,\n" +
        "    cep: d.cep || null,\n" +
        "    street: rua || null, number: numero || null, neighborhood: bairro || null,\n" +
        "    city: cidade, state: estado,\n" +
        "    endereco_completo: [rua, numero, bairro, cidade, estado, 'Brasil'].filter(Boolean).join(', ')\n" +
        "  } });\n" +
        "});\n" +
        "return out;"
    },
    output: [{ json: { _valid: true, _sheet: 'Revendedores', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', cnpj: '00385181000111', name: 'Farmácia Saúde Total', type: 'farmacia', status: 'active', phone: '13999990000', whatsapp: '13999990000', website: null, cep: '11015-000', street: 'Av. Ana Costa', number: '100', neighborhood: 'Gonzaga', city: 'Santos', state: 'SP', endereco_completo: 'Av. Ana Costa, 100, Gonzaga, Santos, SP, Brasil' } }]
  }
});

const ifRevendedorValido = ifElse({
  version: 2.3,
  config: {
    name: 'Revendedor Válido?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json._valid }}'), operator: { type: 'boolean', operation: 'equals' }, rightValue: true }],
        combinator: 'and'
      }
    },
    output: [{ json: { _valid: true, _sheet: 'Revendedores', _row: 2, tenant_id: 'a0000000-0000-0000-0000-000000000000', cnpj: '00385181000111', name: 'Farmácia Saúde Total', type: 'farmacia', status: 'active', phone: '13999990000', whatsapp: '13999990000', website: null, cep: '11015-000', street: 'Av. Ana Costa', number: '100', neighborhood: 'Gonzaga', city: 'Santos', state: 'SP', endereco_completo: 'Av. Ana Costa, 100, Gonzaga, Santos, SP, Brasil' } }]
  }
});

const httpNominatim = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Geocodificar Endereço (Nominatim)',
    parameters: {
      method: 'GET',
      url: expr('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q={{ encodeURIComponent($json.endereco_completo) }}'),
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'GeoLynq-ImportPipeline (geolynq.personalsupport.tech)' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 1100 } },
        response: { response: { neverError: true, responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ json: { data: '[{"lat":"-23.9608","lon":"-46.3336","display_name":"Av. Ana Costa, Gonzaga, Santos - SP, Brasil"}]' } }]
  }
});

const codeMontarRevendedor = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar Payload do Revendedor',
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode:
        "const val = $('Validar Revendedores').item.json;\n" +
        "let lat = null;\n" +
        "let lon = null;\n" +
        "try {\n" +
        "  const lista = JSON.parse($json.data);\n" +
        "  if (Array.isArray(lista) && lista.length > 0 && lista[0].lat && lista[0].lon) {\n" +
        "    lat = parseFloat(lista[0].lat);\n" +
        "    lon = parseFloat(lista[0].lon);\n" +
        "  }\n" +
        "} catch (e) {\n" +
        "  lat = null;\n" +
        "  lon = null;\n" +
        "}\n" +
        "const geocodificou = lat !== null && lon !== null && isFinite(lat) && isFinite(lon);\n" +
        "return { json: {\n" +
        "  _sheet: 'Revendedores', _row: val._row, _geocodificado: geocodificou,\n" +
        "  row: {\n" +
        "    p_tenant_id: val.tenant_id,\n" +
        "    p_reseller: { name: val.name, type: val.type, status: val.status, phone: val.phone, whatsapp: val.whatsapp, website: val.website, cnpj: val.cnpj },\n" +
        "    p_address: {\n" +
        "      cep: val.cep, street: val.street, number: val.number, neighborhood: val.neighborhood, city: val.city, state: val.state,\n" +
        "      latitude: geocodificou ? lat : null, longitude: geocodificou ? lon : null,\n" +
        "      geocoded_at: geocodificou ? new Date().toISOString() : null\n" +
        "    }\n" +
        "  }\n" +
        "} };"
    },
    output: [{ json: { _sheet: 'Revendedores', _row: 2, _geocodificado: true, row: { p_tenant_id: 'a0000000-0000-0000-0000-000000000000', p_reseller: { name: 'Farmácia Saúde Total', type: 'farmacia', status: 'active', phone: '13999990000', whatsapp: '13999990000', website: null, cnpj: '00385181000111' }, p_address: { cep: '11015-000', street: 'Av. Ana Costa', number: '100', neighborhood: 'Gonzaga', city: 'Santos', state: 'SP', latitude: -23.9608, longitude: -46.3336, geocoded_at: '2026-10-02T00:00:00.000Z' } } } }]
  }
});

const httpImportarRevendedor = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Importar Revendedor (import_reseller)',
    onError: 'continueErrorOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'POST',
      url: 'https://vshlsisnuaugeceafipt.supabase.co/rest/v1/rpc/import_reseller',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ $json.row }}'),
      options: { timeout: 20000 }
    },
    credentials: { supabaseApi: newCredential('Supabase account') },
    output: [{ json: { reseller_id: 'c0000000-0000-0000-0000-000000000000', name: 'Farmácia Saúde Total', cnpj: '00385181000111', inserted: true, address: 'inserted' } }]
  }
});

const codeValidarCobertura = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar Cobertura',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const tenantId = $('Parâmetros da Importação').first().json.tenant_id;\n" +
        "const rows = $('Ler Aba Cobertura').all();\n" +
        "let produtos = [];\n" +
        "try { produtos = $('Gravar Produtos (upsert)').all(); } catch (e) { produtos = []; }\n" +
        "let revendedores = [];\n" +
        "try { revendedores = $('Importar Revendedor (import_reseller)').all(); } catch (e) { revendedores = []; }\n" +
        "const produtoPorSku = {};\n" +
        "produtos.forEach(function (p) { if (p.json && p.json.sku && p.json.id) produtoPorSku[p.json.sku] = p.json.id; });\n" +
        "const revPorCnpj = {};\n" +
        "const revPorNome = {};\n" +
        "revendedores.forEach(function (r) {\n" +
        "  if (!r.json || !r.json.reseller_id) return;\n" +
        "  if (r.json.cnpj) revPorCnpj[r.json.cnpj] = r.json.reseller_id;\n" +
        "  if (r.json.name) {\n" +
        "    if (!revPorNome[r.json.name]) revPorNome[r.json.name] = [];\n" +
        "    if (revPorNome[r.json.name].indexOf(r.json.reseller_id) < 0) revPorNome[r.json.name].push(r.json.reseller_id);\n" +
        "  }\n" +
        "});\n" +
        "const out = [];\n" +
        "rows.forEach(function (item, idx) {\n" +
        "  const row = idx + 2;\n" +
        "  const d = item.json;\n" +
        "  const sku = (d.sku_produto || '').toString().trim();\n" +
        "  const nomeRev = (d.nome_revendedor || '').toString().trim();\n" +
        "  let cnpjRev = (d.cnpj_revendedor || '').toString().replace(/\\D/g, '');\n" +
        "  if (cnpjRev.length > 0 && cnpjRev.length < 14) cnpjRev = cnpjRev.padStart(14, '0');\n" +
        "  if (!sku || (!cnpjRev && !nomeRev)) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: 'sku_produto e (cnpj_revendedor ou nome_revendedor) são obrigatórios' } });\n" +
        "    return;\n" +
        "  }\n" +
        "  const productId = produtoPorSku[sku];\n" +
        "  if (!productId) {\n" +
        "    out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: \"produto com SKU '\" + sku + \"' não encontrado ou não importado\" } });\n" +
        "    return;\n" +
        "  }\n" +
        "  let resellerId = null;\n" +
        "  if (cnpjRev) {\n" +
        "    resellerId = revPorCnpj[cnpjRev] || null;\n" +
        "    if (!resellerId) {\n" +
        "      out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: 'revendedor com CNPJ ' + cnpjRev + ' não encontrado ou não importado' } });\n" +
        "      return;\n" +
        "    }\n" +
        "  } else {\n" +
        "    const ids = revPorNome[nomeRev] || [];\n" +
        "    if (ids.length === 0) {\n" +
        "      out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: \"revendedor '\" + nomeRev + \"' não encontrado ou não importado\" } });\n" +
        "      return;\n" +
        "    }\n" +
        "    if (ids.length > 1) {\n" +
        "      out.push({ json: { _valid: false, _sheet: 'Cobertura', _row: row, _error: \"nome '\" + nomeRev + \"' é ambíguo (\" + ids.length + \" revendedores); preencha cnpj_revendedor\" } });\n" +
        "      return;\n" +
        "    }\n" +
        "    resellerId = ids[0];\n" +
        "  }\n" +
        "  const prioridade = parseInt(d.prioridade, 10);\n" +
        "  out.push({ json: {\n" +
        "    _valid: true, _sheet: 'Cobertura', _row: row,\n" +
        "    row: { tenant_id: tenantId, product_id: productId, reseller_id: resellerId, priority: isFinite(prioridade) ? prioridade : 0 }\n" +
        "  } });\n" +
        "});\n" +
        "return out;"
    },
    output: [{ json: { _valid: true, _sheet: 'Cobertura', _row: 2, row: { tenant_id: 'a0000000-0000-0000-0000-000000000000', product_id: 'b0000000-0000-0000-0000-000000000000', reseller_id: 'c0000000-0000-0000-0000-000000000000', priority: 0 } } }]
  }
});

const ifCoberturaValida = ifElse({
  version: 2.3,
  config: {
    name: 'Cobertura Válida?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ leftValue: expr('{{ $json._valid }}'), operator: { type: 'boolean', operation: 'equals' }, rightValue: true }],
        combinator: 'and'
      }
    },
    output: [{ json: { _valid: true, _sheet: 'Cobertura', _row: 2, row: { tenant_id: 'a0000000-0000-0000-0000-000000000000', product_id: 'b0000000-0000-0000-0000-000000000000', reseller_id: 'c0000000-0000-0000-0000-000000000000', priority: 0 } } }]
  }
});

const httpGravarCobertura = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Gravar Cobertura (upsert)',
    onError: 'continueErrorOutput',
    // alwaysOutputData: a resposta (return=minimal) é vazia; sem isso o sucesso não emite item e não aciona o merge.
    alwaysOutputData: true,
    parameters: {
      method: 'POST',
      url: 'https://vshlsisnuaugeceafipt.supabase.co/rest/v1/product_reseller_coverage?on_conflict=product_id,reseller_id',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'supabaseApi',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ $json.row }}'),
      options: { timeout: 20000 }
    },
    credentials: { supabaseApi: newCredential('Supabase account') },
    output: [{ json: {} }]
  }
});

const mergeErros = merge({
  version: 3.2,
  config: {
    name: 'Consolidar Erros de Validação e Gravação',
    alwaysOutputData: true,
    // 7 entradas: 0-5 = erros/invalidos; 6 = FIM DA CADEIA COM SUCESSO. Sem a entrada 6 o merge nunca roda numa importação sem
    // nenhum erro e o import_batches não é gravado (achado na execução real nº 104, 2026-10-06).
    parameters: { mode: 'append', numberInputs: 7 },
    output: [{ json: { _sheet: 'Produtos', _row: 5, _error: 'exemplo de erro' } }]
  }
});

const codeMontarResumo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar Resumo da Importação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const tenantId = $('Parâmetros da Importação').first().json.tenant_id;\n" +
        "const importSource = $('Parâmetros da Importação').first().json.import_source;\n" +
        "const erros = [];\n" +
        "$input.all().forEach(function (i) {\n" +
        "  const e = i.json;\n" +
        "  if (!e) return;\n" +
        "  if (e._error) { erros.push({ _sheet: e._sheet || 'gravação', _row: e._row != null ? e._row : null, _error: e._error }); return; }\n" +
        "  if (e.error) {\n" +
        "    const msg = typeof e.error === 'string' ? e.error : (e.error.message || JSON.stringify(e.error));\n" +
        "    erros.push({ _sheet: e._sheet || 'gravação', _row: e._row != null ? e._row : null, _error: String(msg).slice(0, 300) });\n" +
        "  }\n" +
        "});\n" +
        "function contarLinhas(nodeName) {\n" +
        "  try { return $(nodeName).all().length; } catch (e) { return 0; }\n" +
        "}\n" +
        "const etapas = [['Produtos', 'Ler Aba Produtos', 'Validar Produtos'], ['Revendedores', 'Ler Aba Revendedores', 'Validar Revendedores'], ['Cobertura', 'Ler Aba Cobertura', 'Validar Cobertura']];\n" +
        "etapas.forEach(function (et) {\n" +
        "  if (contarLinhas(et[1]) > 0 && contarLinhas(et[2]) === 0) erros.push({ _sheet: et[0], _row: null, _error: 'etapa não executada: a etapa anterior não produziu nenhuma linha válida' });\n" +
        "});\n" +
        "// AVISOS (não contam como falha): revendedor salvo sem coordenadas não aparece na busca por distância do widget.\n" +
        "// Online não precisa de coordenadas, então não gera aviso.\n" +
        "let semCoordenadas = [];\n" +
        "try {\n" +
        "  semCoordenadas = $('Montar Payload do Revendedor').all().filter(function (i) {\n" +
        "    return i.json && i.json._geocodificado === false && !(i.json.row && i.json.row.p_reseller && i.json.row.p_reseller.type === 'online');\n" +
        "  });\n" +
        "} catch (e) { semCoordenadas = []; }\n" +
        "const avisos = semCoordenadas.map(function (i) {\n" +
        "  return { _sheet: 'Revendedores', _row: i.json._row != null ? i.json._row : null, _error: 'AVISO: endereço não geocodificado; o revendedor foi salvo sem coordenadas e NÃO aparece na busca por distância (corrija o endereço e reimporte)' };\n" +
        "});\n" +
        "// AVISO de foto inválida (o produto foi importado, sem a foto).\n" +
        "try {\n" +
        "  $('Validar Produtos').all().forEach(function (i) {\n" +
        "    if (i.json && i.json._aviso) avisos.push({ _sheet: 'Produtos', _row: i.json._row != null ? i.json._row : null, _error: i.json._aviso });\n" +
        "  });\n" +
        "} catch (e) { /* sem produtos validados: nada a avisar */ }\n" +
        "const rowsProcessed = contarLinhas('Ler Aba Produtos') + contarLinhas('Ler Aba Revendedores') + contarLinhas('Ler Aba Cobertura');\n" +
        "const rowsFailed = erros.length;\n" +
        "let status = 'success';\n" +
        "if (rowsFailed > 0 && rowsFailed < rowsProcessed) status = 'partial';\n" +
        "if (rowsFailed > 0 && rowsFailed >= rowsProcessed) status = 'failed';\n" +
        "if (status === 'success' && avisos.length > 0) status = 'partial';\n" +
        "return [{ json: {\n" +
        "  tenant_id: tenantId, source: importSource, status: status,\n" +
        "  rows_processed: rowsProcessed, rows_failed: rowsFailed, error_log: erros.concat(avisos),\n" +
        "  completed_at: new Date().toISOString()\n" +
        "} }];"
    },
    output: [{ json: { tenant_id: 'a0000000-0000-0000-0000-000000000000', source: 'google_sheets_import', status: 'success', rows_processed: 3, rows_failed: 0, error_log: [], completed_at: '2026-10-02T00:00:00.000Z' } }]
  }
});

const supabaseCreateImportBatch = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Registrar Lote de Importação',
    parameters: {
      resource: 'row',
      operation: 'create',
      tableId: 'import_batches',
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'tenant_id', fieldValue: expr('{{ $json.tenant_id }}') },
          { fieldId: 'source', fieldValue: expr('{{ $json.source }}') },
          { fieldId: 'status', fieldValue: expr('{{ $json.status }}') },
          { fieldId: 'rows_processed', fieldValue: expr('{{ $json.rows_processed }}') },
          { fieldId: 'rows_failed', fieldValue: expr('{{ $json.rows_failed }}') },
          { fieldId: 'error_log', fieldValue: expr('{{ $json.error_log }}') },
          { fieldId: 'completed_at', fieldValue: expr('{{ $json.completed_at }}') }
        ]
      }
    },
    credentials: { supabaseApi: newCredential('Supabase account') },
    output: [{ json: { id: 'f0000000-0000-0000-0000-000000000000', status: 'success' } }]
  }
});

const setupNote = sticky(
  '## Import Catálogo v2 (com CNPJ, reimportável)\n' +
  '1. Planilha: aba Revendedores com a coluna cnpj (obrigatória para cliente novo); aba Cobertura com cnpj_revendedor (opcional; sem ele, usa o nome e recusa nome ambíguo). Modelo: docs/geolynq-catalogo-modelo.xlsx.\n' +
  '2. Selecione a planilha nos 3 nós "Ler Aba ..." e vincule a credencial "Supabase account" (chave service_role) nos nós de gravação.\n' +
  '3. Edite tenant_id no nó "Parâmetros da Importação". exigir_cnpj = false SÓ para o tenant demo (revendedores antigos sem CNPJ).\n' +
  '4. Reimportar a mesma planilha atualiza (produto por SKU, revendedor por CNPJ, cobertura por par) em vez de duplicar.\n' +
  '5. Geocodificação: 1 consulta por segundo (política do Nominatim). Falha de geocodificação não derruba a linha: o endereço entra sem coordenadas e o resumo marca.',
  [startTrigger, paramsNode],
  { color: 4 }
);

const coberturaChain = codeValidarCobertura.to(
  ifCoberturaValida.onTrue(httpGravarCobertura).onFalse(mergeErros.input(4))
);

const revendedorChain = codeValidarRevendedores.to(
  ifRevendedorValido
    .onTrue(httpNominatim.to(codeMontarRevendedor.to(httpImportarRevendedor.to(coberturaChain))))
    .onFalse(mergeErros.input(3))
);

const produtoChain = codeValidarProdutos.to(
  ifProdutoValido.onTrue(httpGravarProdutos.to(revendedorChain)).onFalse(mergeErros.input(1))
);

httpGravarProdutos.onError(mergeErros.input(0));
httpImportarRevendedor.onError(mergeErros.input(2));
httpGravarCobertura.onError(mergeErros.input(5));
httpGravarCobertura.to(mergeErros.input(6)); // sucesso também chega ao resumo

export default workflow('geolynq-import-catalogo-v2', 'GeoLynq — Import Catálogo v2 (CNPJ)')
  .add(startTrigger)
  .to(paramsNode.to(readProdutos.to(readRevendedores.to(readCobertura.to(produtoChain)))))
  .add(mergeErros)
  .to(codeMontarResumo.to(supabaseCreateImportBatch))
  .add(setupNote);
