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

// --- Segurança: escapa texto antes de colocar dentro de innerHTML ---
// Sem isso, um endereço ou observação digitado com código HTML seria executado
// no navegador de quem abrisse a tela.
function escaparHtml(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// --- Busca de endereço pelo CEP (ViaCEP, gratuito) ---
// Liga os campos <prefixo>-cep, <prefixo>-numero, <prefixo>-endereco e
// <prefixo>-cep-status. Ao completar os 8 dígitos, busca a rua, bairro e cidade
// e monta o endereço; o número digitado entra logo depois do nome da rua.
function configurarBuscaCep(prefixo) {
  const campoCep = document.getElementById(`${prefixo}-cep`);
  const campoNumero = document.getElementById(`${prefixo}-numero`);
  const campoEndereco = document.getElementById(`${prefixo}-endereco`);
  const status = document.getElementById(`${prefixo}-cep-status`);
  if (!campoCep || !campoNumero || !campoEndereco) return null;

  let dadosCep = null;        // resultado da última busca
  let enderecoGerado = "";    // o que o app escreveu no campo de endereço
  let ultimoCepBuscado = "";

  function mostrarStatus(texto, tipo) {
    status.textContent = texto;
    status.className = "cep-status" + (tipo ? " cep-" + tipo : "");
  }

  function montarEndereco() {
    if (!dadosCep) return;
    // Se a pessoa já mexeu no endereço na mão, não sobrescreve.
    if (campoEndereco.value.trim() && campoEndereco.value !== enderecoGerado) return;
    const numero = campoNumero.value.trim();
    const local = `${dadosCep.localidade} - ${dadosCep.uf}`;
    let texto;
    if (dadosCep.logradouro) {
      texto = dadosCep.logradouro + (numero ? `, ${numero}` : "");
      if (dadosCep.bairro) texto += ` - ${dadosCep.bairro}`;
      texto += `, ${local}`;
    } else {
      // CEP geral da cidade: não traz rua.
      texto = [dadosCep.bairro, local].filter(Boolean).join(", ");
    }
    campoEndereco.value = texto;
    enderecoGerado = texto;
  }

  async function buscar(cep) {
    if (cep === ultimoCepBuscado) return;
    ultimoCepBuscado = cep;
    mostrarStatus("Buscando CEP…");
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!resposta.ok) throw new Error("resposta inválida");
      const dados = await resposta.json();
      if (dados.erro) {
        dadosCep = null;
        mostrarStatus("CEP não encontrado. Confira os números ou digite o endereço.", "erro");
        return;
      }
      dadosCep = dados;
      enderecoGerado = campoEndereco.value; // permite sobrescrever o que estava lá
      montarEndereco();
      if (dados.logradouro) {
        mostrarStatus("✓ Endereço encontrado. Agora preencha o número.", "ok");
        campoNumero.focus();
      } else {
        mostrarStatus("CEP geral da cidade: digite a rua e o número no endereço.", "aviso");
        campoEndereco.focus();
      }
    } catch (e) {
      ultimoCepBuscado = "";
      mostrarStatus("Não foi possível buscar o CEP agora (sem internet?). Digite o endereço.", "erro");
    }
  }

  campoCep.addEventListener("input", () => {
    const digitos = campoCep.value.replace(/\D/g, "").slice(0, 8);
    campoCep.value = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    if (digitos.length === 8) buscar(digitos);
    else { ultimoCepBuscado = ""; mostrarStatus(""); }
  });
  campoNumero.addEventListener("input", montarEndereco);

  // Para limpar o formulário (novo cadastro ou abrir outro serviço).
  return function limpar() {
    campoCep.value = "";
    campoNumero.value = "";
    dadosCep = null;
    enderecoGerado = "";
    ultimoCepBuscado = "";
    mostrarStatus("");
  };
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
