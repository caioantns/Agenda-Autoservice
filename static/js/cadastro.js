// Busca de endereço pelo CEP no formulário de cadastro (função em common.js).
const limparCepCadastro = configurarBuscaCep("f");

let categoriaAtualModal = null;
let osPendenteId = null; // preenchido quando a tela é aberta pela caixa de OS novas

function definirDataHojeNoCampo() {
  // Data local do aparelho (toISOString usaria UTC e, depois das 21h, já marcaria o dia seguinte).
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  document.getElementById("f-data").value = iso;
}

definirDataHojeNoCampo();

document.getElementById("f-empresa").addEventListener("change", carregarEquipamentosDaEmpresa);
document.getElementById("f-empresa").addEventListener("blur", carregarEquipamentosDaEmpresa);
document.getElementById("f-tipo_servico").addEventListener("input", atualizarVisibilidadeEquipamentos);
document.getElementById("f-tipo_servico").addEventListener("change", atualizarVisibilidadeEquipamentos);

function atualizarVisibilidadeEquipamentos() {
  const tipoServico = document.getElementById("f-tipo_servico").value;
  const campoRetirado = document.getElementById("campo-equipamento-retirado");
  const campoInstalado = document.getElementById("campo-equipamento-instalado");
  const campoHouveTroca = document.getElementById("campo-houve-troca");

  if (tipoEhManutencao(tipoServico)) {
    campoHouveTroca.classList.remove("escondido");
    const houveTroca = document.getElementById("f-houve-troca-equipamento").value;
    const mostrarCampos = houveTroca === "true";
    campoRetirado.classList.toggle("escondido", !mostrarCampos);
    campoInstalado.classList.toggle("escondido", !mostrarCampos);
    if (!mostrarCampos) {
      document.getElementById("f-equipamento-retirado").value = "";
      reiniciarEquipamentosInstalados("f-equipamentos-instalados", "lista-equipamentos-empresa");
    }
  } else {
    campoHouveTroca.classList.add("escondido");
    definirHouveTroca(null);

    campoRetirado.classList.toggle("escondido", !tipoEhRetirada(tipoServico));
    campoInstalado.classList.toggle("escondido", !tipoEhInstalacao(tipoServico));

    if (!tipoEhRetirada(tipoServico)) document.getElementById("f-equipamento-retirado").value = "";
    if (!tipoEhInstalacao(tipoServico)) reiniciarEquipamentosInstalados("f-equipamentos-instalados", "lista-equipamentos-empresa");
  }
}

function definirHouveTroca(valor) {
  // valor: true, false ou null (ainda não respondido)
  document.getElementById("f-houve-troca-equipamento").value = valor === null ? "" : String(valor);

  document.querySelectorAll("#botoes-houve-troca .botao-status-opcao").forEach((btn) => {
    const ativo = (valor === true && btn.dataset.valor === "sim") || (valor === false && btn.dataset.valor === "nao");
    btn.classList.toggle("ativo", ativo);
  });

  const campoRetirado = document.getElementById("campo-equipamento-retirado");
  const campoInstalado = document.getElementById("campo-equipamento-instalado");
  const mostrar = valor === true;
  campoRetirado.classList.toggle("escondido", !mostrar);
  campoInstalado.classList.toggle("escondido", !mostrar);
  if (!mostrar) {
    document.getElementById("f-equipamento-retirado").value = "";
    reiniciarEquipamentosInstalados("f-equipamentos-instalados", "lista-equipamentos-empresa");
  }
}

reiniciarEquipamentosInstalados("f-equipamentos-instalados", "lista-equipamentos-empresa");
atualizarVisibilidadeEquipamentos();

async function carregarEquipamentosDaEmpresa() {
  const empresa = document.getElementById("f-empresa").value.trim();
  const datalist = document.getElementById("lista-equipamentos-empresa");
  datalist.innerHTML = "";
  if (!empresa) return;

  try {
    const itens = await apiGet(`/api/estoque/${encodeURIComponent(empresa)}`);
    itens.filter((i) => i.disponivel).forEach((i) => {
      const opt = document.createElement("option");
      opt.value = i.codigo;
      opt.label = i.modelo ? `${i.codigo} — ${i.modelo}` : i.codigo;
      datalist.appendChild(opt);
    });
  } catch (e) {
    // Empresa ainda sem equipamentos cadastrados - tudo bem, datalist fica vazia.
  }
}

