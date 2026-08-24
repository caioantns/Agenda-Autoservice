const hoje = new Date();
let mesAtual = hoje.getMonth() + 1;   // 1-12
let anoAtual = hoje.getFullYear();
let diaSelecionado = hoje.getDate();
let servicoSelecionadoId = null;
let servicosDoDiaCache = [];

const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarDataBR(dia, mes, ano) {
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}
function formatarDataURL(dia, mes, ano) {
  return `${String(dia).padStart(2, "0")}-${String(mes).padStart(2, "0")}-${ano}`;
}

function tecnicoFiltro() {
  return document.getElementById("filtro-tecnico").value;
}

async function mudarFiltroTecnico() {
  await carregarProximos7Dias();
  await desenharCalendario();
  await carregarServicosDoDia();
}

function mesAnterior() {
  mesAtual -= 1;
  if (mesAtual < 1) { mesAtual = 12; anoAtual -= 1; }
  desenharCalendario();
}
function proximoMes() {
  mesAtual += 1;
  if (mesAtual > 12) { mesAtual = 1; anoAtual += 1; }
  desenharCalendario();
}

function irParaHoje() {
  mesAtual = hoje.getMonth() + 1;
  anoAtual = hoje.getFullYear();
  diaSelecionado = hoje.getDate();
  desenharCalendario();
  carregarServicosDoDia();
}

async function desenharCalendario() {
  document.getElementById("calendario-mes-ano").textContent = `${NOMES_MES[mesAtual - 1]} ${anoAtual}`;

  const resumoMes = await apiGet(`/api/agenda/mes/${anoAtual}/${mesAtual}?tecnico=${encodeURIComponent(tecnicoFiltro())}`);

  const primeiroDiaSemana = new Date(anoAtual, mesAtual - 1, 1).getDay();
  const totalDias = new Date(anoAtual, mesAtual, 0).getDate();

  const grade = document.getElementById("calendario-grade");
  grade.innerHTML = "";

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("div");
    vazio.className = "dia-celula vazio";
    grade.appendChild(vazio);
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const celula = document.createElement("div");
    celula.className = "dia-celula";

    const ehHoje = dia === hoje.getDate() && mesAtual === hoje.getMonth() + 1 && anoAtual === hoje.getFullYear();
    if (ehHoje) celula.classList.add("hoje");
    if (dia === diaSelecionado) celula.classList.add("selecionado");

    const info = resumoMes[dia];
    if (info) {
      if (info.situacao === "pendente") celula.classList.add("tem-pendente");
      else if (info.situacao === "cancelado") celula.classList.add("tem-cancelado");
      else if (info.situacao === "frustrado") celula.classList.add("tem-frustrado");
      else celula.classList.add("tem-feito");
    }

    celula.innerHTML = `<span class="dia-numero">${dia}</span>` + (info ? `<span class="dia-bolinha"></span>` : "");
    celula.onclick = () => {
      diaSelecionado = dia;
      desenharCalendario();
      carregarServicosDoDia();
    };
    grade.appendChild(celula);
  }
}

async function carregarServicosDoDia() {
  const dataUrl = formatarDataURL(diaSelecionado, mesAtual, anoAtual);
  const dataBR = formatarDataBR(diaSelecionado, mesAtual, anoAtual);
  document.getElementById("titulo-dia-selecionado").textContent = `Serviços em ${dataBR}`;

  const servicos = await apiGet(`/api/agenda/${dataUrl}?tecnico=${encodeURIComponent(tecnicoFiltro())}`);
  servicosDoDiaCache = servicos;

  const lista = document.getElementById("lista-servicos-dia");
  lista.innerHTML = "";

  if (servicos.length === 0) {
    lista.innerHTML = `<p class="vazio-lista">Nenhum serviço nesse dia.</p>`;
    fecharDetalhe();
    return;
  }

  servicos.forEach((s) => {
    const item = document.createElement("div");
    item.className = "item-servico";
    item.innerHTML = `
      <div class="item-servico-info">
        <span class="item-servico-titulo">${s.periodo || "—"} · ${s.tipo_servico}</span>
        <span class="item-servico-sub">${s.empresa}${s.endereco ? " · " + s.endereco : ""} · ${s.tecnico || "sem técnico"}</span>
      </div>
      <span class="chip-status ${STATUS_CLASSES[s.status]}">${s.status}</span>
    `;
    item.onclick = () => mostrarDetalhe(s.id);
    lista.appendChild(item);
  });

  // Mantém o detalhe aberto se o serviço selecionado ainda estiver na lista.
  if (servicoSelecionadoId && servicos.some((s) => s.id === servicoSelecionadoId)) {
    mostrarDetalhe(servicoSelecionadoId);
  } else {
    fecharDetalhe();
  }
}

