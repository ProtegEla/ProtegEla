"""
Modelos ORM de banco de dados para usuárias e contatos de emergência (SQLAlchemy).

Responsabilidades futuras (a serem mapeadas pelo responsável do módulo):
- Tabela users (username, e-mail criptografado, password_hash, preferences).
- Tabela emergency_contacts (telefone criptografado, flag is_primary).
"""
from src.core.database import Base
