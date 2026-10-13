# ProtegEla — App Mobile

> Aplicativo React Native (Expo SDK 51) com suporte a Web, Android e iOS.

---

## Pré-requisitos

| Ferramenta | Versão mínima | Obrigatório para |
|---|---|---|
| Node.js | 18 LTS | Sempre |
| npm | 9+ | Sempre |
| Expo Go (app) | Última versão | Testar em dispositivo físico |
| Android Studio / SDK | Qualquer | Somente emulador Android |

---

## 1. Instalação de dependências

Execute **uma única vez** após clonar o repositório ou sincronizar o `package.json`:

```bash
# A partir da raiz do monorepo:
cd apps/mobile
npm install
```

---

## 2. Executar no navegador (recomendado para desenvolvimento)

Não requer Android Studio, iOS Simulator nem dispositivo físico.

```bash
# A partir de apps/mobile:
npm run dev
```

O Metro Bundler inicia e abre automaticamente `http://localhost:8081` no navegador padrão.

> **Equivalente a:** `expo start --web`

---

## 3. Executar no Expo Go (dispositivo físico)

```bash
# A partir de apps/mobile:
npm start
```

Escaneie o QR Code com o app **Expo Go** (Android ou iOS).

---

## 4. Executar no emulador Android

> Requer Android Studio com um AVD configurado e em execução.

```bash
# A partir de apps/mobile:
npm run android
```

---

## 5. Resumo dos scripts disponíveis

| Script | Comando | Descrição |
|---|---|---|
| `npm run dev` | `expo start --web` | Abre no navegador — **ponto de entrada recomendado** |
| `npm start` | `expo start` | Menu interativo (Web / Expo Go / Android / iOS) |
| `npm run web` | `expo start --web` | Idêntico a `dev`, mantido por compatibilidade |
| `npm run android` | `expo start --android` | Emulador Android (requer Android Studio) |
| `npm run ios` | `expo start --ios` | Simulador iOS (requer macOS + Xcode) |
| `npm test` | `jest` | Executa os testes automatizados |
| `npm run lint` | `eslint ...` | Verifica estilo de código |

---

## 6. Dependências web instaladas (Expo SDK 51)

As seguintes dependências foram adicionadas com `npx expo install` para habilitar a plataforma web:

| Pacote | Versão | Função |
|---|---|---|
| `react-dom` | `18.2.0` | Renderização DOM para React na web |
| `react-native-web` | `~0.19.10` | Polyfill de componentes RN para web |
| `@expo/metro-runtime` | `~3.2.3` | Runtime do Metro Bundler para web |

> As versões foram fixadas pelo `npx expo install` para garantir compatibilidade com o SDK atual.
> **Não atualize manualmente** sem usar `npx expo install <pacote>`.

---