async function carregarProximos7Dias() {
  const resultado = await apiGet(`/api/proximos-7-dias?tecnico=${encodeURIComponent(tecnicoFiltro())}`);
  document.getElementById("proximos-7-dias").textContent = `Próximos 7 dias: ${resultado.total}`;
}

// --- Painel de detalhes ---

const CAMPOS_DETALHE = [
  ["Data", "data"], ["Período", "periodo"], ["Tipo de Serviço", "tipo_servico"],
  ["Empresa", "empresa"], ["Endereço", "endereco"], ["Técnico", "tecnico"], ["Valor", "valor"],
  ["Troca de Equipamento", "houve_troca_equipamento"],
  ["Equipamento Retirado", "equipamento_retirado_codigo"], ["Equipamento Instalado", "equipamento_instalado_codigo"],
];

function mostrarDetalhe(id) {
  const servico = servicosDoDiaCache.find((s) => s.id === id);
  if (!servico) return;

  servicoSelecionadoId = id;

  document.getElementById("detalhe-status-chip").textContent = servico.status;
  document.getElementById("detalhe-status-chip").className = `chip-status ${STATUS_CLASSES[servico.status]}`;

  const dl = document.getElementById("detalhe-campos");
  dl.innerHTML = "";
  CAMPOS_DETALHE.forEach(([rotulo, chave]) => {
    // Só mostra a linha de "Troca de Equipamento" quando o tipo é Manutenção.
    if (chave === "houve_troca_equipamento" && !tipoEhManutencao(servico.tipo_servico)) return;

    const dt = document.createElement("dt");
    dt.textContent = rotulo + ":";
    const dd = document.createElement("dd");
    if (chave === "valor") {
      dd.textContent = formatarValorReais(servico.valor);
    } else if (chave === "houve_troca_equipamento") {
      dd.textContent = servico[chave] === true ? "Sim" : servico[chave] === false ? "Não" : "Não informado ainda";
    } else {
      dd.textContent = servico[chave] || "—";
    }
    dl.appendChild(dt);
    dl.appendChild(dd);
  });

  document.getElementById("detalhe-observacoes").value = servico.observacoes || "";

  const botoesStatus = document.getElementById("botoes-status-rapido");
  botoesStatus.innerHTML = "";
  ["Agendado", "Em andamento", "Feito", "Frustrado", "Cancelado"].forEach((st) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "botao-status-opcao" + (st === servico.status ? " ativo" : "");
    btn.textContent = st;
    btn.onclick = () => mudarStatusRapido(id, st);
    botoesStatus.appendChild(btn);
  });

  document.getElementById("painel-detalhe").classList.remove("escondido");
}

function fecharDetalhe() {
  servicoSelecionadoId = null;
  document.getElementById("painel-detalhe").classList.add("escondido");
}

async function mudarStatusRapido(id, novoStatus) {
  const resultado = await apiEnviar(`/api/servicos/${id}/status`, "PATCH", { status: novoStatus });
  if (!resultado.ok) {
    if (resultado.dados.precisa_equipamento) {
      mostrarToast(resultado.dados.erro, "erro");
      abrirEdicao();
      return;
    }
    mostrarToast(resultado.dados.erro || "Erro ao mudar status.", "erro");
    return;
  }
  mostrarToast(`Status alterado para "${novoStatus}"`);
  await desenharCalendario();
  await carregarServicosDoDia();
}

