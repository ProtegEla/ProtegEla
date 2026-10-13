# Diretrizes de Segurança, Privacidade e LGPD

O **ProtegEla** lida diretamente com a segurança física e dados pessoais sensíveis de mulheres. Por essa razão, a proteção dos dados não é apenas um requisito técnico, mas um compromisso ético e legal.

Este documento consolida os princípios e regras mandatórias de segurança e privacidade do projeto.

---

## 1. Princípios Gerais e Legislação (LGPD)

O sistema segue os princípios da **Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD)**:
- **Minimização de Dados**: Coletar apenas o estritamente indispensável para o funcionamento da plataforma.
- **Finalidade e Transparência**: A usuária deve saber exatamente como sua informação é processada.
- **Direito à Exclusão**: A usuária pode solicitar a qualquer momento a exclusão completa e irrecuperável de sua conta e dados pessoais.

---

## 2. Proteção de Senhas e Credenciais (RN08 / RNF06)

1. **Armazenamento de Senha**:
   - É **terminantemente proibido** armazenar senhas em texto puro ou com algoritmos de hash obsoletos (ex: MD5, SHA-1, SHA-256 simples).
   - O sistema utiliza **Argon2id** (ou alternativamente **bcrypt** com fator de trabalho adequado) acrescido de sal único gerado aleatoriamente por registro.
2. **Requisitos de Complexidade de Senha (RN08)**:
   - Mínimo de 8 caracteres.
   - Pelo menos uma letra maiúscula.
   - Pelo menos uma letra minúscula.
   - Pelo menos um dígito numérico.
   - Pelo menos um caractere especial (`!@#$%^&*()_+-=[]{}|;:,.<>?`).

---

## 3. Criptografia em Repouso de Dados Pessoais Sensíveis (RNF06)

Para proteger a integridade de usuárias e seus contatos de confiança mesmo em um cenário improvável de vazamento da base de dados:
- Dados como **e-mail da usuária** e **números de telefone dos contatos de emergência** devem ser cifrados em repouso na camada de banco de dados (`cryptography.fernet` ou algoritmo AES-256-GCM com chave simétrica gerenciada em variável de ambiente `FIELD_ENCRYPTION_KEY`).
- Chaves criptográficas **jamais** devem ser incluídas no código-fonte ou versionadas no Git.

---

## 4. Minimização e Não Retenção de Geolocalização (RNF07)

1. **Localização em Tempo Real**:
   - As coordenadas GPS enviadas para o cálculo de rotas e consulta de delegacias próximas são processadas **estritamente em memória** durante a requisição.
   - **O servidor não armazena histórico contínuo de rastreamento de deslocamento das usuárias**.
2. **Relatos Colaborativos (RF09)**:
   - As coordenadas associadas a um relato de perigo referem-se ao local do incidente, e a usuária pode optar expressamente pelo anonimato no registro.
   - O identificador de dispositivo (`X-Device-Id`) é usado apenas para rate-limit e controle de abuso (RN06), sem associação de histórico de deslocamento.

---

## 5. Rate Limiting e Proteção Contra Abuso (RN06)

Para evitar ataques de força bruta e poluição maliciosa do mapa:
- **Autenticação**: Limite estrito de 5 tentativas consecutivas de login por IP/dispositivo em janela de 10 minutos antes de bloqueio temporário.
- **Criação de Relatos**: Rate limiting por minuto por dispositivo para mitigar injeção em massa de falsos incidentes.
- **Ocultação Automática de Relatos**: Se um relato atingir denúncias de falso/impróprio superiores a 30% de suas confirmações, ele é automaticamente omitido da visualização e excluído do motor de rotas até auditoria.

---

## 6. Comunicação em Rede (RNF05)

- Em produção, toda comunicação cliente-servidor deve ocorrer obrigatoriamente sob **HTTPS (TLS 1.3/1.2)** com certificados válidos e cabeçalhos de segurança (*Strict-Transport-Security*, *X-Content-Type-Options*, *X-Frame-Options*).
- O tráfego HTTP em texto puro é expressamente rejeitado em produção.

---

## 7. Sanitização de Logs e Observabilidade

- Os middlewares de log e rastreamento são instruídos a **mascarar** cabeçalhos sensíveis (`Authorization`, `Cookie`) e campos de payload como `password`, `email`, `phone_number`, `token` e coordenadas brutas.
- Nenhum dado pessoal identificável (PII) deve constar em arquivos de log ou serviços de monitoramento externos.
