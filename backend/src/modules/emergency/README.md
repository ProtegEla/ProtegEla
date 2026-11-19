# Módulo: Emergency (Botão de Pânico e Telefones Úteis)

## 1. Escopo e Requisitos Associados
- **RF10**: Consulta de telefones de emergência públicos (Disque 180, 190 Polícia Militar, etc.) e contatos cadastrados.
- **RF14**: Botão de pânico visível em todas as telas com ligação prioritária e WhatsApp de socorro.
- **RNF09**: Requisito de performance estrito: disparar o processo sem travar o dispositivo.

## 2. Estrutura Direta de Arquivos
- `router.py`: Rotas `/api/v1/emergency/*` e esquemas de dados.
- `service.py`: Casos de uso de acionamento de emergência e provedor de números de apoio.
- `models.py`: Modelos SQLAlchemy para telefones úteis e logs de acionamento.
