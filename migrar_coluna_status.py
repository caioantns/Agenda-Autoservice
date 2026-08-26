"""
Migração pontual: adiciona a coluna `status` na tabela `equipamentos`,
sem apagar nenhum dado existente.

Como rodar (dentro da pasta "servicos_web 3.0", com o venv/ambiente ativado):

    python migrar_coluna_status.py

Depois disso, pode rodar o `python app.py` normalmente.
"""

from sqlalchemy import text

# Reaproveita a MESMA configuração de banco que o app.py já usa,
# então não precisamos saber o caminho exato do arquivo .db.
from app import app
from models import db

with app.app_context():
    colunas = db.session.execute(text("PRAGMA table_info(equipamentos)")).fetchall()
    nomes_colunas = [c[1] for c in colunas]

    if "status" in nomes_colunas:
        print("A coluna 'status' já existe em 'equipamentos'. Nada a fazer.")
    else:
        print("Adicionando a coluna 'status' em 'equipamentos'...")
        db.session.execute(
            text("ALTER TABLE equipamentos ADD COLUMN status VARCHAR(20) DEFAULT 'Disponível'")
        )
        # Garante que os equipamentos que já existiam (cadastrados antes dessa
        # coluna existir) fiquem com um valor válido em vez de NULL.
        db.session.execute(
            text("UPDATE equipamentos SET status = 'Disponível' WHERE status IS NULL")
        )
        db.session.commit()
        print("Coluna adicionada com sucesso. Dados existentes preservados.")
