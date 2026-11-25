# Folio

Estante de leitura em inglês com Next.js, TypeScript, Tailwind CSS, shadcn/ui, Three.js e SQLite. O Folio abre EPUB e TXT em um leitor paginado e guarda o ponto de leitura de cada livro.

## Requisitos para rodar localmente

| Recurso | O que instalar ou preparar |
| --- | --- |
| Leitor, estante e vocabulário | [Node.js](https://nodejs.org/en/download) **22.13.0 ou superior**, npm e um navegador atualizado. O SQLite já vem integrado ao Node.js. |
| Armazenamento | Permissão de escrita na pasta do projeto para guardar os livros, o progresso e o vocabulário. |
| Sugestões de tradução com IA | [Ollama](https://ollama.com/download) no mesmo computador que executa o Folio e o modelo local `qwen3.5:9b`. Esta etapa é opcional para ler e salvar vocabulário. |

## Executar localmente

Clone o repositório com Git ou baixe e extraia o ZIP. Na pasta que contém `package.json` e `package-lock.json`, abra um terminal e execute os dois comandos abaixo.

```sh
npm ci
npm run dev
```

Mantenha o terminal aberto e acesse [http://127.0.0.1:3000](http://127.0.0.1:3000). O Folio cria `data/folio.sqlite` na primeira abertura. Para usar outra pasta, defina `FOLIO_DB_PATH` em `.env.local` antes de iniciar.

## Configurar a tradução local com Ollama

### Hardware para o modelo padrão

| Recurso | Referência para `qwen3.5:9b` |
| --- | --- |
| Disco | O download ocupa cerca de **6,6 a 7,6 GB**, conforme a variante. Reserve **10 GB livres para o modelo**, além do espaço para o Ollama, o projeto e os livros. [Ficha do modelo](https://ollama.com/library/qwen3.5) |
| RAM | **16 GB de RAM** são uma referência prática para começar em um computador dedicado à leitura. O sistema, outros aplicativos e a memória disponível na GPU influenciam a capacidade necessária. |
| GPU | A tradução também funciona em CPU, com maior tempo de resposta. Para acelerar o modelo de 9B, uma GPU compatível com **12 GB de VRAM** é uma referência de configuração. Em Macs com Apple silicon, CPU e GPU compartilham a memória unificada. [Hardware compatível](https://docs.ollama.com/gpu) |
| Contexto | O Folio solicita **8.192 tokens** a cada chamada. Os pesos e o contexto ocupam memória durante a tradução. [Contexto e uso de memória](https://docs.ollama.com/context-length) |

### Instalar e verificar

1. Instale a versão atual do Ollama no computador que roda o Folio. No Windows ou macOS, abra o aplicativo. No Linux, inicie o serviço do Ollama ou execute `ollama serve` em um terminal separado se o serviço estiver parado.
2. Em outro terminal, baixe o modelo e confira se ele aparece entre os instalados.

   ```sh
   ollama pull qwen3.5:9b
   ollama list
   ```

3. Abra a [lista local de modelos](http://127.0.0.1:11434/api/tags) no navegador desse computador. A resposta deve conter `qwen3.5:9b`. Se a página não abrir, verifique se o Ollama está em execução. O Folio usa essa API local sem chave de acesso.
4. No Folio, abra um livro e selecione uma palavra ou frase. A primeira sugestão pode demorar enquanto o Ollama carrega o modelo. Durante a tradução, execute `ollama ps` para conferir o contexto alocado e se o processamento usa CPU, GPU ou ambas.

Para experimentar um modelo menor, baixe-o com `ollama pull qwen3.5:4b`. Adicione a linha abaixo ao arquivo `.env.local` na pasta do projeto e reinicie o Folio com `npm run dev`.

```dotenv
FOLIO_OLLAMA_MODEL=qwen3.5:4b
```

Com a configuração padrão, basta ter `qwen3.5:9b` instalado e o Ollama em execução. Ao ler no celular ou tablet, o Folio envia o pedido de tradução ao computador que executa o modelo.

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

### Como o leitor usa o contexto

O leitor busca a tradução automaticamente ao selecionar um trecho. Ao abrir **Salvar trecho**, a mesma sugestão preenche o significado. Você pode editá-lo ou digitar sua própria tradução enquanto a IA responde. Quando a palavra é omitida na tradução natural, a sugestão explica sua função na frase.

O Folio gera opções de tradução a partir do texto selecionado. Quando há mais de uma opção, usa o título do livro, o capítulo e até 12 mil caracteres da passagem para escolher o sentido mais adequado. Para palavras repetidas, o texto imediatamente vizinho ajuda a localizar a ocorrência selecionada.

## Desenvolvimento

```powershell
npm run typecheck
npm run build
npm start
```

A tela inicial usa Three.js para renderizar o destaque quando WebGL 2 está disponível. O Folio mantém os dados em SQLite no servidor local. Para preservar sua estante ao trocar de computador, pare o servidor e copie a pasta `data`.

O `.gitignore` exclui a estante local, os arquivos de ambiente e as saídas de build.
