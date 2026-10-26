// --- Estoque do técnico: equipamentos que ele retirou do estoque principal ---
// Técnico: vê e registra só o próprio estoque.
// Admin: escolhe o técnico no topo e registra/vê em nome dele.

const campoCodigo = document.getElementById("me-codigo");
const seletorTecnico = document.getElementById("me-tecnico"); // só existe para admin
const ehAdmin = !!seletorTecnico;
let enviandoRetirada = false;

function tecnicoEscolhido() {
  return ehAdmin ? seletorTecnico.value : "";
}

function esconderEscolhaEmpresa() {
  document.getElementById("me-escolha-empresa").classList.add("escondido");
  document.getElementById("me-botoes-empresa").innerHTML = "";
}

async function carregarMeuEstoque() {
  const lista = document.getElementById("me-lista");
  const total = document.getElementById("me-total");
  const rotulo = document.getElementById("me-rotulo-total");
  esconderEscolhaEmpresa();

  if (ehAdmin && !tecnicoEscolhido()) {
    lista.innerHTML = `<p class="vazio-lista">Escolha um técnico para ver e registrar o estoque dele.</p>`;
    total.textContent = "0";
    rotulo.textContent = "Equipamentos com o técnico";
    return;
  }

  const filtro = ehAdmin ? `?tecnico=${encodeURIComponent(tecnicoEscolhido())}` : "";
  const dados = await apiGet(`/api/meu-estoque${filtro}`);
  const itens = dados.itens || [];

  total.textContent = itens.length;
  rotulo.textContent = ehAdmin ? `Equipamentos com ${dados.tecnico}` : "Equipamentos com você";

  lista.innerHTML = "";
  if (itens.length === 0) {
    lista.innerHTML = `<p class="vazio-lista">Nenhum equipamento retirado no momento.</p>`;
    return;
  }

  // Agrupa por empresa para facilitar a conferência.
  const porEmpresa = {};
  itens.forEach((item) => {
    (porEmpresa[item.empresa] = porEmpresa[item.empresa] || []).push(item);
  });

  Object.keys(porEmpresa).sort().forEach((empresa) => {
    const titulo = document.createElement("h3");
    titulo.className = "me-grupo";
    titulo.textContent = `${empresa} (${porEmpresa[empresa].length})`;
    lista.appendChild(titulo);

    porEmpresa[empresa].forEach((item) => {
      const div = document.createElement("div");
      div.className = "item-equipamento item-meu-estoque";
      div.innerHTML = `
        <div class="item-equipamento-info">
          <span class="item-equipamento-nome">${escaparHtml(item.codigo)}</span>
          <span class="item-equipamento-obs">${item.modelo ? `Modelo: ${escaparHtml(item.modelo)}` : "Modelo não informado"}</span>
          <span class="item-equipamento-obs">Retirado em ${escaparHtml(item.retirado_em || "—")}</span>
        </div>
      `;
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "botao-status-opcao";
      botao.textContent = "↩ Devolver";
      botao.onclick = () => devolverEquipamento(item.id, item.codigo);
      div.appendChild(botao);
      lista.appendChild(div);
    });
  });
}

async function registrarRetirada(empresa) {
  if (enviandoRetirada) return;
  const codigo = campoCodigo.value.trim();
  if (!codigo) {
    mostrarToast("Leia ou digite o código do equipamento.", "erro");
    campoCodigo.focus();
    return;
  }
  if (ehAdmin && !tecnicoEscolhido()) {
    mostrarToast("Escolha o técnico que está retirando o equipamento.", "erro");
    return;
  }

  enviandoRetirada = true;
  let resultado;
  try {
    resultado = await apiEnviar("/api/meu-estoque/retirar", "POST", {
      codigo, empresa: empresa || "", tecnico: tecnicoEscolhido(),
    });
  } finally {
    enviandoRetirada = false;
  }

  // Mesmo código em mais de uma empresa: pergunta qual.
  if (resultado.status === 409 && resultado.dados.escolher_empresa) {
    const caixa = document.getElementById("me-escolha-empresa");
    const botoes = document.getElementById("me-botoes-empresa");
    botoes.innerHTML = "";
    resultado.dados.empresas.forEach((nome) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "botao-status-opcao";
      btn.textContent = nome;
      btn.onclick = () => registrarRetirada(nome);
      botoes.appendChild(btn);
    });
    caixa.classList.remove("escondido");
    return;
  }

  esconderEscolhaEmpresa();
  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao registrar a retirada.", "erro");
    campoCodigo.select();
    return;
  }

  const item = resultado.dados.item;
  mostrarToast(`✅ ${item.codigo} (${item.empresa}) adicionado ao estoque de ${item.tecnico}`);
  campoCodigo.value = "";
  campoCodigo.focus();
  await carregarMeuEstoque();
}

async function devolverEquipamento(id, codigo) {
  if (!confirm(`Devolver o equipamento ${codigo} ao estoque principal?`)) return;
  const resultado = await apiEnviar(`/api/meu-estoque/${id}/devolver`, "POST", {});
  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao devolver.", "erro");
    return;
  }
  mostrarToast(`↩ ${codigo} devolvido ao estoque.`);
  await carregarMeuEstoque();
}

function lerCodigoComCamera() {
  // Lê pela câmera e já registra a retirada.
  abrirScanner(campoCodigo, () => registrarRetirada());
}

// Leitores USB/Bluetooth "digitam" o código e apertam Enter sozinhos.
campoCodigo.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter") {
    evento.preventDefault();
    registrarRetirada();
  }
});
campoCodigo.addEventListener("input", esconderEscolhaEmpresa);

// No computador (mouse), já deixa o campo pronto para o leitor.
// No celular não, para não abrir o teclado sozinho.
if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
  campoCodigo.focus();
}

carregarMeuEstoque();
