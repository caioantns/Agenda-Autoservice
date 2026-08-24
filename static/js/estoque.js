let equipamentosCache = [];
let equipamentoEditandoId = null;
let filtroEstoqueAtual = "Todos";

function empresaSelecionada() {
  return document.getElementById("filtro-empresa-estoque").value;
}

async function carregarEstoque() {
  const empresa = empresaSelecionada();
  const semEmpresa = document.getElementById("sem-empresa");
  const area = document.getElementById("area-estoque");

  if (!empresa) {
    semEmpresa.classList.remove("escondido");
    area.classList.add("escondido");
    return;
  }
  semEmpresa.classList.add("escondido");
  area.classList.remove("escondido");

  filtroEstoqueAtual = "Todos";
  document.querySelectorAll(".subaba-item").forEach((btn) => {
    btn.classList.toggle("ativo", btn.dataset.filtro === "Todos");
  });

  equipamentosCache = await apiGet(`/api/estoque/${encodeURIComponent(empresa)}`);
  atualizarContadoresEstoque();
  desenharListaEquipamentos();
}

function mudarFiltroEstoque(filtro) {
  filtroEstoqueAtual = filtro;
  document.querySelectorAll(".subaba-item").forEach((btn) => {
    btn.classList.toggle("ativo", btn.dataset.filtro === filtro);
  });
  desenharListaEquipamentos();
}

function atualizarContadoresEstoque() {
  const contagem = { "Disponível": 0, "Utilizado": 0, "Indisponível": 0 };
  equipamentosCache.forEach((item) => {
    const status = item.status || "Disponível";
    if (contagem[status] !== undefined) contagem[status]++;
  });
  document.getElementById("contador-todos").textContent = equipamentosCache.length;
  document.getElementById("contador-disponivel").textContent = contagem["Disponível"];
  document.getElementById("contador-utilizado").textContent = contagem["Utilizado"];
  document.getElementById("contador-indisponivel").textContent = contagem["Indisponível"];
}

const CLASSE_CHIP_POR_STATUS = { "Disponível": "feito", "Utilizado": "em-andamento", "Indisponível": "cancelado" };

function desenharListaEquipamentos() {
  const lista = document.getElementById("lista-equipamentos");
  lista.innerHTML = "";

  const itensFiltrados = filtroEstoqueAtual === "Todos"
    ? equipamentosCache
    : equipamentosCache.filter((item) => (item.status || "Disponível") === filtroEstoqueAtual);

  if (itensFiltrados.length === 0) {
    const mensagem = equipamentosCache.length === 0
      ? "Nenhum equipamento cadastrado para essa empresa ainda."
      : `Nenhum equipamento "${filtroEstoqueAtual}" no momento.`;
    lista.innerHTML = `<p class="vazio-lista">${mensagem}</p>`;
    return;
  }

  itensFiltrados.forEach((item) => {
    const status = item.status || "Disponível";

    let infoOS = "";
    if (item.os_vinculada) {
      const os = item.os_vinculada;
      infoOS = `<span class="item-equipamento-obs">
        Última OS: ${os.data}${os.periodo ? " · " + os.periodo : ""} · ${os.tipo_servico}
        ${os.tecnico ? " · " + os.tecnico : ""} · ${os.status}
      </span>`;
    }

    const div = document.createElement("div");
    div.className = "item-equipamento";
    div.style.flexDirection = "column";
    div.style.alignItems = "stretch";
    div.style.gap = "8px";

    const linhaTopo = document.createElement("div");
    linhaTopo.style.display = "flex";
    linhaTopo.style.justifyContent = "space-between";
    linhaTopo.style.alignItems = "center";
    linhaTopo.style.cursor = "pointer";
    linhaTopo.onclick = () => abrirEditarEquipamento(item.id);
    linhaTopo.innerHTML = `
      <div class="item-equipamento-info">
        <span class="item-equipamento-nome">${item.codigo}</span>
        <span class="item-equipamento-obs">${item.modelo ? `Modelo: ${item.modelo}` : "Modelo não informado"}</span>
        ${infoOS}
      </div>
      <span class="chip-status ${CLASSE_CHIP_POR_STATUS[status] || "agendado"}">${status}</span>
    `;
    div.appendChild(linhaTopo);

    const botoesStatus = document.createElement("div");
    botoesStatus.className = "botoes-status";
    ["Disponível", "Utilizado", "Indisponível"].forEach((opcao) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "botao-status-opcao" + (opcao === status ? " ativo" : "");
      btn.textContent = opcao;
      btn.onclick = () => mudarStatusEquipamento(item.id, opcao);
      botoesStatus.appendChild(btn);
    });
    div.appendChild(botoesStatus);

    lista.appendChild(div);
  });
}