document.getElementById("form-cadastro").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  await enviarFormulario();
});

async function enviarFormulario() {
  const valorNumerico = parseValorInput(document.getElementById("f-valor").value);
  if (valorNumerico === null) {
    mostrarToast("Valor inválido. Use algo como 150,00.", "erro");
    return;
  }

  if (!document.getElementById("f-periodo").value) {
    mostrarToast("Selecione o período (Manhã, Integral ou Tarde).", "erro");
    return;
  }
  const status = document.getElementById("f-status").value;
  const tipoServico = document.getElementById("f-tipo_servico").value;
  const equipamentoRetirado = document.getElementById("f-equipamento-retirado").value.trim();
  const equipamentosInstalados = obterEquipamentosInstalados("f-equipamentos-instalados");
  const houveTrocaTexto = document.getElementById("f-houve-troca-equipamento").value;
  const houveTrocaEquipamento = houveTrocaTexto === "" ? null : houveTrocaTexto === "true";

  if (status === "Feito" && tipoEhRetirada(tipoServico) && !equipamentoRetirado) {
    mostrarToast("Para marcar como Feito, informe o ID do equipamento retirado.", "erro");
    return;
  }
  if (status === "Feito" && tipoEhInstalacao(tipoServico) && equipamentosInstalados.length === 0) {
    mostrarToast("Para marcar como Feito, informe o ID do equipamento instalado.", "erro");
    return;
  }
  if (status === "Feito" && tipoEhManutencao(tipoServico)) {
    if (houveTrocaEquipamento === null) {
      mostrarToast("Antes de concluir, informe se houve troca de equipamento.", "erro");
      return;
    }
    if (houveTrocaEquipamento === true && !equipamentoRetirado) {
      mostrarToast("Para marcar como Feito, informe o ID do equipamento retirado.", "erro");
      return;
    }
    if (houveTrocaEquipamento === true && equipamentosInstalados.length === 0) {
      mostrarToast("Para marcar como Feito, informe o ID do equipamento instalado.", "erro");
      return;
    }
  }

  const corpo = {
    data: converterDataParaBR(document.getElementById("f-data").value),
    periodo: document.getElementById("f-periodo").value,
    tipo_servico: tipoServico.trim(),
    empresa: document.getElementById("f-empresa").value.trim(),
    endereco: document.getElementById("f-endereco").value.trim(),
    numero_os: document.getElementById("f-numero_os").value.trim(),
    cliente_nome: document.getElementById("f-cliente_nome").value.trim(),
    cliente_telefone: document.getElementById("f-cliente_telefone").value.trim(),
    placa: document.getElementById("f-placa").value.trim(),
    veiculo: document.getElementById("f-veiculo").value.trim(),
    tecnico: document.getElementById("f-tecnico").value.trim(),
    os_pendente_id: osPendenteId,
    status: status,
    valor: valorNumerico,
    observacoes: document.getElementById("f-observacoes").value.trim(),
    equipamento_retirado_codigo: equipamentoRetirado,
    equipamento_instalado_codigos: equipamentosInstalados,
    houve_troca_equipamento: houveTrocaEquipamento,
  };

  const resultado = await apiEnviar("/api/servicos", "POST", corpo);

  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao salvar.", "erro");
    return;
  }

  mostrarToast("✅ Serviço adicionado!");
  // Veio da caixa de OS novas: volta para ela para continuar conferindo.
  if (osPendenteId) {
    setTimeout(() => { window.location.href = "/os-novas"; }, 700);
    return;
  }
  limparFormulario();
}

function limparFormulario() {
  document.getElementById("f-tipo_servico").value = "";
  document.getElementById("f-empresa").value = "";
  document.getElementById("f-endereco").value = "";
  if (limparCepCadastro) limparCepCadastro();
  CAMPOS_CLIENTE.forEach((campo) => { document.getElementById(`f-${campo}`).value = ""; });
  osPendenteId = null;
  limparImportacaoOS();
  document.getElementById("f-tecnico").value = "";
  document.getElementById("f-status").value = "Agendado";
  document.getElementById("f-valor").value = "";
  document.getElementById("f-observacoes").value = "";
  document.getElementById("f-periodo").value = "";
  document.getElementById("f-equipamento-retirado").value = "";
  reiniciarEquipamentosInstalados("f-equipamentos-instalados", "lista-equipamentos-empresa");
  definirHouveTroca(null);
  definirDataHojeNoCampo();
  atualizarVisibilidadeEquipamentos();
}

