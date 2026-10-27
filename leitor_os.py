"""Leitura automática de Ordens de Serviço (OS) em PDF ou foto.

Dois caminhos:
1. Modelos conhecidos (SAT Company, CEABS, Zen Seguros): o texto é tirado do
   PDF e os campos são localizados por padrões fixos. Grátis e instantâneo.
2. Qualquer outro modelo, PDF escaneado ou foto: envia o arquivo para a IA do
   Claude (API da Anthropic), que devolve os campos já organizados. Só funciona
   com a variável de ambiente ANTHROPIC_API_KEY configurada.

O resultado nunca é salvo direto: ele preenche o formulário de cadastro para
alguém conferir antes.
"""

import base64
import io
import json
import os
import re
import urllib.error
import urllib.request

from pypdf import PdfReader

CAMPOS_VAZIOS = {
    "numero_os": "",
    "tipo_servico": "",
    "data": "",          # dd/mm/aaaa
    "periodo": "",       # Manhã / Tarde / Integral
    "empresa": "",       # nome como aparece na OS
    "cliente_nome": "",
    "cliente_telefone": "",
    "endereco": "",
    "cep": "",
    "placa": "",
    "veiculo": "",
    "tecnico": "",       # técnico indicado na OS, se houver
    "observacoes": "",
}


class ErroLeituraOS(Exception):
    """Erro com mensagem pronta para mostrar na tela."""


# ----------------------------------------------------------------------
# Utilidades de texto
# ----------------------------------------------------------------------

# Alguns PDFs (ex.: SAT Company) vêm com os acentos quebrados no próprio
# arquivo, como "Instala��o". Consertamos as palavras mais comuns; o que
# sobrar fica marcado para a pessoa conferir.
CORRECOES_ACENTO = [
    ("Instala\ufffd\ufffdo", "Instalação"), ("INSTALA\ufffd\ufffdO", "INSTALAÇÃO"),
    ("Manuten\ufffd\ufffdo", "Manutenção"), ("MANUTEN\ufffd\ufffdO", "MANUTENÇÃO"),
    ("Ve\ufffdculos", "Veículos"), ("VE\ufffdCULOS", "VEÍCULOS"),
    ("Ve\ufffdculo", "Veículo"), ("VE\ufffdCULO", "VEÍCULO"),
    ("Maric\ufffd", "Maricá"), ("MARIC\ufffd", "MARICÁ"),
    ("Niter\ufffdi", "Niterói"), ("NITER\ufffdI", "NITERÓI"),
    ("S\ufffdo Gon\ufffdalo", "São Gonçalo"), ("S\ufffdO GON\ufffdALO", "SÃO GONÇALO"),
    ("Itabora\ufffd", "Itaboraí"), ("ITABORA\ufffd", "ITABORAÍ"),
    ("MANH\ufffd", "MANHÃ"), ("Manh\ufffd", "Manhã"),
    ("PER\ufffdODO", "PERÍODO"),
]


def limpar_texto_pdf(texto):
    texto = texto.replace("\u00a0", " ")
    # "Gouv � a" -> "Gouv�a": o extrator separa o caractere quebrado da palavra.
    texto = re.sub(r"(?<=\w) ?(\ufffd+) ?(?=\w)", r"\1", texto)
    texto = re.sub(r"(?<=\w) (\ufffd+)(?=[\s,.;)\-]|$)", r"\1", texto)
    for errado, certo in CORRECOES_ACENTO:
        texto = texto.replace(errado, certo)
    return texto


def extrair_texto_pdf(conteudo):
    try:
        leitor = PdfReader(io.BytesIO(conteudo))
        if leitor.is_encrypted:
            raise ErroLeituraOS("Esse PDF está protegido por senha.")
        texto = "\n".join((pagina.extract_text() or "") for pagina in leitor.pages[:6])
    except ErroLeituraOS:
        raise
    except Exception:
        raise ErroLeituraOS("Não consegui abrir esse PDF. Confira se o arquivo não está corrompido.")
    return limpar_texto_pdf(texto)


def _achar(padrao, texto, grupo=1, flags=0):
    m = re.search(padrao, texto, flags)
    return m.group(grupo).strip() if m else ""


def _espacos(texto):
    texto = re.sub(r"\s+", " ", texto or "").strip()
    return texto.replace("( ", "(").replace(" )", ")")