async function mudarStatusEquipamento(id, novoStatus) {
  const resultado = await apiEnviar(`/api/estoque/${id}/status`, "PATCH", { status: novoStatus });
  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao mudar status.", "erro");
    return;
  }
  mostrarToast(`✅ Status alterado para "${novoStatus}"`);
  const idx = equipamentosCache.findIndex((e) => e.id === id);
  if (idx >= 0) equipamentosCache[idx].status = novoStatus;
  atualizarContadoresEstoque();
  desenharListaEquipamentos();
}

function abrirNovoEquipamento() {
  equipamentoEditandoId = null;
  document.getElementById("modal-equipamento-titulo").textContent = "Novo equipamento";
  document.getElementById("eq-modelo").value = "";
  document.getElementById("eq-codigo").value = "";
  document.getElementById("btn-excluir-equipamento").classList.add("escondido");
  document.getElementById("modal-equipamento").classList.remove("escondido");
}

function abrirEditarEquipamento(id) {
  const item = equipamentosCache.find((e) => e.id === id);
  if (!item) return;
  equipamentoEditandoId = id;
  document.getElementById("modal-equipamento-titulo").textContent = "Editar equipamento";
  document.getElementById("eq-modelo").value = item.modelo || "";
  document.getElementById("eq-codigo").value = item.codigo || "";
  document.getElementById("btn-excluir-equipamento").classList.remove("escondido");
  document.getElementById("modal-equipamento").classList.remove("escondido");
}

function fecharModalEquipamento() {
  document.getElementById("modal-equipamento").classList.add("escondido");
}

async function salvarEquipamento() {
  const modelo = document.getElementById("eq-modelo").value.trim();
  const codigo = document.getElementById("eq-codigo").value.trim();

  if (!codigo) {
    mostrarToast("Informe o ID do equipamento.", "erro");
    return;
  }

  let resultado;
  if (equipamentoEditandoId) {
    resultado = await apiEnviar(`/api/estoque/${equipamentoEditandoId}`, "PUT", { modelo, codigo });
  } else {
    resultado = await apiEnviar("/api/estoque", "POST", { empresa: empresaSelecionada(), modelo, codigo });
  }

  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao salvar.", "erro");
    return;
  }

  mostrarToast(equipamentoEditandoId ? "✅ Equipamento atualizado!" : "✅ Equipamento adicionado!");
  fecharModalEquipamento();
  await carregarEstoque();
}

async function excluirEquipamentoAtual() {
  if (!equipamentoEditandoId) return;
  if (!confirm("Excluir este equipamento do estoque?")) return;

  const resultado = await apiEnviar(`/api/estoque/${equipamentoEditandoId}`, "DELETE", {});
  if (!resultado.ok) {
    mostrarToast("Erro ao excluir.", "erro");
    return;
  }
  mostrarToast("🗑 Equipamento excluído.");
  fecharModalEquipamento();
  equipamentosCache = equipamentosCache.filter((e) => e.id !== equipamentoEditandoId);
  atualizarContadoresEstoque();
  desenharListaEquipamentos();
}
