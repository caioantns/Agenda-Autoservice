# Agenda Autoservice — Versão Web

Mesma ferramenta do app desktop, agora acessível de qualquer lugar, pelo
celular ou computador, com internet — sem depender de rede local.

## O que mudou em relação ao app desktop

- Roda num navegador (celular ou computador), não precisa instalar nada
- **Contas individuais com dois perfis**: Admin (vê e altera tudo) e Técnico
  (só vê e altera os serviços atribuídos ao próprio nome) — gerenciadas na
  aba "Usuários"
- Os dados ficam guardados num banco de dados no servidor (não mais num
  arquivo CSV na sua máquina)
- Abas: Início (dashboard), Cadastro, Agenda (calendário + observações),
  Resumo (faturamento por técnico/mês), Estoque e Usuários (essas duas
  últimas só aparecem para quem tem perfil Admin)
- Trocar o status de um serviço (Agendado → Em andamento → Feito →
  Frustrado → Cancelado) direto na rua, pelo celular, em tempo real

## 1. Testar localmente antes de publicar (opcional)

```
pip install -r requirements.txt
python app.py
```

Abra `http://localhost:5000` no navegador. Na primeira vez que o app roda,
ele cria automaticamente uma conta admin inicial:
- **Usuário:** `admin`
- **Senha:** `servico123`

Entre com essa conta e vá na aba **Usuários** para criar as contas de verdade
(pra você, seu pai, sua mãe) e desativar/trocar a senha da conta `admin`
inicial depois. Para trocar o usuário/senha padrão desde o início, defina as
variáveis de ambiente `ADMIN_USUARIO` e `ADMIN_SENHA` antes de rodar.

Se você já usava o app desktop e tem um `planilha_dados.csv`, copie ele para
esta pasta e rode `python migrar_csv.py` para trazer o histórico.

## 2. Publicar na internet (Railway — recomendado)

O Railway é simples e tem um plano de baixo custo suficiente para este app
(alguns dólares por mês, dependendo do uso).

1. Crie uma conta em https://railway.app (dá pra entrar com GitHub)
2. Clique em **New Project → Deploy from GitHub repo** (ou **Empty Project**
   e depois arraste esta pasta / conecte via CLI — o Railway mostra as duas
   opções na tela inicial)
3. Se for pelo GitHub: suba esta pasta (`servicos_web`) para um repositório
   novo no seu GitHub, e selecione ele no Railway
4. O Railway detecta o `Procfile` e o `requirements.txt` sozinho e já
   sobe o app
5. Vá em **Variables** (aba do projeto) e adicione:
   - `ADMIN_USUARIO` e `ADMIN_SENHA` → credenciais da primeira conta admin
     (você pode criar as demais contas depois, pela aba Usuários)
   - `SECRET_KEY` → qualquer texto aleatório longo (ex: gere um em
     https://randomkeygen.com)
6. O Railway te dá uma URL pública tipo `https://seu-app.up.railway.app`
   — essa é a URL que você acessa de qualquer lugar, inclusive do celular

**Banco de dados:** por padrão o app usa SQLite (um arquivo simples). Isso
funciona bem para o Railway, mas o armazenamento em disco de alguns planos
gratuitos pode ser apagado a cada novo deploy. Se isso acontecer com você,
me avise que eu troco a configuração para usar o banco Postgres que o
próprio Railway oferece gratuitamente dentro do projeto (é só adicionar o
serviço "Postgres" no mesmo projeto e mudar uma variável de ambiente,
`DATABASE_URL`, que o `app.py` já está preparado para usar automaticamente).

## 3. Alternativas ao Railway

- **Render** (https://render.com): processo parecido, tem plano gratuito
  (mas "dorme" depois de um tempo sem uso, demora uns segundos pra acordar)
- **PythonAnywhere** (https://pythonanywhere.com): bom para apps Flask
  simples, também tem plano gratuito

## 4. Usar no celular como se fosse um app

Depois de publicado, abra a URL no navegador do celular (Chrome ou Safari):

- **Android (Chrome):** menu (⋮) → "Adicionar à tela inicial"
- **iPhone (Safari):** botão de compartilhar (□↑) → "Adicionar à Tela de Início"

Isso cria um ícone na tela do celular que abre o app em tela cheia, sem a
barra de endereço do navegador — visualmente igual a um app nativo.

## Estrutura do projeto

```
servicos_web/
├── app.py              → backend (rotas, lógica)
├── models.py            → estrutura do banco de dados
├── migrar_csv.py         → importa dados do app desktop (opcional)
├── requirements.txt      → dependências Python
├── Procfile               → como o servidor de hospedagem inicia o app
├── templates/             → páginas HTML (Cadastro, Agenda, Resumo, Login)
└── static/
    ├── css/style.css      → visual do app
    ├── js/                → comportamento das páginas
    └── manifest.json      → permite "instalar" no celular
```
