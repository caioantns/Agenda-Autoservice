"""Migra os dados do planilha_dados.csv (app desktop) para o banco de dados
da versão web (servicos.db).

Uso:
    1. Copie o arquivo planilha_dados.csv do app desktop para esta pasta.
    2. Rode: python migrar_csv.py
"""

import csv
import sys
from pathlib import Path

from app import app
from models import db, Servico, ListaValor

ARQUIVO_CSV = Path(__file__).parent / "planilha_dados.csv"


def main():
    if not ARQUIVO_CSV.exists():
        print(f"Não encontrei {ARQUIVO_CSV}. Copie o CSV do app desktop para esta pasta antes de rodar.")
        sys.exit(1)

    with open(ARQUIVO_CSV, "r", newline="", encoding="utf-8") as f:
        linhas = list(csv.DictReader(f))

    importados = 0
    with app.app_context():
        db.create_all()
        for linha in linhas:
            try:
                valor = float(linha.get("Valor", "0") or 0)
            except ValueError:
                valor = 0.0

            servico = Servico(
                data=linha.get("Data", "").strip(),
                horario=linha.get("Horário", "").strip(),
                placa=linha.get("Placa", "").strip().upper(),
                tipo_servico=linha.get("Tipo de Serviço", "").strip(),
                empresa=linha.get("Empresa", "").strip(),
                endereco=linha.get("Endereço", "").strip(),
                tecnico=linha.get("Técnico", "").strip(),
                status=linha.get("Status", "Agendado").strip() or "Agendado",
                valor=valor,
                observacoes=linha.get("Observações", "").strip(),
            )
            db.session.add(servico)
            importados += 1

            for categoria, campo in [("empresa", servico.empresa), ("tipo_servico", servico.tipo_servico),
                                      ("tecnico", servico.tecnico)]:
                if campo and not ListaValor.query.filter_by(categoria=categoria, valor=campo).first():
                    db.session.add(ListaValor(categoria=categoria, valor=campo))

        db.session.commit()

    print(f"Importados {importados} serviço(s) com sucesso para servicos.db")


if __name__ == "__main__":
    main()
