# Publicar o multiplayer na Vercel (plano gratuito)

Esta versão permite que dois jogadores em cidades diferentes usem o mesmo link HTTPS e um código de sala. As salas ficam em Redis compartilhado, e a simulação e validação dos golpes continuam no servidor. Não é preciso deixar o computador do criador da sala ligado nem abrir portas no roteador.

## 1. Criar o armazenamento das salas

1. Entre em https://console.upstash.com/ e crie uma conta sua.
2. Crie um banco **Redis** e escolha o plano **Free** (não selecione Pay as You Go ou outro plano pago).
3. Para esta configuração, escolha uma região próxima de **Northern Virginia / us-east-1**, onde estão as funções configuradas em `vercel.json` (`iad1`). Manter Redis e Vercel na mesma região reduz o atraso.
4. Na página do banco, localize **REST API** e guarde a URL e o token de leitura/escrita. O token somente de leitura não serve para criar salas.

A Upstash informa 500 mil comandos/mês no plano Free; confirme os limites no painel antes de criar o banco. O jogo consome comandos enquanto há jogadores conectados, inclusive no lobby. A latência depende da distância, da conexão e do banco; esta configuração com consultas HTTPS curtas é destinada a partidas casuais. Não há garantia de uso ilimitado: acompanhe as cotas de ambos os serviços.

## 2. Importar a versão correta

1. Entre em https://vercel.com/ com seu GitHub e use o plano pessoal **Hobby**.
2. Vá a **Add New → Project** e importe `KauaBidin/Ola-Mundo`.
3. Selecione a branch **codex/vercel-multiplayer**. Ela inclui todos os personagens e a finalização de 5,5 s.
4. Use estas opções:

| Campo | Valor |
| --- | --- |
| Framework Preset | Other |
| Root Directory | raiz do repositório: deixe em branco ou use `.` |
| Build Command | `npm run build` |
| Output Directory | `public` |
| Install Command | `npm ci` |
| Node.js | 22.x ou 24.x, conforme disponível no painel |

**A Root Directory não pode ser `public`.** Essa era a configuração da versão somente local. Agora a Vercel também precisa enxergar as pastas `api/`, `lib/`, `scripts/` e o `package.json` da raiz. O `vercel.json` incluído já configura o build e as funções.

Se o projeto já existia, altere a Root Directory nas configurações, selecione esta branch como Production Branch e faça um novo deploy. Não precisa fazer merge na main para usar esta branch.

## 3. Configurar as duas variáveis

Em **Settings → Environment Variables**, adicione:

| Nome | Valor |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | URL REST do banco que você criou |
| `UPSTASH_REDIS_REST_TOKEN` | token REST de leitura/escrita desse banco |

Marque **Production**; marque também **Preview** se quiser testar deploys de preview. Depois de salvar, faça **Redeploy**. A configuração só passa a valer no novo deploy.

Nunca coloque esses valores em `public/`, em JavaScript do navegador, no GitHub ou no código de sala. O arquivo `.env.example` contém somente exemplos. Integrações que criam `KV_REST_API_URL` e `KV_REST_API_TOKEN` também são aceitas pelo servidor.

## 4. Conferir e jogar

1. Abra `https://SEU-PROJETO.vercel.app/api/health`. Deve aparecer JSON com `"ok":true` e `"transport":"http"`.
2. Abra o endereço de produção do jogo e confira **ARENA ONLINE**.
3. Você escolhe o personagem e clica em **Criar sala**.
4. Seu amigo abre **o mesmo endereço HTTPS**, escolhe um personagem, clica em **Entrar com código** e digita o código de seis caracteres.
5. Os dois usam os controles P1 em seus próprios aparelhos. A partida começa com a contagem de três segundos.

O modo local continua disponível no mesmo site. Use o endereço de produção público; se o amigo vir uma tela pedindo login na Vercel, confira as opções de Deployment Protection do projeto antes de compartilhar.

## Quedas, salas e revanche

- Cada jogador recebe uma credencial privada guardada no `sessionStorage` da sua aba; o código compartilhado da sala não contém essa credencial.
- Atualizar a mesma aba recupera seu lugar, sem adicionar um terceiro jogador.
- Uma falha breve de rede inicia reconexão automática. Quando um jogador fica ausente, a partida pausa; há 30 s de tolerância para recuperar a mesma sessão.
- Após esse prazo, a sessão pode expirar e a sala volta a aguardar outro participante. Crie/entre novamente quando solicitado.
- Sair da arena é uma saída definitiva: não há reconexão automática depois desse comando.
- Os dois precisam aceitar a revanche. Ela cria uma nova rodada, limpa os efeitos e reinicia o placar.
- Salas sem consultas expiram no Redis após 30 minutos. Feche ou saia da sala quando terminar para parar o consumo de consultas.

## Problemas comuns

- **404 em `/api/health`:** Root Directory incorreta, branch antiga ou deploy sem a pasta `api/`. Use a raiz do repositório e faça Redeploy.
- **503 / multiplayer não configurado:** confira os dois nomes de variáveis, os ambientes marcados e faça Redeploy.
- **Banco indisponível:** confira o token de leitura/escrita, URL REST e as cotas no painel da Upstash. O jogo não substitui o banco por memória isolada quando a configuração falha.
- **Sala não encontrada:** use o mesmo link de produção e código; salas antigas podem ter expirado. Bancos diferentes em dois projetos não compartilham as salas.
- **Partida com atraso:** mantenha banco e funções na mesma região e teste uma região próxima dos dois jogadores. Este multiplayer usa sincronização por HTTPS, não rollback de um jogo competitivo.

## Executar no computador

`npm ci` e `npm start` continuam funcionando. Sem variáveis Redis, o servidor local usa o WebSocket original. Com as variáveis configuradas no ambiente, ele usa a mesma API HTTP compartilhada da Vercel. Para carregar um arquivo local privado, Node 22+ aceita `node --env-file=.env server.js`; não comite esse arquivo.

## Referências

- Vercel Hobby: https://vercel.com/docs/plans/hobby
- Configuração do build e funções: https://vercel.com/docs/project-configuration/vercel-json
- Upstash Free e limites: https://upstash.com/pricing/redis
- Redis REST API: https://upstash.com/docs/redis/features/restapi

## Verificação realizada nesta versão

- 67 testes automatizados passaram, cobrindo motor, efeitos, armazenamento, API, autenticação da sessão, concorrência e os dois transportes.
- Teste em Chromium com dois contextos isolados, Redis 7.4 real e uma instância nova do serviço a cada requisição: criação/entrada, golpes rápidos, finalização de 5,5 s nos dois jogadores, atualização da aba na mesma vaga, queda/reconexão, pausa, revanche e saída passaram sem erros de JavaScript.
- O modo local e o WebSocket original foram conferidos; a interface permaneceu sem rolagem nos oito tamanhos de janela já usados pelo projeto.
- Build e sintaxe passaram. A publicação na sua conta Vercel e o acesso ao seu banco Upstash dependem das configurações descritas acima; não foram realizados com credenciais suas nesta conversa.