def formatar_telefone(texto):
    """'(21) 9890-75093' -> '(21) 98907-5093'. Ignora números zerados de exemplo."""
    digitos = re.sub(r"\D", "", texto or "")
    if digitos.startswith("55") and len(digitos) in (12, 13):
        digitos = digitos[2:]
    if not digitos or set(digitos) == {"0"} or len(digitos) < 10:
        return ""
    ddd, numero = digitos[:2], digitos[2:]
    if len(numero) == 9:
        return f"({ddd}) {numero[:5]}-{numero[5:]}"
    if len(numero) == 8:
        return f"({ddd}) {numero[:4]}-{numero[4:]}"
    return f"({ddd}) {numero}"


def formatar_cep(texto):
    digitos = re.sub(r"\D", "", texto or "")
    return f"{digitos[:5]}-{digitos[5:8]}" if len(digitos) == 8 else ""


def normalizar_periodo(texto):
    t = (texto or "").strip().lower()
    if t.startswith("manh"):
        return "Manhã"
    if t.startswith("tard"):
        return "Tarde"
    if t.startswith(("integ", "comerc", "dia todo")):
        return "Integral"
    return ""


def montar_endereco(rua, numero, bairro, cidade, uf):
    numero = (numero or "").strip()
    if numero in ("", "0", "00", "000"):
        numero = "S/N"
    texto = _espacos(rua)
    if texto:
        texto += f", {numero}"
    if bairro:
        texto += f" - {_espacos(bairro)}"
    local = " - ".join(p for p in (_espacos(cidade), _espacos(uf)) if p)
    if local:
        texto += f", {local}"
    return texto.strip(", -")


def _juntar_observacoes(partes):
    return "\n".join(p for p in (_espacos(x) for x in partes) if p)


# ----------------------------------------------------------------------
# Modelos conhecidos
# ----------------------------------------------------------------------

def ler_sat_company(t):
    c = dict(CAMPOS_VAZIOS, empresa="SAT Company")
    c["tipo_servico"] = _achar(r'"([^"]+)"\s*N\.º\s*\d+', t)
    c["numero_os"] = _achar(r'"[^"]+"\s*N\.º\s*(\d+)', t)
    # A parte do contrato tem nome e endereço numa linha só, mais fácil de ler.
    c["cliente_nome"] = _espacos(_achar(r"Nome/Razão Social:\s*(.+?)\s*\.\s*CPF/CNPJ", t))
    if not c["cliente_nome"]:
        c["cliente_nome"] = _espacos(_achar(r"Cliente:\s*(.+?)\s*Telefone:", t, flags=re.S))
    c["cliente_telefone"] = formatar_telefone(_achar(r"Telefone:\s*([\d()\s-]{8,})", t))
    m = re.search(
        r"Endereço:\s*(.+?)\s*,\s*(\S*)\s*Bairro:\s*(.*?)\s*Município:\s*(.+?)\s*CEP:\s*(\d+)\s*UF:\s*([A-Z]{2})", t)
    if m:
        c["endereco"] = montar_endereco(m.group(1), m.group(2), m.group(3), m.group(4), m.group(6))
        c["cep"] = formatar_cep(m.group(5))
    c["placa"] = _achar(r"Placa:\s*([A-Z0-9]{7})", t)
    fabricante = _achar(r"Fabricante:\s*(.+?)\s*Modelo:", t)
    modelo = _achar(r"Modelo:\s*(.+?)\s*Tipo:", t)
    c["veiculo"] = _espacos(f"{fabricante} {modelo}")
    m = re.search(r"AGENDADO PARA\s*(\d{2}/\d{2}/\d{4}).{0,12}?PER\S{0,3}ODO:\s*(\w+)", t, re.S)
    if m:
        c["data"] = m.group(1)
        c["periodo"] = normalizar_periodo(m.group(2))
    equipamento = _achar(r"Equipamento:\s*(.+?)\s*Km:", t)
    obs = _achar(r"Obs:\s*(.+?)\s*O presente instrumento", t, flags=re.S)
    c["observacoes"] = _juntar_observacoes([
        f"Equipamento: {equipamento}" if equipamento else "",
        obs,
    ])
    return c


