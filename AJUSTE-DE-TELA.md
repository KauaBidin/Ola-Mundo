# Aplicar o ajuste de tela à sua versão do jogo

O ajuste mantém todo o conteúdo visível e adapta tamanhos e espaçamentos à janela. As regras da luta, personagens e imagens continuam nos arquivos existentes.

Se você já modificou o jogo no seu computador, aplique somente estes arquivos à sua pasta atual:

1. Salve [viewport.css](https://raw.githubusercontent.com/KauaBidin/Ola-Mundo/main/public/viewport.css) como `public/viewport.css`.
2. Salve [viewport.js](https://raw.githubusercontent.com/KauaBidin/Ola-Mundo/main/public/viewport.js) como `public/viewport.js`.
3. No seu `public/index.html`, adicione a linha abaixo **depois** da linha que carrega `style.css`:

   ```html
   <link rel="stylesheet" href="/viewport.css">
   ```

4. No mesmo arquivo, adicione esta linha **depois** da linha que carrega `app.js`, antes de `</body>`:

   ```html
   <script type="module" src="/viewport.js"></script>
   ```

5. Atualize o navegador com **Ctrl + F5**. Se o servidor estiver parado, use `npm start` na pasta do jogo.

Mantenha o restante dos seus arquivos como está. A versão deste repositório já inclui as duas linhas acima.

O ajuste reage ao tamanho da janela, ao carregamento das fontes e à troca entre seleção e partida. Em janelas muito pequenas, a interface inteira diminui para permanecer visível. Os diálogos de entrada e seleção local também têm um formato compacto em telas baixas.
