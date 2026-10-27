# Jogar pela rede local usando seu próprio computador

O servidor já está configurado para aceitar conexões de outros computadores em `0.0.0.0:3000`. Não é necessário alterar o código, contratar hospedagem nem configurar o roteador para acesso dentro da mesma rede.

## Windows — primeira instalação

1. Instale o Node.js LTS (versão 22 ou superior) em https://nodejs.org/ . A instalação inclui o npm. Feche e reabra o terminal após instalar.
2. Acesse https://github.com/KauaBidin/Ola-Mundo e clique em **Code → Download ZIP**. Extraia o arquivo baixado.
3. Abra a pasta extraída que contém `package.json` e `server.js`. Clique na barra de endereço do Explorador de Arquivos, digite `cmd` e pressione Enter.
4. Confira a instalação:

   ```bat
   node --version
   npm --version
   ```

5. Instale a dependência (precisa de internet na primeira instalação):

   ```bat
   npm ci
   ```

6. Inicie o jogo:

   ```bat
   npm start
   ```

   Aguarde `PVP GRUPO APANE ativo na porta 3000`. Mantenha esse terminal aberto. Para encerrar o servidor, pressione Ctrl+C. Nos próximos dias, basta abrir um terminal nessa pasta e executar `npm start` novamente.

7. Se o Firewall do Windows perguntar, permita o Node.js na rede privada confiável em que vocês vão jogar. Não desative o firewall. Se a janela não aparecer e os outros não conseguirem entrar, procure "Permitir um aplicativo pelo Firewall do Windows", clique em "Alterar configurações" e libere o Node.js para redes privadas.

## Descobrir e compartilhar o endereço

1. Sem fechar o terminal do jogo, abra outro Prompt de Comando e execute:

   ```bat
   ipconfig
   ```

2. Procure o **Endereço IPv4** do adaptador Wi-Fi ou Ethernet que você está usando. Ignore adaptadores desconectados e de VPN. Exemplo: `192.168.1.50`.
3. Nesse exemplo, o endereço do jogo será `http://192.168.1.50:3000`. Troque esse IP pelo seu. Você e seus colegas abrem esse mesmo endereço no navegador. Não use `0.0.0.0` como endereço de acesso.
4. Todos os dispositivos devem estar na mesma rede local com comunicação entre eles. Celulares podem acessar pelo Wi-Fi; não pelos dados móveis. Redes de convidados podem bloquear a comunicação entre aparelhos.
5. Um jogador escolhe seu personagem e clica em **Criar sala**. O outro escolhe o personagem, clica em **Entrar com código** e informa o código da sala. A luta começa automaticamente. O código da sala funciona somente nessa instância do servidor.

## Se não abrir nos outros dispositivos

- Teste primeiro o endereço com seu IP no navegador do próprio computador servidor.
- Confirme que o terminal do servidor continua aberto e sem mensagem de erro.
- Confira o IPv4 novamente: ele pode mudar quando você reconecta a rede.
- Confirme a liberação do Node.js no firewall e a comunicação entre os aparelhos no roteador. Se a rede for administrada por outra pessoa, a liberação pode depender do administrador.
- Se o endereço abrir, mas o multiplayer não conectar, verifique se algum proxy da rede bloqueia WebSocket.
- Se aparecer `EADDRINUSE`, a porta 3000 está ocupada. Encerre a outra instância ou, no Prompt de Comando, execute:

  ```bat
  set PORT=3001
  npm start
  ```

  Nesse caso, compartilhe o endereço com a porta `3001`.

## macOS e Linux

Instale o Node.js LTS (22+), extraia o jogo, abra um terminal na pasta e execute os mesmos comandos `npm ci` e `npm start`. Encontre o IP local nas configurações de rede; no Linux, também é possível consultar `hostname -I`. Se o firewall estiver ativo, permita conexões TCP na porta 3000 vindas da rede local.

## Operação

- O computador servidor precisa permanecer ligado, conectado e sem entrar em suspensão enquanto vocês jogam.
- Só o servidor precisa instalar Node.js. Os outros participantes usam apenas o navegador.
- Salas e partidas não ficam salvas: reiniciar o servidor encerra as salas.
- Este procedimento oferece acesso na rede local. Pessoas em outras redes precisam de uma configuração adicional de acesso remoto; não é necessário abrir portas no roteador para este modo local.
