# PVP GRUPO APANE

Jogo de luta arcade multiplayer 1x1, em português, com pixel art original e arena de datacenter. Escolha **Emerzon (TI N2)**, **Douglas (Gerente de TI)**, **José (Analista de TI)** ou **Kauã (Aux. Procesos e automatización)**. Cada personagem tem atributos e um golpe especial próprios.

Os visuais dos quatro personagens foram adaptados em pixel art a partir das fotos de referência fornecidas. A seleção e a arena usam a mesma arte, distribuída com o jogo em `public/assets/`. Douglas usa uma arte própria sem camisa e com o corpo mais gordo. As imagens são carregadas localmente, sem serviços de geração ou outras chamadas externas durante as partidas.

## Executar

Requer Node.js 22 ou superior e npm. No diretório do repositório:

```sh
npm ci
npm start
```

O servidor HTTP e WebSocket escuta na porta `3000`, em `0.0.0.0`. `PORT` e `HOST` são opcionais. Para desenvolvimento com reinício automático do servidor: `npm run dev`. As alterações do frontend aparecem ao atualizar o navegador.

## Jogar

**Online:** escolha seu personagem, clique em **Criar sala** e compartilhe o código de seis caracteres. O segundo jogador acessa a mesma instância do jogo, escolhe seu personagem e usa **Entrar com código**. A partida começa automaticamente após três segundos. Cada jogador usa os controles P1 em seu computador ou os botões de toque no celular. A revanche começa quando os dois aceitarem.

**Local:** clique em **Jogar local**, escolha o personagem P2 e use o mesmo teclado para os dois jogadores.

| Ação | P1 / jogador online | P2 local |
| --- | --- | --- |
| Mover | A / D | ← / → |
| Pular | W | ↑ |
| Soco | F | K |
| Especial | G | L |
| Defender | S | ↓ |

O round dura 60 segundos. Vence quem zerar a vida adversária ou tiver mais vida ao final do tempo. O especial gasta 50 de energia, que se regenera. Golpes exigem proximidade; defender reduz o dano recebido. Efeitos sonoros podem ser ativados no cabeçalho.

## Verificar

```sh
npm run check
npm test
```

Os testes exercitam o motor de combate e duas conexões WebSocket reais, incluindo salas, ataques, revanche, desconexão e validação de mensagens. `GET /api/health` fornece a verificação de prontidão.

## Hospedagem

Para jogar em computadores diferentes, hospede este servidor Node em um endereço acessível aos dois. O proxy de hospedagem deve encaminhar HTTP e upgrades WebSocket em `/ws`. O cliente escolhe `ws` ou `wss` automaticamente conforme o protocolo da página. Uma hospedagem exclusivamente estática não oferece o multiplayer online.

Não são necessárias credenciais, serviços externos ou variáveis obrigatórias. Salas e partidas ficam em memória: reiniciar o servidor encerra as salas. A versão atual usa uma instância de servidor; múltiplas réplicas exigiriam coordenação de salas. Não há persistência de placares nem contas.

## Estrutura

- `server.js`: HTTP, salas, validação das mensagens e simulação online autoritativa.
- `public/engine.js`: regras compartilhadas entre servidor e modo local.
- `public/art.js`: personagens originais e cenário desenhados em SVG/Canvas.
- `public/assets/`: arte dos quatro lutadores, compartilhada pela seleção e pelo combate.
- `public/app.js`: seleção, salas, controles, áudio e interface da partida.
- `public/style.css`: interface responsiva, temas dos personagens e controles de toque.
- `tests/`: testes do motor e da integração HTTP/WebSocket.

A fonte Barlow Condensed é distribuída localmente sob SIL Open Font License, em `public/fonts/OFL-Barlow.txt`.

Repositório originalmente criado para o curso de Git e GitHub do Gustavo Guanabara.
