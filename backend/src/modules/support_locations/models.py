"""
Modelos ORM de banco de dados para locais de apoio e delegacias (SQLAlchemy com PostGIS).

Responsabilidades futuras (a serem mapeadas pelo responsável do módulo):
- Tabela support_locations (nome, tipo, ponto geométrico PostGIS, endereço).
"""
from src.core.database import Base