def ler_ceabs(t):
    c = dict(CAMPOS_VAZIOS, empresa="CEABS")
    c["numero_os"] = _achar(r"Nº OS:\s*(\S+)", t)
    c["tipo_servico"] = _achar(r"Tipo OS:\s*(\S+)", t)
    m = re.search(r"(\d{2}/\d{2}/\d{4})\s*-\s*(Manhã|Tarde|Integral|Comercial|Noite)", t, re.I)
    if m:
        c["data"], c["periodo"] = m.group(1), normalizar_periodo(m.group(2))
    c["cliente_nome"] = _espacos(_achar(r"Proprietário:\s*(.+?)\s*Tipo OS:", t))
    telefones = [formatar_telefone(x) for x in re.findall(r"\(\d{2}\)\s*\d{4,5}-?\d{4}", _achar(r"Telefone\(s\):(.*)", t))]
    telefones = [x for i, x in enumerate(telefones) if x and x not in telefones[:i]]
    c["cliente_telefone"] = telefones[0] if telefones else ""
    rua = _achar(r"End\. de Instalação \(Proprietário\):\s*(.+?)\s*Nº:", t)
    numero = _achar(r"End\. de Instalação \(Proprietário\):.*?Nº:\s*(\S*)\s*Complemento:", t)
    complemento = _achar(r"Complemento:[ \t]*(.*)", t)
    cidade = _achar(r"Cidade:\s*(.+?)\s*Estado:", t)
    uf = _achar(r"Estado:\s*([A-Z]{2})", t)
    bairro = _achar(r"Bairro:\s*(.+?)\s*Codigo Frota", t)
    c["endereco"] = montar_endereco(rua, numero, bairro, cidade, uf)
    c["cep"] = formatar_cep(_achar(r"CEP:\s*(\d{5}-?\d{3})", t.split("Placa:")[0]))
    c["placa"] = _achar(r"Placa:\s*([A-Z0-9]{7})", t)
    c["veiculo"] = _espacos(_achar(r"Veículo/Modelo:\s*(.+?)\s*Ano Fab", t))
    c["tecnico"] = _achar(r"Instaladora:.*?Técnico:[ \t]*(\S[^\n]*)", t) or \
        _achar(r"Nome Técnico:[ \t]*(.*?)[ \t]*Visto:", t)
    seguradora = _espacos(_achar(r"\nCliente:\s*(.+?)\s*Nº OS:", t))
    motivo = _achar(r"Mo\S{0,3}\s?vo da Abertura:[ \t]*(.*)", t)
    observacao = _achar(r"Observação:[ \t]*(.*)", t)
    c["observacoes"] = _juntar_observacoes([
        f"Motivo: {motivo}" if motivo else "",
        f"Complemento: {complemento}" if complemento else "",
        f"Seguradora/associação: {seguradora}" if seguradora else "",
        f"Outros telefones: {', '.join(telefones[1:])}" if len(telefones) > 1 else "",
        f"Obs. da OS: {observacao}" if observacao else "",
    ])
    return c


def ler_zen_seguros(t):
    c = dict(CAMPOS_VAZIOS, empresa="Zen Seguros")
    m = re.search(r"COMPLETO\s*\n(.+?)\s+CONTATO\s+(.+)", t)
    if m:
        c["cliente_nome"] = _espacos(m.group(1).replace("***", ""))
        c["cliente_telefone"] = formatar_telefone(m.group(2))
    endereco = _achar(r"ENDEREÇO\s+(.+)", t)
    partes = [p.strip() for p in endereco.split(",")]
    if len(partes) >= 5:
        c["endereco"] = montar_endereco(partes[0], partes[1], partes[2], ", ".join(partes[3:-1]), partes[-1])
    else:
        c["endereco"] = endereco
    c["placa"] = _achar(r"PLACA\s+([A-Z0-9]{7})", t)
    c["veiculo"] = _espacos(_achar(r"MODELO\s*\n(.+?)\s+ANO\s", t))
    c["tipo_servico"] = _achar(r"\nSERVIÇO[ \t]+(.+)", t)
    tecnico = _achar(r"TÉCNICO RESP\.\s+(.+?)\s+AGENDAMENTO", t)
    if tecnico and "ATRIBU" not in tecnico.upper():
        c["tecnico"] = tecnico
    agendamento = _achar(r"AGENDAMENTO\s+(.+)", t)
    data = _achar(r"(\d{2}/\d{2}/\d{4})", agendamento)
    if data:
        c["data"] = data
        c["periodo"] = normalizar_periodo(_achar(r"\d{4}\s*-?\s*(\w+)", agendamento))
    bloco = _achar(r"OBSERVAÇÕES GERAIS\s*\n(.*)", t, flags=re.S)
    linhas = [
        linha for linha in bloco.splitlines()
        if linha.strip() and not set(linha.strip()) <= {"-"}
        and "sem observações adicionais" not in linha.lower()
        and not linha.strip().upper().startswith("STATUS:")
    ]
    c["observacoes"] = "\n".join(_espacos(linha) for linha in linhas)
    return c


