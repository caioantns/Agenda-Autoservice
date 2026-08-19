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
    if (contagem[item.status_estoque] !== undefined) contagem[item.status_estoque]++;
  });
  document.getElementById("contador-todos").textContent = equipamentosCache.length;
  document.getElementById("contador-disponivel").textContent = contagem["Disponível"];
  document.getElementById("contador-utilizado").textContent = contagem["Utilizado"];
  document.getElementById("contador-indisponivel").textContent = contagem["Indisponível"];
}

function desenharListaEquipamentos() {
  const lista = document.getElementById("lista-equipamentos");
  lista.innerHTML = "";

  const itensFiltrados = filtroEstoqueAtual === "Todos"
    ? equipamentosCache
    : equipamentosCache.filter((item) => item.status_estoque === filtroEstoqueAtual);

  if (itensFiltrados.length === 0) {
    const mensagem = equipamentosCache.length === 0
      ? "Nenhum equipamento cadastrado para essa empresa ainda."
      : `Nenhum equipamento "${filtroEstoqueAtual}" no momento.`;
    lista.innerHTML = `<p class="vazio-lista">${mensagem}</p>`;
    return;
  }

  itensFiltrados.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item-equipamento";
    div.onclick = () => abrirEditarEquipamento(item.id);

    const classeChip = {
      "Disponível": "feito",
      "Utilizado": "em-andamento",
      "Indisponível": "cancelado",
    }[item.status_estoque] || "agendado";

    let infoOS = "";
    if (item.os_vinculada) {
      const os = item.os_vinculada;
      infoOS = `<span class="item-equipamento-obs">
        OS: ${os.data}${os.horario ? " " + os.horario : ""} · ${os.tipo_servico}
        ${os.tecnico ? " · " + os.tecnico : ""} · ${os.status}
      </span>`;
    }

    div.innerHTML = `
      <div class="item-equipamento-info">
        <span class="item-equipamento-nome">${item.codigo}</span>
        <span class="item-equipamento-obs">${item.modelo ? `Modelo: ${item.modelo}` : "Modelo não informado"}</span>
        ${infoOS}
      </div>
      <span class="chip-status ${classeChip}">${item.status_estoque}</span>
    `;
    lista.appendChild(div);
  });
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
