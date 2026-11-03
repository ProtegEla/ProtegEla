"""
Serviço de regras de negócio do módulo Emergency.

Responsabilidades futuras (a serem implementadas pelo responsável do módulo):
- Consulta de lista de telefones de utilidade pública (RF10).
- Registro e auditoria de acionamento do botão de pânico (RF14).
"""

def list_useful_numbers() -> list[dict[str, str]]:
    """Retorna os números públicos de segurança e emergência."""

    return [
        {
            "name": "Central de Atendimento à Mulher",
            "phone": "180",
            "description": "Orientação e denúncias de violência contra a mulher.",
        },
        {
            "name": "Polícia Militar",
            "phone": "190",
            "description": "Atendimento policial em situações de perigo imediato.",
        },
        {
            "name": "SAMU",
            "phone": "192",
            "description": "Atendimento médico de urgência e emergência.",
        },
        {
            "name": "Corpo de Bombeiros",
            "phone": "193",
            "description": "Atendimento a incêndios, acidentes e resgates.",
        },
        {
            "name": "Disque Direitos Humanos",
            "phone": "100",
            "description": "Orientação e denúncias de violações de direitos humanos.",
        },
    ]