async function salvarObservacao() {
  if (!servicoSelecionadoId) return;
  const texto = document.getElementById("detalhe-observacoes").value.trim();
  const resultado = await apiEnviar(`/api/servicos/${servicoSelecionadoId}/observacoes`, "PATCH", { observacoes: texto });
  if (!resultado.ok) {
    mostrarToast("Erro ao salvar observação.", "erro");
    return;
  }
  mostrarToast("✅ Observação salva!");
  const idx = servicosDoDiaCache.findIndex((s) => s.id === servicoSelecionadoId);
  if (idx >= 0) servicosDoDiaCache[idx].observacoes = texto;
}

// --- Edição ---

function selecionarComFallback(idSelect, valor) {
  const select = document.getElementById(idSelect);
  if (!valor) {
    select.value = "";
    return;
  }
  const existe = Array.from(select.options).some((opt) => opt.value === valor);
  if (!existe) {
    // Valor antigo que não está mais na lista pré-definida (ex: dado legado
    // com digitação diferente). Preserva pra não sumir/mudar sem querer.
    const opt = document.createElement("option");
    opt.value = valor;
    opt.textContent = `${valor} (fora da lista — selecione outro valor)`;
    select.appendChild(opt);
  }
  select.value = valor;
}

function abrirEdicao() {
  const servico = servicosDoDiaCache.find((s) => s.id === servicoSelecionadoId);
  if (!servico) return;

  document.getElementById("e-data").value = converterDataParaISO(servico.data);
  document.getElementById("e-periodo").value = servico.periodo || "";
  selecionarComFallback("e-tipo_servico", servico.tipo_servico);
  selecionarComFallback("e-empresa", servico.empresa);
  document.getElementById("e-endereco").value = servico.endereco || "";
  selecionarComFallback("e-tecnico", servico.tecnico || "");
  document.getElementById("e-status").value = servico.status;
  document.getElementById("e-valor").value = String(servico.valor || 0).replace(".", ",");
  document.getElementById("e-equipamento-retirado").value = servico.equipamento_retirado_codigo || "";
  document.getElementById("e-equipamento-instalado").value = servico.equipamento_instalado_codigo || "";

  // houve_troca_equipamento vem como true / false / null da API
  definirHouveTrocaEdicao(
    servico.houve_troca_equipamento === true ? true :
    servico.houve_troca_equipamento === false ? false : null
  );

  atualizarVisibilidadeEquipamentosEdicao();
  carregarEquipamentosDatalist(servico.empresa, "lista-equipamentos-empresa-edicao");

  document.getElementById("modal-edicao").classList.remove("escondido");
}

function definirHouveTrocaEdicao(valor) {
  document.getElementById("e-houve-troca-equipamento").value = valor === null ? "" : String(valor);

  document.querySelectorAll("#botoes-e-houve-troca .botao-status-opcao").forEach((btn) => {
    const ativo = (valor === true && btn.dataset.valor === "sim") || (valor === false && btn.dataset.valor === "nao");
    btn.classList.toggle("ativo", ativo);
  });

  atualizarVisibilidadeEquipamentosEdicao();
}

function atualizarVisibilidadeEquipamentosEdicao() {
  const tipoServico = document.getElementById("e-tipo_servico").value;
  const campoRetirado = document.getElementById("campo-e-equipamento-retirado");
  const campoInstalado = document.getElementById("campo-e-equipamento-instalado");
  const campoHouveTroca = document.getElementById("campo-e-houve-troca");

  if (tipoEhManutencao(tipoServico)) {
    campoHouveTroca.classList.remove("escondido");
    const houveTrocaTexto = document.getElementById("e-houve-troca-equipamento").value;
    const mostrarCampos = houveTrocaTexto === "true";
    campoRetirado.classList.toggle("escondido", !mostrarCampos);
    campoInstalado.classList.toggle("escondido", !mostrarCampos);
  } else {
    campoHouveTroca.classList.add("escondido");
    campoRetirado.classList.toggle("escondido", !tipoEhRetirada(tipoServico));
    campoInstalado.classList.toggle("escondido", !tipoEhInstalacao(tipoServico));
  }
}
document.getElementById("e-tipo_servico").addEventListener("input", atualizarVisibilidadeEquipamentosEdicao);
document.getElementById("e-tipo_servico").addEventListener("change", atualizarVisibilidadeEquipamentosEdicao);