MODELOS_CONHECIDOS = [
    # (nome, como reconhecer pelo texto, função de leitura)
    ("SAT Company", lambda t: "SAT COMPANY" in t.upper() and "Nome/Razão Social" in t, ler_sat_company),
    ("CEABS", lambda t: "CEABS" in t.upper() and "Proprietário:" in t, ler_ceabs),
    # A OS da Zen não traz o nome da empresa em texto, só no logo.
    ("Zen Seguros", lambda t: "DADOS DO ASSOCIADO" in t and "TÉCNICO RESP." in t, ler_zen_seguros),
]


def ler_modelo_conhecido(texto):
    for _nome, reconhece, ler in MODELOS_CONHECIDOS:
        if reconhece(texto):
            campos = ler(texto)
            # Só aceita se achou o básico; senão deixa a IA tentar.
            if campos["cliente_nome"] and (campos["endereco"] or campos["placa"]):
                return campos
    return None


# ----------------------------------------------------------------------
# IA (Claude) para modelos desconhecidos e fotos
# ----------------------------------------------------------------------

URL_API = "https://api.anthropic.com/v1/messages"
MODELO_PADRAO = "claude-sonnet-5-5"

FERRAMENTA_OS = {
    "name": "registrar_os",
    "description": "Registra os dados extraídos de uma ordem de serviço de rastreador veicular.",
    "input_schema": {
        "type": "object",
        "properties": {
            "numero_os": {"type": "string", "description": "Número/protocolo da OS."},
            "tipo_servico": {"type": "string", "description": "Ex.: Instalação, Manutenção, Retirada."},
            "data": {"type": "string", "description": "Data agendada no formato dd/mm/aaaa, ou vazio se 'a combinar'."},
            "periodo": {"type": "string", "enum": ["Manhã", "Tarde", "Integral", ""]},
            "empresa": {"type": "string", "description": "Empresa de rastreamento/seguro que emitiu a OS (pode estar só no logo)."},
            "cliente_nome": {"type": "string", "description": "Pessoa ou empresa a ser atendida (proprietário/associado), não a seguradora."},
            "cliente_telefone": {"type": "string"},
            "outros_telefones": {"type": "array", "items": {"type": "string"}},
            "rua": {"type": "string"},
            "numero": {"type": "string"},
            "complemento": {"type": "string"},
            "bairro": {"type": "string"},
            "cidade": {"type": "string"},
            "uf": {"type": "string"},
            "cep": {"type": "string"},
            "placa": {"type": "string"},
            "veiculo": {"type": "string", "description": "Marca e modelo do veículo."},
            "tecnico": {"type": "string", "description": "Técnico indicado na OS, se houver."},
            "observacoes": {"type": "string", "description": "Instruções úteis para o técnico: motivo, equipamento pedido, prioridades, ponto de referência."},
        },
        "required": ["cliente_nome"],
    },
}

INSTRUCOES_IA = """Você recebe uma ordem de serviço (OS) de instalação/manutenção/retirada de rastreador veicular, \
emitida por uma empresa de rastreamento, seguradora ou associação de proteção veicular. \
Extraia os dados e chame a ferramenta registrar_os.

Regras:
- cliente_nome é quem será atendido (proprietário, associado ou segurado). Se a OS tiver um campo "Cliente" \
com uma seguradora/associação e outro com o proprietário, use o proprietário.
- empresa é quem emitiu a OS; se o nome só aparecer no logotipo, leia o logotipo. Empresas já cadastradas: {empresas}.
- tipo_servico: use um destes quando couber: {tipos}.
- data no formato dd/mm/aaaa e periodo Manhã/Tarde/Integral; se estiver "a combinar", deixe vazio.
- Não invente dados: campo que não aparece fica vazio. Não inclua CPF, RG ou números de documento.
- Corrija acentos quebrados quando a palavra for óbvia."""


