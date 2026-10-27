// --- Caixa de entrada "OS novas" ---
// Cada OS lida (de PDF/foto, e futuramente do robô dos portais) aparece como um
// cartão. A pessoa confere data, período, tipo, empresa e técnico e manda para a
// agenda com um toque, ou abre no cadastro para revisar tudo.

const LISTAS = window.LISTAS || { empresa: [], tipo_servico: [], tecnico: [] };
const entradaArquivos = document.getElementById("arquivos-os");

function textoOuTraco(valor) {
  return valor ? escaparHtml(valor) : "—";
}

function criarSelect(opcoes, valorAtual, rotuloVazio) {
  const select = document.createElement("select");
  const vazio = document.createElement("option");
  vazio.value = "";
  vazio.textContent = rotuloVazio;
  select.appendChild(vazio);
  opcoes.forEach((opcao) => {
    const opt = document.createElement("option");
    opt.value = opcao;
    opt.textContent = opcao;
    select.appendChild(opt);
  });
  select.value = opcoes.includes(valorAtual) ? valorAtual : "";
  return select;
}

function criarCampo(rotulo, elemento) {
  const div = document.createElement("div");
  div.className = "campo";
  const label = document.createElement("label");
  label.textContent = rotulo;
  div.appendChild(label);
  div.appendChild(elemento);
  return div;
}

function desenharCartao(item) {
  const c = item.campos || {};
  const cartao = document.createElement("div");
  cartao.className = "cartao cartao-os-nova";
  cartao.dataset.id = item.id;

  const empresaMostrada = c.empresa || c.empresa_lida || "Empresa?";
  cartao.innerHTML = `
    <div class="os-nova-topo">
      <span class="chip-status agendado">${escaparHtml(empresaMostrada)}</span>
      <span class="os-nova-numero">${c.numero_os ? "OS nº " + escaparHtml(c.numero_os) : "Sem nº de OS"}</span>
    </div>
    <div class="os-nova-cliente">${textoOuTraco(c.cliente_nome)}</div>
    <div class="os-nova-linha">📞 ${textoOuTraco(c.cliente_telefone)}</div>
    <div class="os-nova-linha">📍 ${textoOuTraco(c.endereco)}${c.cep ? " · " + escaparHtml(c.cep) : ""}</div>
    <div class="os-nova-linha">🚗 ${textoOuTraco(c.placa)}${c.veiculo ? " · " + escaparHtml(c.veiculo) : ""}</div>
    ${c.observacoes ? `<div class="os-nova-obs">${escaparHtml(c.observacoes).replace(/\n/g, "<br>")}</div>` : ""}
  `;

  if (item.avisos && item.avisos.length) {
    const lista = document.createElement("ul");
    lista.className = "importar-os-avisos";
    item.avisos.forEach((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      lista.appendChild(li);
    });
    cartao.appendChild(lista);
  }

  // Campos que mais costumam precisar de ajuste antes de ir para a agenda.
  const grade = document.createElement("div");
  grade.className = "os-nova-campos";
  const data = document.createElement("input");
  data.type = "date";
  data.value = c.data ? converterDataParaISO(c.data) : "";
  const periodo = criarSelect(["Manhã", "Integral", "Tarde"], c.periodo, "Período...");
  const tipo = criarSelect(LISTAS.tipo_servico, c.tipo_servico, "Tipo de serviço...");
  const empresa = criarSelect(LISTAS.empresa, c.empresa, "Empresa...");
  const tecnico = criarSelect(LISTAS.tecnico, c.tecnico, "Sem técnico definido");
  grade.appendChild(criarCampo("Data", data));
  grade.appendChild(criarCampo("Período", periodo));
  grade.appendChild(criarCampo("Tipo de serviço", tipo));
  grade.appendChild(criarCampo("Empresa", empresa));
  const campoTecnico = criarCampo("Técnico", tecnico);
  campoTecnico.classList.add("campo-largo");
  grade.appendChild(campoTecnico);
  cartao.appendChild(grade);

  const acoes = document.createElement("div");
  acoes.className = "acoes-detalhe";
  const botaoAgenda = document.createElement("button");
  botaoAgenda.type = "button";
  botaoAgenda.className = "botao botao-primario";
  botaoAgenda.textContent = "✅ Mandar para a agenda";
  botaoAgenda.classList.add("botao-mandar-agenda");
  botaoAgenda.onclick = () => confirmarOS(item.id, cartao, {
    data: data.value ? converterDataParaBR(data.value) : "",
    periodo: periodo.value,
    tipo_servico: tipo.value,
    empresa: empresa.value,
    tecnico: tecnico.value,
  }, botaoAgenda);
  const botaoRevisar = document.createElement("a");
  botaoRevisar.className = "botao";
  botaoRevisar.href = `/cadastro?pendente=${item.id}`;
  botaoRevisar.textContent = "✏️ Revisar tudo";
  const botaoDescartar = document.createElement("button");
  botaoDescartar.type = "button";
  botaoDescartar.className = "botao";
  botaoDescartar.textContent = "🗑 Descartar";
  botaoDescartar.onclick = () => descartarOS(item.id, cartao);
  acoes.append(botaoAgenda, botaoRevisar, botaoDescartar);
  cartao.appendChild(acoes);
  return cartao;
}

