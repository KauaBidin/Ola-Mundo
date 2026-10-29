# PVP GRUPO APANE

Jogo de luta arcade multiplayer 1x1, em português, com pixel art original e arena de datacenter. Escolha **Emerzon (TI N2)**, **Douglas (Gerente de TI)**, **José (Analista de TI)** ou **Kauã (Aux. Procesos e automatización)**. Cada personagem tem atributos e um golpe especial próprios.

Os visuais dos quatro personagens foram adaptados em pixel art a partir das fotos de referência fornecidas. A seleção e a arena usam a mesma arte, distribuída com o jogo em `public/assets/`: Emerzon veste a camisa do Corinthians; Douglas aparece sem camisa, com o corpo mais gordo e um revólver .38 na mão; José toma café em uma xícara; Kauã veste a camisa do São Paulo. Esses itens fazem parte do visual dos personagens. As imagens são carregadas localmente, sem serviços de geração ou outras chamadas externas durante as partidas.

## Hospedar na Vercel com multiplayer

Use a branch `codex/vercel-multiplayer`, a raiz do repositório (não `public`) e configure um Redis Free compartilhado. O guia completo está em [VERCEL.md](VERCEL.md). O cliente recupera a sala ao atualizar a mesma aba e tenta reconectar após quedas breves.

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

A partida dura **2min30s completos de combate**, além da contagem inicial. Cada nocaute vale um ponto; um nocaute comum permite retornar após 2 segundos com vida cheia e breve proteção; na finalização cinematográfica, o retorno acontece ao fim da cena. Vence quem tiver mais nocautes quando o tempo acabar. A vida restante desempata; com os dois critérios iguais, há empate. Um nocaute não encerra a partida antes do tempo.

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

## Elenco ampliado e seleção com busca

Além dos quatro personagens originais, o jogo inclui **Lula, Bolsonaro, Nikolas Ferreira, Dilma, Flávio Bolsonaro, Kid Bengala e Tun Tum Sarhur**. Cada convidado tem visual próprio em pixel art, compartilhado entre retrato e arena, sem depender de imagens externas durante a partida.

Use a busca e as setas laterais para escolher entre os 11 lutadores. A busca aceita nomes sem acentos e aliases como **Jair Bolsonaro** e **Tung Tung Sahur**. O modo local oferece a mesma busca e navegação para o Jogador 2. A escolha permanece ao mudar de página ou limpar a busca.

A partida preenche a janela disponível sem rolagem e mantém a proporção do desenho. Veja `ATUALIZACAO.md` para os detalhes do pacote completo; o antigo `ajuste-tela.zip` é mantido apenas por histórico.

## Finalização cinematográfica

Quando um **especial sem bloqueio causa nocaute**, o jogo aproxima a cena dos dois lutadores: o atacante se aproxima e faz um agarrão com as duas mãos; a cena corta para tela preta com três impactos sintéticos, reaparece em silhuetas com partículas vermelhas abstratas e termina em uma pose de vitória. Os dois personagens permanecem inteiros. A animação usa os próprios lutadores, com fundo escurecido e tremor breve de câmera. Dura **5,5 segundos** e funciona com os 11 lutadores nos modos local e online.

Use o especial normal: **G** para P1/online, **L** para P2 local ou **ESP** no toque. Não há tecla extra. O nocaute vale +1. O relógio, a movimentação, os itens e os efeitos temporários ficam pausados durante os 5,5 segundos. O rival retorna com vida cheia ao fim da cena, sem aguardar mais 2 segundos; os nocautes comuns continuam com retorno em 2 segundos. Os comandos de ataque/movimento ficam bloqueados durante a cena para evitar ações às cegas; sair da arena continua disponível. Um nocaute duplo, um soco comum ou um especial defendido não ativam a cena.

No online, o servidor envia o momento do golpe e um retrato imutável do estado de cada lutador; os dois clientes reproduzem a mesma finalização. Se o tempo acabar durante a cena, o resultado aparece quando a animação terminar. A preferência do sistema por **movimento reduzido** remove a aproximação animada e o tremor e reduz as partículas.

A tela preta ocupa o trecho de 1,1 a 3,5 segundos; três impactos sintéticos de arcade tocam em 1,4, 2,2 e 3 segundos, uma vez por batida. Para ouvi-lo, ative o ícone de som na seleção antes de entrar na arena. O mudo continua sendo respeitado.
