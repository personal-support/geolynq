/*
 * GeoLynq — Copyright © 2026 Jucimar Lopes (Personal Support). Todos os direitos reservados.
 * Desenvolvido por Jucimar Lopes, da Personal Support. É proibida a cópia, réplica, redistribuição ou comercialização,
 * total ou parcial, sem autorização prévia e por escrito do desenvolvedor. Ver o arquivo LICENSE na raiz do repositório.
 * Unauthorized copying, replication, redistribution or commercial use is prohibited.
 */
/* GeoLynq — landing: envio do formulário de contato.
 * Grava na tabela `leads` do Supabase pela API REST, só com INSERT (a RLS do banco impede ler).
 * URL e chave `sb_publishable_…` são públicas por design (a mesma do widget). Nunca colocar service_role aqui. */
(function () {
  "use strict";

  var SUPABASE_URL = "https://vshlsisnuaugeceafipt.supabase.co";
  var PUBLISHABLE_KEY = "sb_publishable_uPV6cGkhNDXFiDb0Teq2rA_EUFyKIxR";
  var ENDPOINT = SUPABASE_URL + "/rest/v1/leads";
  var ESPERA_MIN_MS = 3000; // quem envia antes de 3 s depois de abrir a página é robô
  var INTERVALO_MS = 60000; // 1 envio por minuto por navegador
  var CHAVE_ULTIMO = "gl_lead_ts";

  var form = document.getElementById("form-lead");
  if (!form) return;
  var msg = document.getElementById("form-msg");
  var botao = document.getElementById("form-enviar");
  var abriuEm = Date.now();
  var enviando = false;

  function aviso(texto, tipo) {
    msg.textContent = texto;
    msg.className = "form__msg" + (tipo ? " " + tipo : "");
  }
  function campo(id) { return document.getElementById(id); }
  function marcar(el, invalido) { if (invalido) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid"); }
  function limpo(v, max) { return String(v || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max); }
  function lerUltimo() { try { return Number(localStorage.getItem(CHAVE_ULTIMO)) || 0; } catch (e) { return 0; } }
  function gravarUltimo() { try { localStorage.setItem(CHAVE_ULTIMO, String(Date.now())); } catch (e) { /* sem armazenamento: segue */ } }

  form.addEventListener("input", function (ev) { marcar(ev.target, false); });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (enviando) return;

    var nome = campo("f-nome"), empresa = campo("f-empresa"), email = campo("f-email");
    var tel = campo("f-tel"), texto = campo("f-msg"), aceite = campo("f-aceite");

    // robô: o campo-isca foi preenchido ou o envio foi rápido demais. Finge sucesso e não grava.
    if (campo("f-site").value || Date.now() - abriuEm < ESPERA_MIN_MS) {
      aviso("Recebemos o seu contato. Obrigado!", "ok");
      form.reset();
      return;
    }

    var v = {
      name: limpo(nome.value, 120),
      company: limpo(empresa.value, 120),
      email: limpo(email.value, 160).toLowerCase(),
      phone: limpo(tel.value, 30),
      message: limpo(texto.value, 1000)
    };

    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email);
    marcar(nome, v.name.length < 2);
    marcar(empresa, v.company.length < 2);
    marcar(email, !okEmail);
    var invalido = form.querySelector('[aria-invalid="true"]');
    if (invalido) {
      aviso("Confira os campos destacados.", "erro");
      invalido.focus();
      return;
    }
    if (!aceite.checked) {
      aviso("Marque a caixa de concordância para enviar.", "erro");
      aceite.focus();
      return;
    }
    if (Date.now() - lerUltimo() < INTERVALO_MS) {
      aviso("Você acabou de enviar um contato. Aguarde um minuto para enviar outro.", "erro");
      return;
    }

    enviando = true;
    botao.disabled = true;
    botao.textContent = "Enviando…";
    aviso("", "");

    var corpo = { name: v.name, company: v.company, email: v.email }; // source e status vêm do padrão do banco
    if (v.phone) corpo.phone = v.phone;
    if (v.message) corpo.message = v.message;

    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var limite = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : null;

    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: PUBLISHABLE_KEY,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(corpo),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      gravarUltimo();
      form.reset();
      aviso("Recebemos o seu contato. Voltamos a falar com você por e-mail ou telefone.", "ok");
    }).catch(function () {
      aviso("Não foi possível enviar agora. Tente de novo em instantes ou escreva para personalsupport@hotmail.com.", "erro");
    }).then(function () {
      if (limite) clearTimeout(limite);
      enviando = false;
      botao.disabled = false;
      botao.textContent = "Enviar contato";
    });
  });
})();
