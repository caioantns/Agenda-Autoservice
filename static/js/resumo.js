async function carregarResumo() {
  const mes = document.getElementById("filtro-mes").value;
  const ano = document.getElementById("filtro-ano").value;

  const dados = await apiGet(`/api/resumo/${ano}/${mes}`);

  const container = document.getElementById("cartoes-tecnicos");
  container.innerHTML = "";

  if (dados.por_tecnico.length === 0) {
    container.innerHTML = `<p class="vazio-lista">Nenhum técnico cadastrado ainda.</p>`;
  }

  dados.por_tecnico.forEach((item) => {
    const cartao = document.createElement("div");
    cartao.className = "cartao-tecnico";
    cartao.innerHTML = `
      <div>
        <div class="cartao-tecnico-nome">👷 ${item.tecnico}</div>
        <div class="cartao-tecnico-sub">${item.feitos} serviço(s) feito(s)</div>
      </div>
      <div class="cartao-tecnico-valor">${formatarValorReais(item.valor)}</div>
    `;
    container.appendChild(cartao);
  });

  document.getElementById("total-mes-valor").textContent = formatarValorReais(dados.total_valor);
}

async function importarBackup() {
  const input = document.getElementById("arquivo-importar");
  const arquivo = input.files[0];
  if (!arquivo) {
    mostrarToast("Selecione um arquivo .xlsx primeiro.", "erro");
    return;
  }

  const formData = new FormData();
  formData.append("arquivo", arquivo);

  try {
    const resp = await fetch("/api/servicos/importar", { method: "POST", body: formData });
    const dados = await resp.json();

    if (!resp.ok) {
      mostrarToast(dados.erro || "Erro ao importar.", "erro");
      return;
    }

    mostrarToast(`✅ ${dados.importados} serviço(s) importado(s)${dados.ignorados ? `, ${dados.ignorados} ignorado(s)` : ""}.`);
    input.value = "";
    carregarResumo();
  } catch (e) {
    mostrarToast("Erro ao enviar o arquivo.", "erro");
  }
}

carregarResumo();
