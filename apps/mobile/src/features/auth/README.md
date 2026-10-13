# Feature: Auth (Mobile)

## Responsabilidade
Contém as telas e componentes visuais de:
- Formulário de cadastro de conta com validação de senha forte (RN08).
- Formulário de login com exibição amigável de erro de credenciais inválidas.
- Recuperação de senha por e-mail.

## Regras
- Nunca realize chamadas Axios diretamente nas telas; utilize `src/services/api/client.ts`.
- Armazene tokens obtidos através de `src/storage/secureStore.ts`.