async function carregarEquipamentosDatalist(empresa, idDatalist) {
  const datalist = document.getElementById(idDatalist);
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
    // sem equipamentos cadastrados ainda, tudo bem
  }
}

function fecharModalEdicao() {
  document.getElementById("modal-edicao").classList.add("escondido");
}

async function salvarEdicao(ignorarConflito) {
  const valorNumerico = parseValorInput(document.getElementById("e-valor").value);
  if (valorNumerico === null) {
    mostrarToast("Valor inválido.", "erro");
    return;
  }
  
  if (!document.getElementById("e-periodo").value) {
    mostrarToast("Selecione o período (Manhã, Integral ou Tarde).", "erro");
    return;
  }

  const status = document.getElementById("e-status").value;
  const tipoServico = document.getElementById("e-tipo_servico").value;
  const equipamentoRetirado = document.getElementById("e-equipamento-retirado").value.trim();
  const equipamentoInstalado = document.getElementById("e-equipamento-instalado").value.trim();
  const houveTrocaTexto = document.getElementById("e-houve-troca-equipamento").value;
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
    data: converterDataParaBR(document.getElementById("e-data").value),
    periodo: document.getElementById("e-periodo").value,
    tipo_servico: tipoServico.trim(),
    empresa: document.getElementById("e-empresa").value.trim(),
    endereco: document.getElementById("e-endereco").value.trim(),
    tecnico: document.getElementById("e-tecnico").value.trim(),
    status: status,
    valor: valorNumerico,
    equipamento_retirado_codigo: equipamentoRetirado,
    equipamento_instalado_codigo: equipamentoInstalado,
    houve_troca_equipamento: houveTrocaEquipamento,
    ignorar_conflito: !!ignorarConflito,
  };

  const resultado = await apiEnviar(`/api/servicos/${servicoSelecionadoId}`, "PUT", corpo);

  if (resultado.status === 409 && resultado.dados.conflito) {
    if (confirm(resultado.dados.mensagem)) {
      await salvarEdicao(true);
    }
    return;
  }

  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao salvar.", "erro");
    return;
  }

  mostrarToast("✅ Serviço atualizado!");
  fecharModalEdicao();
  await desenharCalendario();
  await carregarServicosDoDia();
}

// --- Duplicar / Excluir ---

async function duplicarServico() {
  if (!servicoSelecionadoId) return;
  const resultado = await apiEnviar(`/api/servicos/${servicoSelecionadoId}/duplicar`, "POST", {});
  if (!resultado.ok) {
    mostrarToast("Erro ao duplicar.", "erro");
    return;
  }
  mostrarToast("📋 Serviço duplicado! Ajuste data/horário se precisar.");
  await desenharCalendario();
  await carregarServicosDoDia();
}

async function excluirServico() {
  if (!servicoSelecionadoId) return;
  if (!confirm("Excluir este serviço? Essa ação não pode ser desfeita.")) return;

  const resultado = await apiEnviar(`/api/servicos/${servicoSelecionadoId}`, "DELETE", {});
  if (!resultado.ok) {
    mostrarToast("Erro ao excluir.", "erro");
    return;
  }
  mostrarToast("🗑 Serviço excluído.");
  fecharDetalhe();
  await desenharCalendario();
  await carregarServicosDoDia();
}

// --- Inicialização ---
(async function iniciar() {
  await carregarProximos7Dias();
  await desenharCalendario();
  await carregarServicosDoDia();
})();
