# Pacote atualizado — 11 lutadores

Base: versão do GitHub `c8289de5c1874fe8f41b5a74d72eee6d2255471f`, que já contém seus arquivos personalizados e os ajustes de tela.

## Novidades

- Lula, Bolsonaro, Nikolas Ferreira, Dilma, Flávio Bolsonaro, Kid Bengala e Tun Tum Sarhur, com pixel art própria, retrato e animações na arena.
- Busca por nome sem diferenciar maiúsculas ou acentos. Também aceita aliases como Jair Bolsonaro e Tung Tung Sahur.
- Setas laterais e páginas na seleção de P1 e P2. Navegar ou buscar não troca o personagem escolhido.
- Partida ocupa a janela disponível, sem rolagem; o desenho da arena mantém sua proporção. Redimensionar a janela não reinicia a luta.

Os quatro lutadores originais, imagens, regras, voadora, socos animados, ferimentos, manchas persistentes, itens, controles e modos local/online continuam presentes. O tema original permanece em `public/style.css`; as adições estão em `public/selection.css`.

## Executar

1. Extraia o ZIP inteiro em uma pasta.
2. Na pasta `Ola-Mundo`, execute `npm ci` e `npm start` (Node.js 22 ou superior).
3. Abra `http://localhost:3000`. Em uma instalação já aberta, atualize com Ctrl + F5.

Este é o pacote completo atualizado. O arquivo `ajuste-tela.zip` e o documento `AJUSTE-DE-TELA.md`, mantidos por histórico, pertencem à atualização anterior; não reaplique esse patch sobre esta versão.

Se você fez novas mudanças apenas no computador depois da versão-base citada, mantenha uma cópia dessa pasta antes de comparar os arquivos.

## Verificação deste pacote

- `npm test`: 45 testes passaram, incluindo combate dos sete convidados, arte própria, conexão online e revanche.
- `npm run check`, sintaxe de `viewport.js` e `git diff --check`: passaram.
- Chromium: busca com/sem acento, aliases, busca vazia, setas P1/P2, retenção da escolha, partida local e conexão entre dois navegadores sem erros de JavaScript.
- Partida verificada sem rolagem em 1440×900, 1920×1080, 1366×768, 390×844, 844×390, 360×640, 640×360 e 320×568.

## Adição: finalização implementada dentro do jogo

A cena descrita foi implementada em Canvas, não como imagem estática. Um especial letal sem defesa ativa automaticamente uma sequência de 1,45 s com agarrão, impacto em silhuetas, partículas vermelhas abstratas e pose de vitória. Ela usa os visuais dos 11 personagens. O placar, relógio, respawn, seleção e modos existentes são mantidos.

`public/finisher.js` cuida do desenho da sequência; `public/engine.js` envia o evento e os snapshots sincronizados, e `public/app.js` controla a apresentação. Não depende de serviços externos nem de arquivos de imagem gerados.

Verificação da finalização: 45 testes Node passaram; testes em Chromium confirmaram acionamento por especial real nos dois clientes online, modo local, movimento reduzido, retorno ao combate, +1 KO uma única vez, respawn normal, resultado após a cena quando o tempo acaba e limpeza na revanche. Os 11 personagens foram desenhados em cinco momentos da cena, com e sem movimento reduzido, sem mutar o estado do jogo.

## Versão com silhuetas e pose de vitória

A sequência substitui o feixe mágico anterior por aproximação e agarrão com duas mãos, corte para silhuetas durante o impacto e pose de vitória. Os personagens permanecem inteiros. As partículas vermelhas são formas abstratas em pixel art. O impacto sonoro é sintético, toca uma única vez por cena e respeita o mudo. Duração, controles, sincronização, placar e renascimento são mantidos.

Verificação desta versão: 45 testes passaram. Chromium validou áudio uma vez por impacto, mudo, reprodução nos dois clientes online, modo local, retorno ao combate, respawn, fim do relógio e revanche. As três poses e os 11 lutadores foram conferidos com desenho determinístico e movimento reduzido.
