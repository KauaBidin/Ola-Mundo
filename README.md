# PVP GRUPO APANE

Jogo de luta arcade multiplayer 1x1, em português, com pixel art original e arena de datacenter. Escolha **Emerzon (TI N2)**, **Douglas (Gerente de TI)**, **José (Analista de TI)** ou **Kauã (Aux. Procesos e automatización)**. Cada personagem tem atributos e um golpe especial próprios.

Os visuais dos quatro personagens foram adaptados em pixel art a partir das fotos de referência fornecidas. A seleção e a arena usam a mesma arte, distribuída com o jogo em `public/assets/`: Emerzon veste a camisa do Corinthians; Douglas aparece sem camisa, com o corpo mais gordo e um revólver .38 na mão; José toma café em uma xícara; Kauã veste a camisa do São Paulo. Esses itens fazem parte do visual dos personagens. As imagens são carregadas localmente, sem serviços de geração ou outras chamadas externas durante as partidas.

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
| Arrancada (dash) | Shift esquerdo | Shift direito |

A partida dura **2min30s completos de combate**, além da contagem inicial. Cada nocaute vale um ponto; o lutador retorna após 2 segundos com vida cheia e breve proteção. Vence quem tiver mais nocautes quando o tempo acabar. A vida restante desempata; com os dois critérios iguais, há empate. Um nocaute não encerra a partida antes do tempo.

A movimentação tem aceleração, desaceleração, controle aéreo e salto com tolerância ao apertar perto da aterrissagem. Use **Shift** com uma direção para uma arrancada curta; a recarga é de 0,9 segundo. No celular, há um botão **DASH**.

Os **socos movimentam os braços e as mãos**, com preparação, extensão e recolhimento em 0,24 segundo. O impacto acontece após 0,08 segundo, quando a mão estende, e cada soco causa dano uma única vez. Ser atingido antes desse contato interrompe o soco.

Os lutadores mostram **ferimentos progressivos**: arranhões abaixo de 76 HP, hematomas e mais marcas abaixo de 46 HP, e pequenos cortes com sangue abaixo de 21 HP. Recuperar vida reduz as marcas; retornar de um nocaute com 100 HP restaura a aparência. A arena é um **datacenter escuro**, com racks, switches, patch panels, cabos, UPS, terminais e telas de monitoramento com visual de hacking e LEDs animados.

O especial é uma **voadora**: gasta 50 de energia, salta e avança na direção do rival durante 0,5 segundo. O alcance de contato subiu de 195 para 250 unidades, além do avanço, e a voadora pode conectar durante o trajeto, uma vez por ativação. Ela derruba o adversário, que fica protegido durante a queda e depois se levanta. Defesa ou escudo reduzem o dano e evitam essa queda.

**Todo golpe que causa dano solta sangue em pixel art**, incluindo o dano reduzido de um golpe defendido. A voadora produz quatro vezes mais partículas que um golpe comum. As manchas permanecem no ringue durante toda a partida, inclusive após nocautes; só são limpas ao iniciar outra partida ou revanche. O som pode ser ativado no cabeçalho.

### Itens que caem na arena

O primeiro item cai após 4 segundos de combate; os próximos chegam em intervalos aleatórios de 8 a 12 segundos. Passe perto de um item para coletá-lo, inclusive no ar. Itens no chão desaparecem após 14 segundos. Os bônus aparecem junto à barra de vida.

| Item | Efeito |
| --- | --- |
| Vida extra | Recupera 30 HP, até 100. |
| Turbo | Movimento 45% mais rápido por 8 segundos. |
| Escudo | Reduz dano e impede derrubadas por 8 segundos. |
| Carga extra | Recupera 60 de energia, até 100. |
| Fúria | Golpes 35% mais fortes por 8 segundos. |
| Superpulo | Impulso do salto 25% maior por 8 segundos. |

Coletar o mesmo bônus renova sua duração. Ele não acumula multiplicadores; um nocaute remove os bônus ativos. Os itens e efeitos são decididos pelo servidor no modo online.

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
- `public/injuries.js`: ferimentos visuais conforme a vida atual do lutador.
- `public/assets/`: arte dos quatro lutadores, compartilhada pela seleção e pelo combate.
- `public/app.js`: seleção, salas, controles, áudio e interface da partida.
- `public/style.css`: interface responsiva, temas dos personagens e controles de toque.
- `tests/`: testes do motor e da integração HTTP/WebSocket.

A fonte Barlow Condensed é distribuída localmente sob SIL Open Font License, em `public/fonts/OFL-Barlow.txt`.

Repositório originalmente criado para o curso de Git e GitHub do Gustavo Guanabara.
