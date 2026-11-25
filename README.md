# Folio

Estante de leitura em inglês com Next.js, TypeScript, Tailwind CSS, shadcn/ui, Three.js e SQLite. O Folio abre EPUB e TXT em um leitor paginado e guarda o ponto de leitura de cada livro.

## Executar localmente

Requer Node.js 22.13 ou superior.

```powershell
cd E:\Projetos\English\english-e-reader
npm install
npm run dev
```

Abra [http://127.0.0.1:3000](http://127.0.0.1:3000). Se estiver usando o ZIP, extraia-o e execute os comandos na pasta extraída. O banco é criado na primeira abertura, em `data/folio.sqlite`. Use a variável `FOLIO_DB_PATH` para configurar outro caminho.

## Abrir no celular ou tablet

Conecte o celular ou tablet ao Wi-Fi da mesma rede do PC. Pare o servidor anterior com `Ctrl+C` e rode `npm run dev:lan` na pasta do projeto. No navegador do outro dispositivo, abra `http://IP-DO-PC:3000`. No Windows, o `ipconfig` mostra o endereço IPv4 do adaptador conectado. Se o Windows pedir acesso à rede, selecione somente redes privadas.

O PC precisa ficar ligado com o Folio rodando. Os dispositivos acessam a mesma estante e o mesmo progresso salvos no PC.

## Ler um livro

1. Abra o [English e-Reader](https://english-e-reader.net/), escolha um livro e selecione **EPUB** ou **TXT** no menu de download.
2. No Folio, clique em **Importar livro** e arraste ou selecione o arquivo. EPUB preserva a capa, a ordem dos capítulos, imagens rasterizadas e formatação básica. TXT é exibido como texto simples.
3. Abra o livro pela estante. Use os botões, as setas do teclado ou deslize o dedo na página para virar a folha. O menu de capítulos permite ir direto a uma seção. Em **Aparência**, ajuste o tamanho da fonte e escolha entre claro, sépia ou escuro.

Você pode guardar o link da página original na importação. O link permite voltar ao catálogo pelo menu do livro. A estante começa vazia. O primeiro livro importado aparece no destaque.

Em **Detectar automaticamente**, o Folio procura o código CEFR nos metadados do EPUB e no nome do arquivo. Para EPUBs identificados como downloads do English e-Reader, também consulta um índice local por título e autor. O índice usa as listas públicas de níveis do catálogo e funciona offline. Quando não há correspondência segura, o livro fica sem nível. Você pode escolher o nível na importação ou usar **Editar nível** na estante. Na importação em lote, a escolha manual vale para todos os arquivos selecionados.

## Vocabulário e flashcards

Toque ou clique numa palavra, ou selecione uma frase com a seleção de texto do navegador. A sugestão em português aparece junto à barra de navegação. Use **Salvar trecho** para revisar o significado e confirmar o cartão. O ícone de vocabulário no topo também permite digitar um trecho. O significado pode ser preenchido depois em **Vocabulário**, na estante.

Na tela de vocabulário, escolha CSV, TXT ou Excel para baixar a lista completa. Para flashcards, escolha Noji (CSV), Anki (TXT) ou o TXT com tabulações para outros apps. Os cartões usam o trecho em inglês na frente e o significado no verso. Quando o significado está em branco, o verso usa o contexto disponível.

### Tradução local com Ollama

Abra o Ollama no mesmo PC que roda o Folio e instale o modelo padrão:

```powershell
ollama pull qwen3.5:9b
```

O leitor busca a tradução automaticamente ao selecionar um trecho. Ao abrir **Salvar trecho**, a mesma sugestão preenche o significado. Você pode editá-lo ou digitar sua própria tradução enquanto a IA responde. Quando a palavra é omitida na tradução natural, a sugestão explica sua função na frase. O celular usa o Ollama do PC por meio do Folio. O servidor Ollama pode continuar no endereço local `127.0.0.1:11434`.

O Folio gera opções de tradução a partir do texto selecionado. Quando há mais de uma opção, usa o título do livro, o capítulo e até 12 mil caracteres da passagem para escolher o sentido mais adequado. Para palavras repetidas, o texto imediatamente vizinho ajuda a localizar a ocorrência selecionada. O modelo usa uma janela de 8.192 tokens.

Para usar outro modelo local de instruções, copie `.env.example` para `.env.local`, altere `FOLIO_OLLAMA_MODEL` e reinicie o Folio. Exemplos são `qwen3:8b` e `gpt-oss:20b`. A integração reside em `features/translation`, com a rota HTTP em `app/api/translation`.

## Desenvolvimento

```powershell
npm run typecheck
npm run build
npm start
```

A tela inicial usa Three.js para renderizar o destaque quando WebGL 2 está disponível. O Folio mantém os dados em SQLite no servidor local. Para preservar sua estante ao trocar de computador, pare o servidor e copie a pasta `data`.

O `.gitignore` exclui a estante local, os arquivos de ambiente e as saídas de build. Em um clone limpo, use `npm ci` para instalar as versões registradas em `package-lock.json`.