def ia_configurada():
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def ler_com_ia(conteudo, tipo_mime, empresas=(), tipos=()):
    chave = os.environ.get("ANTHROPIC_API_KEY")
    if not chave:
        raise ErroLeituraOS(
            "Esse arquivo precisa da leitura por IA (é foto ou um modelo de OS que o app ainda não "
            "conhece), e a IA não está configurada: falta a variável ANTHROPIC_API_KEY no servidor."
        )
    dados_b64 = base64.standard_b64encode(conteudo).decode("ascii")
    if tipo_mime == "application/pdf":
        bloco_arquivo = {"type": "document", "source": {"type": "base64", "media_type": tipo_mime, "data": dados_b64}}
    else:
        bloco_arquivo = {"type": "image", "source": {"type": "base64", "media_type": tipo_mime, "data": dados_b64}}

    corpo = {
        "model": os.environ.get("ANTHROPIC_MODEL", MODELO_PADRAO),
        "max_tokens": 1500,
        "tools": [FERRAMENTA_OS],
        "tool_choice": {"type": "tool", "name": "registrar_os"},
        "messages": [{
            "role": "user",
            "content": [
                bloco_arquivo,
                {"type": "text", "text": INSTRUCOES_IA.format(
                    empresas=", ".join(empresas) or "(nenhuma)",
                    tipos=", ".join(tipos) or "Instalação, Manutenção, Retirada",
                )},
            ],
        }],
    }
    requisicao = urllib.request.Request(
        URL_API,
        data=json.dumps(corpo).encode("utf-8"),
        headers={
            "x-api-key": chave,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(requisicao, timeout=90) as resposta:
            retorno = json.loads(resposta.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detalhe = ""
        try:
            detalhe = json.loads(e.read().decode("utf-8")).get("error", {}).get("message", "")
        except Exception:
            pass
        if e.code == 401:
            raise ErroLeituraOS("A chave da IA (ANTHROPIC_API_KEY) é inválida.")
        print(f"Erro da API da IA ({e.code}): {detalhe}")
        raise ErroLeituraOS("A IA não conseguiu ler a OS agora. Tente de novo em instantes.")
    except Exception as e:
        print(f"Falha ao chamar a IA: {e}")
        raise ErroLeituraOS("Não consegui falar com a IA agora (sem conexão?). Tente de novo.")

    dados = next(
        (b.get("input", {}) for b in retorno.get("content", []) if b.get("type") == "tool_use"), None
    )
    if not dados:
        raise ErroLeituraOS("A IA não conseguiu identificar os dados dessa OS.")

    c = dict(CAMPOS_VAZIOS)
    for chave_campo in ("numero_os", "tipo_servico", "empresa", "cliente_nome", "placa", "veiculo", "tecnico"):
        c[chave_campo] = _espacos(str(dados.get(chave_campo) or ""))
    c["data"] = _achar(r"(\d{2}/\d{2}/\d{4})", str(dados.get("data") or ""))
    c["periodo"] = normalizar_periodo(dados.get("periodo"))
    c["cliente_telefone"] = formatar_telefone(dados.get("cliente_telefone"))
    c["cep"] = formatar_cep(dados.get("cep"))
    c["placa"] = re.sub(r"[^A-Z0-9]", "", c["placa"].upper())
    c["endereco"] = montar_endereco(
        dados.get("rua"), dados.get("numero"), dados.get("bairro"), dados.get("cidade"), dados.get("uf"))
    outros = [formatar_telefone(x) for x in (dados.get("outros_telefones") or [])]
    outros = [x for x in outros if x and x != c["cliente_telefone"]]
    complemento = _espacos(dados.get("complemento"))
    c["observacoes"] = _juntar_observacoes([
        _espacos(dados.get("observacoes")),
        f"Complemento: {complemento}" if complemento else "",
        f"Outros telefones: {', '.join(outros)}" if outros else "",
    ])
    return c


# ----------------------------------------------------------------------
# Entrada principal
# ----------------------------------------------------------------------

TIPOS_IMAGEM = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",
    b"GIF8": "image/gif",
}


def identificar_tipo(conteudo):
    if conteudo[:5] == b"%PDF-" or b"%PDF-" in conteudo[:1024]:
        return "application/pdf"
    for assinatura, mime in TIPOS_IMAGEM.items():
        if conteudo.startswith(assinatura):
            if mime == "image/webp" and conteudo[8:12] != b"WEBP":
                continue
            return mime
    return None


def ler_os(conteudo, empresas=(), tipos=()):
    """Devolve (campos, origem). origem = 'leitor' (modelo conhecido) ou 'ia'."""
    tipo_mime = identificar_tipo(conteudo)
    if not tipo_mime:
        raise ErroLeituraOS("Envie a OS em PDF ou foto (JPG/PNG).")

    if tipo_mime == "application/pdf":
        texto = extrair_texto_pdf(conteudo)
        campos = ler_modelo_conhecido(texto)
        if campos:
            return campos, "leitor"

    return ler_com_ia(conteudo, tipo_mime, empresas, tipos), "ia"
