let categoriaAtualModal = null;

function definirDataHojeNoCampo() {
  const hoje = new Date();
  const iso = hoje.toISOString().slice(0, 10); // aaaa-mm-dd
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
      document.getElementById("f-equipamento-instalado").value = "";
    }
  } else {
    campoHouveTroca.classList.add("escondido");
    definirHouveTroca(null);

    campoRetirado.classList.toggle("escondido", !tipoEhRetirada(tipoServico));
    campoInstalado.classList.toggle("escondido", !tipoEhInstalacao(tipoServico));

    if (!tipoEhRetirada(tipoServico)) document.getElementById("f-equipamento-retirado").value = "";
    if (!tipoEhInstalacao(tipoServico)) document.getElementById("f-equipamento-instalado").value = "";
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
    document.getElementById("f-equipamento-instalado").value = "";
  }
}

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
  await enviarFormulario(false);
});

async function enviarFormulario(ignorarConflito) {
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
  const equipamentoInstalado = document.getElementById("f-equipamento-instalado").value.trim();
  const houveTrocaTexto = document.getElementById("f-houve-troca-equipamento").value;
  const houveTrocaEquipamento = houveTrocaTexto === "" ? null : houveTrocaTexto === "true";

  if (status === "Feito" && tipoEhRetirada(tipoServico) && !equipamentoRetirado) {
    mostrarToast("Para marcar como Feito, informe o ID do equipamento retirado.", "erro");
    return;
  }
  if (status === "Feito" && tipoEhInstalacao(tipoServico) && !equipamentoInstalado) {
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
    if (houveTrocaEquipamento === true && !equipamentoInstalado) {
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
    tecnico: document.getElementById("f-tecnico").value.trim(),
    status: status,
    valor: valorNumerico,
    observacoes: document.getElementById("f-observacoes").value.trim(),
    equipamento_retirado_codigo: equipamentoRetirado,
    equipamento_instalado_codigo: equipamentoInstalado,
    houve_troca_equipamento: houveTrocaEquipamento,
    ignorar_conflito: ignorarConflito,
  };

  const resultado = await apiEnviar("/api/servicos", "POST", corpo);

  if (resultado.status === 409 && resultado.dados.conflito) {
    if (confirm(resultado.dados.mensagem)) {
      await enviarFormulario(true);
    }
    return;
  }

  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao salvar.", "erro");
    return;
  }

  mostrarToast("✅ Serviço adicionado!");
  limparFormulario();
}

function limparFormulario() {
  document.getElementById("f-tipo_servico").value = "";
  document.getElementById("f-empresa").value = "";
  document.getElementById("f-endereco").value = "";
  document.getElementById("f-tecnico").value = "";
  document.getElementById("f-status").value = "Agendado";
  document.getElementById("f-valor").value = "";
  document.getElementById("f-observacoes").value = "";
  document.getElementById("f-periodo").value = "";
  document.getElementById("f-equipamento-retirado").value = "";
  document.getElementById("f-equipamento-instalado").value = "";
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
    li.innerHTML = `<span>${valor}</span>`;
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