function atualizarContador() {
  const total = document.querySelectorAll(".cartao-os-nova").length;
  document.getElementById("caixa-contador").textContent =
    total === 0 ? "Nenhuma OS esperando conferência." :
    total === 1 ? "1 OS esperando conferência" : `${total} OS esperando conferência`;
}

async function carregarOSNovas() {
  const lista = document.getElementById("lista-os-novas");
  const itens = await apiGet("/api/os-pendentes");
  lista.innerHTML = "";
  itens.forEach((item) => lista.appendChild(desenharCartao(item)));
  atualizarContador();
}

async function confirmarOS(id, cartao, ajustes, botao) {
  if (!ajustes.data || !ajustes.periodo) {
    mostrarToast("Preencha a data e o período antes de mandar para a agenda.", "erro");
    return;
  }
  if (!ajustes.tipo_servico || !ajustes.empresa) {
    mostrarToast("Escolha o tipo de serviço e a empresa.", "erro");
    return;
  }
  botao.disabled = true;
  const resultado = await apiEnviar(`/api/os-pendentes/${id}/confirmar`, "POST", ajustes);
  botao.disabled = false;
  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Não consegui mandar para a agenda.", "erro");
    return;
  }
  const s = resultado.dados.servico;
  mostrarToast(`✅ Na agenda: ${s.data} · ${s.periodo}${s.tecnico ? " · " + s.tecnico : ""}`);
  cartao.remove();
  atualizarContador();
}

async function descartarOS(id, cartao) {
  if (!confirm("Descartar essa OS da caixa? Ela não vai para a agenda.")) return;
  const resultado = await apiEnviar(`/api/os-pendentes/${id}/descartar`, "POST", {});
  if (!resultado.ok) {
    mostrarToast("Erro ao descartar.", "erro");
    return;
  }
  cartao.remove();
  atualizarContador();
}

// Envia os arquivos um de cada vez (a leitura por IA pode levar alguns segundos cada).
async function enviarArquivos(arquivos) {
  const status = document.getElementById("caixa-status");
  const resultados = document.getElementById("caixa-resultados");
  resultados.innerHTML = "";
  resultados.classList.remove("escondido");
  status.classList.remove("escondido");
  let adicionadas = 0;

  for (let i = 0; i < arquivos.length; i++) {
    const arquivo = arquivos[i];
    // Nomes muito longos (como os da SAT) ficam encurtados na lista.
    const nome = arquivo.name.length > 32 ? arquivo.name.slice(0, 14) + "…" + arquivo.name.slice(-14) : arquivo.name;
    status.className = "importar-os-status carregando";
    status.textContent = `⏳ Lendo ${i + 1} de ${arquivos.length}…`;
    const li = document.createElement("li");
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const resposta = await fetch("/api/os-pendentes", { method: "POST", body: formData });
      const dados = await resposta.json().catch(() => ({}));
      if (resposta.status === 413) {
        li.textContent = `❌ ${nome}: arquivo grande demais (máximo 20 MB).`;
      } else if (!resposta.ok) {
        li.textContent = `❌ ${nome}: ${dados.erro || "não consegui ler."}`;
      } else if (dados.ignorada) {
        const quem = dados.campos && dados.campos.cliente_nome ? ` (${dados.campos.cliente_nome})` : "";
        li.textContent = `↩ ${nome}${quem}: ignorada, ${dados.motivo}.`;
      } else {
        adicionadas++;
        li.textContent = `✅ ${nome}: ${dados.item.campos.cliente_nome || "OS"} adicionada.`;
      }
    } catch (e) {
      li.textContent = `❌ ${nome}: falha de conexão.`;
    }
    resultados.appendChild(li);
  }

  status.className = "importar-os-status ok";
  status.textContent = `Pronto: ${adicionadas} de ${arquivos.length} OS adicionada(s) à caixa.`;
  entradaArquivos.value = "";
  await carregarOSNovas();
}

entradaArquivos.addEventListener("change", () => {
  const arquivos = [...entradaArquivos.files];
  if (arquivos.length) enviarArquivos(arquivos);
});

carregarOSNovas();
