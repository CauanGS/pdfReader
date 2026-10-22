# Leitor de PDF

Leitor de PDF desktop local-first, feito com Electron + React + PDF.js. Funciona offline para a maior parte das features: biblioteca local, modo escuro, retomada de leitura, marcadores ancorados em palavras e tradução de palavras com popover e sidebar.

## Funcionalidades

- **Biblioteca local** — importe PDFs (com dedupe por SHA-256); tudo fica no seu computador, nada é enviado para a nuvem.
- **Retomada de leitura** — página e offset de scroll são salvos automaticamente; ao reabrir, você volta exatamente de onde parou.
- **Marcadores ancorados em palavras** — marcadores apontam para a palavra específica onde foram criados, não só para a página; sobrevivem a mudanças de scroll e zoom.
- **Tradução com popover** — selecione uma palavra com o modo Tradução ativo e veja a tradução num popover (offline, sem chaves); salve traduções na sidebar para revisitar depois.
  - **Dicionário local EN→PT** — base WikDict em SQLite, com camada de morfologia (irregulares e plurais); cobre palavras únicas apenas.
- **Modo escuro** — dois presets (`Suave` e `Alto contraste`) com inversão de página.
- **Cores personalizadas** — com o modo escuro desligado, defina a **cor da fonte** e a **cor de fundo da página** nas Configurações; a lógica de render usa `mix-blend-mode` para recolorizar preservando conteúdo.
- **Zoom** — 50% a 300%, via botões da barra ou `Ctrl + scroll` (para frente aumenta, para trás diminui).
- **Tela cheia do texto** — botão `⛶` esconde toolbar e painéis; funciona mesmo com o modo Tradução ativo (popover segue disponível). Sai com `Esc` ou no botão flutuante.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Shell | Electron 44 |
| UI | React 19 + Vite (electron-vite) |
| Linguagem | TypeScript |
| Render de PDF | PDF.js (`pdfjs-dist`) |
| Persistência | SQLite (`node:sqlite` — `DatabaseSync`) |
| Dicionário           | [WikDict EN→PT](https://wikdict.com/) (SQLite, CC BY-SA 4.0) |

## Estrutura

```
src/
├── main/          # Processo principal (Electron): janela, IPC, protocolo pdfreader://
│   ├── db.ts            # Schema SQLite
│   ├── library.ts       # Import/CRUD de documentos, leitura, marcadores, traduções
│   ├── settings.ts      # Configurações persistidas + safeStorage para a chave Google
│   ├── translation.ts   # Provider Google + fallback local + cache
│   └── dictionary.ts    # WikDict SQLite + morfologia
├── preload/       # Bridge contextBridge (window.pdfReader)
├── renderer/      # UI React (viewport de leitura, biblioteca, painéis)
└── shared/        # Tipos e mapa de canais IPC compartilhados
```

## Rodando em dev

```bash
npm install
npm run dev
```

## Build e empacotamento

```bash
npm run build       # gera out/ (main, preload, renderer)
npm run package:win # electron-builder -> release/ (exe portátil Windows)
```

## Configurações

- **Idioma de destino** — default `pt-BR`
- **Modo escuro** — checkbox + preset (`Suave` / `Alto contraste`)
- **Cor da fonte / Cor de fundo** — apenas com o modo escuro desligado (escolher uma cor desliga o modo escuro automaticamente); desmarcar restaura a cor original do PDF

Dados persistidos em `%APPDATA%\pdf-reader\` (Windows) ou `~/.config/pdf-reader/` (Linux): banco SQLite + PDFs importados.

## Relação entre modos de exibição

| Modo | Tratamento de cores |
| --- | --- |
| Claro (padrão) | Original do PDF |
| Modo escuro | Invert canvas + `hue-rotate(180deg)` (presets soft/contrast) |
| Claro + cores customizadas | `multiply` no canvas (fundo) + overlay `lighten` (texto) |

## Licenças

- Código do projeto — licença a definir (ninguém anunciou distribuição ainda).
- Dicionário WikDict EN→PT — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), © WikDict (Knut A. Syed).