// --- Gerenciar listas pré-definidas (empresa, tipo de serviço, técnico) ---

const NOMES_CATEGORIA = { empresa: "Empresa", tipo_servico: "Tipo de Serviço", tecnico: "Técnico" };

async function abrirGerenciarLista(categoria, titulo) {
  categoriaAtualModal = categoria;
  document.getElementById("modal-lista-titulo").textContent = `Gerenciar ${titulo.toLowerCase()}`;
  await recarregarListaModal();
  document.getElementById("modal-lista").classList.remove("escondido");
}

async function recarregarListaModal() {
  const itens = await apiGet(`/api/listas/${categoriaAtualModal}`);
  const ul = document.getElementById("modal-lista-itens");
  ul.innerHTML = "";
  itens.forEach((valor) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${escaparHtml(valor)}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "🗑";
    btn.onclick = () => removerItemLista(valor);
    li.appendChild(btn);
    ul.appendChild(li);
  });
  atualizarOpcoesSelect(categoriaAtualModal, itens);
}

function atualizarOpcoesSelect(categoria, itens) {
  const select = document.getElementById(`f-${categoria}`);
  if (!select || select.tagName !== "SELECT") return;

  const valorAtual = select.value;
  select.innerHTML = "";

  const opcaoVazia = document.createElement("option");
  opcaoVazia.value = "";
  opcaoVazia.textContent = categoria === "tecnico" ? "Sem técnico definido" : "Selecione...";
  select.appendChild(opcaoVazia);

  itens.forEach((valor) => {
    const opt = document.createElement("option");
    opt.value = valor;
    opt.textContent = valor;
    select.appendChild(opt);
  });

  // Mantém a seleção atual se ela ainda existir na lista; senão, volta pro vazio.
  select.value = itens.includes(valorAtual) ? valorAtual : "";
}

async function adicionarItemLista() {
  const input = document.getElementById("modal-lista-novo");
  const valor = input.value.trim();
  if (!valor) return;
  await apiEnviar(`/api/listas/${categoriaAtualModal}`, "POST", { valor });
  input.value = "";
  await recarregarListaModal();
}

async function removerItemLista(valor) {
  if (!confirm(`Remover "${valor}" da lista?`)) return;
  await apiEnviar(`/api/listas/${categoriaAtualModal}/${encodeURIComponent(valor)}`, "DELETE");
  await recarregarListaModal();
}

function fecharModalLista() {
  document.getElementById("modal-lista").classList.add("escondido");
}

// --- Importar OS da empresa (PDF ou foto) ---
// O servidor lê o arquivo e devolve os campos; aqui só preenchemos o
// formulário. Nada é salvo até a pessoa conferir e tocar em "Adicionar".

const CAMPOS_CLIENTE = ["numero_os", "cliente_nome", "cliente_telefone", "placa", "veiculo"];
const entradaArquivoOS = document.getElementById("arquivo-os");

function mostrarStatusImportacao(texto, tipo) {
  const status = document.getElementById("importar-os-status");
  status.textContent = texto;
  status.className = "importar-os-status" + (tipo ? ` ${tipo}` : "");
  status.classList.toggle("escondido", !texto);
}

function limparImportacaoOS() {
  mostrarStatusImportacao("");
  const avisos = document.getElementById("importar-os-avisos");
  avisos.innerHTML = "";
  avisos.classList.add("escondido");
  document.querySelectorAll(".campo-importado").forEach((el) => el.classList.remove("campo-importado"));
  entradaArquivoOS.value = "";
}

function marcarImportado(elemento) {
  elemento.classList.add("campo-importado");
  // Ao mexer no campo, tira o destaque.
  elemento.addEventListener("input", () => elemento.classList.remove("campo-importado"), { once: true });
  elemento.addEventListener("change", () => elemento.classList.remove("campo-importado"), { once: true });
}

