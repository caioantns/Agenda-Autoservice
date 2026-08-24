"""Modelos de dados do Agenda Autoservice (versão web)."""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

STATUS_OPCOES = ["Agendado", "Em andamento", "Feito", "Frustrado", "Cancelado"]
HORARIOS_OPCOES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
PERIODO_OPCOES = ["Manhã", "Integral", "Tarde"]

class Usuario(db.Model):
    __tablename__ = "usuarios"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(80), nullable=False)
    usuario = db.Column(db.String(50), unique=True, nullable=False)
    senha_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="tecnico")  # "admin" ou "tecnico"
    tecnico_nome = db.Column(db.String(80), default="")  # só usado quando role == "tecnico"
    ativo = db.Column(db.Boolean, default=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "usuario": self.usuario,
            "role": self.role,
            "tecnico_nome": self.tecnico_nome or "",
            "ativo": bool(self.ativo),
        }


class Servico(db.Model):
    __tablename__ = "servicos"

    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.String(10), nullable=False)  # dd/mm/aaaa
    horario = db.Column(db.String(5), default="")     # HH:MM (mantido por compatibilidade)
    periodo = db.Column(db.String(20), default="")     # Manhã / Integral / Tarde
    placa = db.Column(db.String(10), default="")
    tipo_servico = db.Column(db.String(80), nullable=False)
    empresa = db.Column(db.String(120), nullable=False)
    endereco = db.Column(db.String(200), default="")
    tecnico = db.Column(db.String(80), default="")
    status = db.Column(db.String(20), default="Agendado")
    valor = db.Column(db.Float, default=0.0)
    observacoes = db.Column(db.Text, default="")
    equipamento_retirado_codigo = db.Column(db.String(80), default="")
    equipamento_instalado_codigo = db.Column(db.String(80), default="")
    houve_troca_equipamento = db.Column(db.Boolean, default=None, nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    atualizado_em = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "data": self.data,
            "horario": self.horario or "",
            "periodo": self.periodo or "",
            "placa": self.placa,
            "tipo_servico": self.tipo_servico,
            "empresa": self.empresa,
            "endereco": self.endereco or "",
            "tecnico": self.tecnico or "",
            "status": self.status,
            "valor": self.valor or 0.0,
            "observacoes": self.observacoes or "",
            "equipamento_retirado_codigo": self.equipamento_retirado_codigo or "",
            "equipamento_instalado_codigo": self.equipamento_instalado_codigo or "",
            "houve_troca_equipamento": self.houve_troca_equipamento,
        }


STATUS_ESTOQUE_OPCOES = ["Disponível", "Utilizado", "Indisponível"]


class Equipamento(db.Model):
    __tablename__ = "equipamentos"

    id = db.Column(db.Integer, primary_key=True)
    empresa = db.Column(db.String(120), nullable=False)
    modelo = db.Column(db.String(120), default="")
    codigo = db.Column(db.String(80), nullable=False)  # ID/número de série/patrimônio do equipamento
    status = db.Column(db.String(20), default="Disponível")
    atualizado_em = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "empresa": self.empresa,
            "modelo": self.modelo or "",
            "codigo": self.codigo,
            "status": self.status or "Disponível",
        }


class ListaValor(db.Model):
    """Guarda as opções pré-definidas: empresas, tipos de serviço, técnicos."""
    __tablename__ = "listas_valores"

    id = db.Column(db.Integer, primary_key=True)
    categoria = db.Column(db.String(20), nullable=False)  # 'empresa', 'tipo_servico', 'tecnico'
    valor = db.Column(db.String(120), nullable=False)

    __table_args__ = (db.UniqueConstraint("categoria", "valor", name="uq_categoria_valor"),)
