// --- Toast simples ---
function mostrarToast(mensagem, tipo = "ok") {
  const toast = document.getElementById("toast");
  toast.textContent = mensagem;
  toast.className = "toast mostrar" + (tipo === "erro" ? " erro" : "");
  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.className = "toast";
  }, 2600);
}

// --- Helpers de chamada à API ---
async function apiGet(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Erro ao carregar dados.");
  return resp.json();
}

async function apiEnviar(url, metodo, corpo) {
  const resp = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo || {}),
  });
  const dados = await resp.json().catch(() => ({}));
  return { status: resp.status, ok: resp.ok, dados };
}

// --- Formatação ---
function formatarValorReais(valor) {
  const v = Number(valor || 0);
  return "R$ " + v.toFixed(2).replace(".", ",");
}

function parseValorInput(texto) {
  if (!texto) return 0;
  texto = texto.trim().replace("R$", "").replace(/\s/g, "");
  if (texto.includes(",") && texto.includes(".")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }
  const v = parseFloat(texto);
  return isNaN(v) ? null : v;
}

const STATUS_CLASSES = {
  "Agendado": "agendado",
  "Em andamento": "em-andamento",
  "Feito": "feito",
  "Frustrado": "frustrado",
  "Cancelado": "cancelado",
};

// --- Conversão de data: <input type="date"> usa aaaa-mm-dd; o backend usa dd/mm/aaaa ---
function converterDataParaBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function converterDataParaISO(dataBR) {
  if (!dataBR) return "";
  const [dia, mes, ano] = dataBR.split("/");
  return `${ano}-${mes}-${dia}`;
}

// --- Tipo de serviço: decide quais campos de equipamento mostrar/exigir ---
function normalizarTexto(texto) {
  return (texto || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function tipoEhRetirada(tipoServico) {
  return normalizarTexto(tipoServico) === "retirada";
}
function tipoEhInstalacao(tipoServico) {
  return normalizarTexto(tipoServico) === "instalacao";
}
function tipoEhManutencao(tipoServico) {
  return normalizarTexto(tipoServico) === "manutencao";
}

// --- Equipamento(s) instalado(s): permite adicionar mais de um campo na tela ---
// Cada linha tem seu próprio input + botão de scanner (📷) + botão de remover
// (exceto a primeira, que sempre fica, pra sempre sobrar pelo menos 1 campo).

function criarLinhaEquipamentoInstalado(containerId, datalistId, valor = "") {
  const container = document.getElementById(containerId);
  const linha = document.createElement("div");
  linha.className = "linha-combo linha-equipamento-instalado";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "input-equipamento-instalado";
  input.setAttribute("list", datalistId);
  input.placeholder = "ID do equipamento";
  input.value = valor;
  linha.appendChild(input);

  const botaoScanner = document.createElement("button");
  botaoScanner.type = "button";
  botaoScanner.className = "botao-icone";
  botaoScanner.title = "Ler QR Code / código de barras";
  botaoScanner.textContent = "📷";
  botaoScanner.onclick = () => abrirScanner(input);
  linha.appendChild(botaoScanner);

  if (container.children.length > 0) {
    const botaoRemover = document.createElement("button");
    botaoRemover.type = "button";
    botaoRemover.className = "botao-icone";
    botaoRemover.title = "Remover este equipamento";
    botaoRemover.textContent = "✕";
    botaoRemover.onclick = () => linha.remove();
    linha.appendChild(botaoRemover);
  }

  container.appendChild(linha);
}

// Volta o container para o estado inicial: uma única linha vazia.
function reiniciarEquipamentosInstalados(containerId, datalistId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  criarLinhaEquipamentoInstalado(containerId, datalistId);
}

// Preenche o container a partir de uma lista de códigos já salvos (usado na edição).
function preencherEquipamentosInstalados(containerId, datalistId, codigos) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!codigos || codigos.length === 0) {
    criarLinhaEquipamentoInstalado(containerId, datalistId);
    return;
  }
  codigos.forEach((codigo) => criarLinhaEquipamentoInstalado(containerId, datalistId, codigo));
}

// Lê os códigos preenchidos em todas as linhas do container (ignora vazios e repetidos).
function obterEquipamentosInstalados(containerId) {
  const inputs = document.querySelectorAll(`#${containerId} .input-equipamento-instalado`);
  const codigos = [];
  inputs.forEach((input) => {
    const valor = input.value.trim();
    if (valor && !codigos.includes(valor)) codigos.push(valor);
  });
  return codigos;
}