function preencherCampo(id, valor) {
  const elemento = document.getElementById(id);
  if (!elemento || elemento.disabled) return false;
  if (elemento.tagName === "SELECT") {
    const existe = [...elemento.options].some((o) => o.value === valor);
    elemento.value = existe ? valor : "";
    if (!existe) return false;
  } else {
    elemento.value = valor || "";
  }
  if (valor) marcarImportado(elemento);
  return !!valor;
}

function preencherComOS(c) {
  // Data: vazia quando a OS vem "a combinar", para não salvar com a data de hoje sem querer.
  document.getElementById("f-data").value = c.data ? converterDataParaISO(c.data) : "";
  if (c.data) marcarImportado(document.getElementById("f-data"));
  preencherCampo("f-periodo", c.periodo);

  preencherCampo("f-tipo_servico", c.tipo_servico);
  atualizarVisibilidadeEquipamentos();
  preencherCampo("f-empresa", c.empresa);
  carregarEquipamentosDaEmpresa();
  if (c.tecnico) preencherCampo("f-tecnico", c.tecnico);

  CAMPOS_CLIENTE.forEach((campo) => preencherCampo(`f-${campo}`, c[campo]));

  if (limparCepCadastro) limparCepCadastro();
  const endereco = c.cep && c.endereco ? `${c.endereco}, ${c.cep}` : c.endereco;
  preencherCampo("f-endereco", endereco);
  preencherCampo("f-observacoes", c.observacoes);
}

async function importarOS(arquivo) {
  limparImportacaoOS();
  mostrarStatusImportacao("⏳ Lendo a OS…", "carregando");
  const formData = new FormData();
  formData.append("arquivo", arquivo);

  let resposta, dados;
  try {
    resposta = await fetch("/api/servicos/ler-os", { method: "POST", body: formData });
    dados = await resposta.json().catch(() => ({}));
  } catch (e) {
    mostrarStatusImportacao("Não consegui enviar o arquivo. Confira sua internet.", "erro");
    return;
  }
  if (resposta.status === 413) {
    mostrarStatusImportacao("Arquivo grande demais (máximo 20 MB).", "erro");
    return;
  }
  if (!resposta.ok) {
    mostrarStatusImportacao(dados.erro || "Não consegui ler essa OS.", "erro");
    return;
  }

  preencherComOS(dados.campos);
  const origem = dados.origem === "ia" ? " (lida pela IA)" : "";
  mostrarStatusImportacao(`✅ OS importada${origem}. Confira os campos destacados e toque em Adicionar.`, "ok");

  const lista = document.getElementById("importar-os-avisos");
  (dados.avisos || []).forEach((texto) => {
    const li = document.createElement("li");
    li.textContent = texto;
    lista.appendChild(li);
  });
  lista.classList.toggle("escondido", !(dados.avisos || []).length);
  document.querySelector(".importar-os").scrollIntoView({ behavior: "smooth", block: "start" });
}

entradaArquivoOS.addEventListener("change", () => {
  const arquivo = entradaArquivoOS.files[0];
  if (arquivo) importarOS(arquivo);
});

// Aberto pela caixa de "OS novas" (/cadastro?pendente=ID): carrega a OS para revisão.
async function carregarOSPendente() {
  const id = new URLSearchParams(window.location.search).get("pendente");
  if (!id) return;
  try {
    const item = await apiGet(`/api/os-pendentes/${encodeURIComponent(id)}`);
    if (item.status !== "nova") {
      mostrarStatusImportacao("Essa OS já foi tratada na caixa de OS novas.", "erro");
      return;
    }
    osPendenteId = item.id;
    preencherComOS(item.campos);
    mostrarStatusImportacao("📥 OS da caixa de entrada: confira e toque em Adicionar.", "ok");
    const lista = document.getElementById("importar-os-avisos");
    (item.avisos || []).forEach((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      lista.appendChild(li);
    });
    lista.classList.toggle("escondido", !(item.avisos || []).length);
  } catch (e) {
    mostrarStatusImportacao("Não encontrei essa OS na caixa de entrada.", "erro");
  }
}
carregarOSPendente();
