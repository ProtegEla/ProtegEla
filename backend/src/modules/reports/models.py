"""
Modelos ORM de banco de dados para relatos de incidentes (SQLAlchemy).

Responsabilidades futuras (a serem mapeadas pelo responsável do módulo):
- Tabela reports (categoria, descrição, ponto geométrico PostGIS, autor_id opcional).
- Tabela report_confirmations (confirmações por usuárias distintas).
- Tabela report_abuses (denúncias de falso/impróprio).
"""
from src.core.database import Base
