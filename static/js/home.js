const { useState, useEffect } = React;
const h = React.createElement;

const CARDS_BASE = [
  {
    id: "cadastro", titulo: "Cadastro", desc: "Registrar um novo serviço",
    icone: "📝", href: "/cadastro", cor: "#2F5496",
  },
  {
    id: "agenda", titulo: "Agenda", desc: "Ver o calendário e os clientes do dia",
    icone: "📅", href: "/agenda", cor: "#1F8A70",
  },
  {
    id: "estoque", titulo: "Estoque", desc: "Equipamentos disponíveis, utilizados e indisponíveis",
    icone: "📦", href: "/estoque", cor: "#B9770E", somenteAdmin: true,
  },
  {
    id: "resumo", titulo: "Resumo", desc: "Faturamento e serviços feitos por técnico",
    icone: "📊", href: "/resumo", cor: "#7D3C98",
  },
  {
    id: "usuarios", titulo: "Usuários", desc: "Gerenciar contas de acesso da equipe",
    icone: "👤", href: "/usuarios", cor: "#566573", somenteAdmin: true,
  },
];

const CARDS = CARDS_BASE.filter((c) => !c.somenteAdmin || window.APP_ROLE === "admin");

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function formatarDataExtenso() {
  const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const hoje = new Date();
  return `${dias[hoje.getDay()]}, ${hoje.getDate()} de ${meses[hoje.getMonth()]}`;
}

function StatChip({ icone, valor, label, carregando }) {
  return h("div", { className: "stat-chip" },
    h("span", { className: "stat-chip-icone" }, icone),
    h("div", { className: "stat-chip-texto" },
      h("span", { className: "stat-chip-valor" }, carregando ? "…" : valor),
      h("span", { className: "stat-chip-label" }, label),
    ),
  );
}

function CardAcesso({ card, indice }) {
  const estilo = { transitionDelay: `${indice * 70}ms`, "--cor-card": card.cor };
  return h("a", { href: card.href, className: "card-acesso", style: estilo },
    h("div", { className: "card-acesso-icone" }, card.icone),
    h("div", { className: "card-acesso-textos" },
      h("span", { className: "card-acesso-titulo" }, card.titulo),
      h("span", { className: "card-acesso-desc" }, card.desc),
    ),
    h("span", { className: "card-acesso-seta" }, "→"),
  );
}

function HomeApp() {
  const [stats, setStats] = useState(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    fetch("/api/home/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats({}));
    // Pequeno atraso para disparar a animação de entrada dos cards.
    const t = setTimeout(() => setMontado(true), 30);
    return () => clearTimeout(t);
  }, []);

  const carregando = !stats;

  return h("div", { className: "home-wrap" },
    h("div", { className: "home-hero" },
      h("span", { className: "home-saudacao" }, `${saudacao()}${window.APP_NOME ? ", " + window.APP_NOME : ""}! 👋`),
      h("span", { className: "home-data" }, formatarDataExtenso()),
    ),
    h("div", { className: "home-stats" },
      h(StatChip, { icone: "🗓", valor: carregando ? "" : stats.servicos_hoje, label: "Serviços hoje", carregando }),
      h(StatChip, { icone: "⏭", valor: carregando ? "" : stats.proximos_7_dias, label: "Próximos 7 dias", carregando }),
      window.APP_ROLE === "admin" && h(StatChip, { icone: "🏢", valor: carregando ? "" : stats.total_empresas, label: "Empresas", carregando }),
      window.APP_ROLE === "admin" && h(StatChip, { icone: "📦", valor: carregando ? "" : stats.equipamentos_fora_do_estoque, label: "Fora do estoque", carregando }),
    ),
    h("div", { className: `home-cards ${montado ? "home-cards-visivel" : ""}` },
      CARDS.map((card, i) => h(CardAcesso, { key: card.id, card, indice: i })),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("home-root")).render(h(HomeApp));
