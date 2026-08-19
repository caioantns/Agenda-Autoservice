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
