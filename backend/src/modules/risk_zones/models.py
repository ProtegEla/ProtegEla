"""
Modelos ORM de banco de dados para zonas de risco espaciais (SQLAlchemy com PostGIS).

Responsabilidades futuras (a serem mapeadas pelo responsável do módulo):
- Tabela risk_zones (geometria poligonal PostGIS, pontuação calculada, nível de severidade).
- Tabela ssp_safety_records (histórico criminal de base pública).
"""
from src.core.database import Base
