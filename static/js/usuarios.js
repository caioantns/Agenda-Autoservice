let usuariosCache = [];
let usuarioEditandoId = null;

async function carregarUsuarios() {
  usuariosCache = await apiGet("/api/usuarios");
  desenharListaUsuarios();
}

function desenharListaUsuarios() {
  const lista = document.getElementById("lista-usuarios");
  lista.innerHTML = "";

  if (usuariosCache.length === 0) {
    lista.innerHTML = `<p class="vazio-lista">Nenhum usuário cadastrado ainda.</p>`;
    return;
  }

  usuariosCache.forEach((u) => {
    const div = document.createElement("div");
    div.className = "item-usuario";
    div.onclick = () => abrirEditarUsuario(u.id);

    const chipRole = u.role === "admin" ? "feito" : "agendado";
    const rotuloRole = u.role === "admin" ? "Admin" : `Técnico: ${u.tecnico_nome || "—"}`;

    div.innerHTML = `
      <div class="item-usuario-info">
        <span class="item-usuario-nome">${u.nome} ${u.ativo ? "" : "(inativo)"}</span>
        <span class="item-usuario-obs">Login: ${u.usuario}</span>
      </div>
      <span class="chip-status ${u.ativo ? chipRole : 'cancelado'}">${rotuloRole}</span>
    `;
    lista.appendChild(div);
  });
}

function atualizarCampoTecnico() {
  const role = document.getElementById("u-role").value;
  document.getElementById("campo-u-tecnico").classList.toggle("escondido", role !== "tecnico");
}

function abrirNovoUsuario() {
  usuarioEditandoId = null;
  document.getElementById("modal-usuario-titulo").textContent = "Novo usuário";
  document.getElementById("u-nome").value = "";
  document.getElementById("u-usuario").value = "";
  document.getElementById("u-senha").value = "";
  document.getElementById("label-u-senha").textContent = "Senha";
  document.getElementById("u-usuario").disabled = false;
  document.getElementById("u-role").value = "tecnico";
  document.getElementById("u-tecnico-nome").value = "";
  document.getElementById("u-ativo").checked = true;
  document.getElementById("btn-excluir-usuario").classList.add("escondido");
  atualizarCampoTecnico();
  document.getElementById("modal-usuario").classList.remove("escondido");
}

function abrirEditarUsuario(id) {
  const u = usuariosCache.find((x) => x.id === id);
  if (!u) return;
  usuarioEditandoId = id;
  document.getElementById("modal-usuario-titulo").textContent = "Editar usuário";
  document.getElementById("u-nome").value = u.nome;
  document.getElementById("u-usuario").value = u.usuario;
  document.getElementById("u-usuario").disabled = true; // login não muda depois de criado
  document.getElementById("u-senha").value = "";
  document.getElementById("label-u-senha").textContent = "Nova senha (deixe em branco para manter a atual)";
  document.getElementById("u-role").value = u.role;
  document.getElementById("u-tecnico-nome").value = u.tecnico_nome || "";
  document.getElementById("u-ativo").checked = u.ativo;
  document.getElementById("btn-excluir-usuario").classList.remove("escondido");
  atualizarCampoTecnico();
  document.getElementById("modal-usuario").classList.remove("escondido");
}

function fecharModalUsuario() {
  document.getElementById("modal-usuario").classList.add("escondido");
}

async function salvarUsuario() {
  const nome = document.getElementById("u-nome").value.trim();
  const usuarioLogin = document.getElementById("u-usuario").value.trim();
  const senha = document.getElementById("u-senha").value;
  const role = document.getElementById("u-role").value;
  const tecnicoNome = document.getElementById("u-tecnico-nome").value.trim();
  const ativo = document.getElementById("u-ativo").checked;

  if (!nome) {
    mostrarToast("Informe o nome.", "erro");
    return;
  }
  if (role === "tecnico" && !tecnicoNome) {
    mostrarToast("Informe qual técnico essa conta representa.", "erro");
    return;
  }

  let resultado;
  if (usuarioEditandoId) {
    resultado = await apiEnviar(`/api/usuarios/${usuarioEditandoId}`, "PUT", {
      nome, senha, role, tecnico_nome: tecnicoNome, ativo,
    });
  } else {
    if (!usuarioLogin || !senha) {
      mostrarToast("Informe o usuário (login) e a senha.", "erro");
      return;
    }
    resultado = await apiEnviar("/api/usuarios", "POST", {
      nome, usuario: usuarioLogin, senha, role, tecnico_nome: tecnicoNome,
    });
  }

  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao salvar.", "erro");
    return;
  }

  mostrarToast(usuarioEditandoId ? "✅ Usuário atualizado!" : "✅ Usuário criado!");
  fecharModalUsuario();
  await carregarUsuarios();
}

async function excluirUsuarioAtual() {
  if (!usuarioEditandoId) return;
  if (!confirm("Excluir este usuário? Ele perde o acesso imediatamente.")) return;

  const resultado = await apiEnviar(`/api/usuarios/${usuarioEditandoId}`, "DELETE", {});
  if (!resultado.ok) {
    mostrarToast(resultado.dados.erro || "Erro ao excluir.", "erro");
    return;
  }
  mostrarToast("🗑 Usuário excluído.");
  fecharModalUsuario();
  await carregarUsuarios();
}

carregarUsuarios();
