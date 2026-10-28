# Revisão da WPlay Eletrônicos Ipaussu

Data: 28/10/2026. Projeto Next.js 15.5.28 + React 19 + Supabase.

## Resultado e dependências externas

As correções foram implementadas no código local. O catálogo continua funcionando com o esquema atual do banco, e as opções de instalação estão acessíveis no cabeçalho e em uma seção própria, com alternativas Android e iPhone/iPad.

O download de um aplicativo Android instalável ainda depende de um **APK real, compilado e assinado**. O arquivo existente não atendia a esses requisitos e foi retirado da distribuição. A interface apresenta essa indisponibilidade e oferece a instalação pelo navegador. Não foi gerado outro arquivo fictício.

As consultas de leitura ao Supabase confirmaram que o projeto conectado ainda não possui `store_settings.custom_phone_models`, as colunas opcionais de preço PIX/parcelamento/estoque e a tabela `customer_leads`. O catálogo usa os campos disponíveis; as funções administrativas correspondentes precisam da atualização do esquema. Não houve aplicação de SQL, alteração de contas ou gravação de dados no banco remoto nesta revisão.

## Instalação e download

- Corrigida a abertura do modal: o componente anterior não tinha posicionamento/backdrop completo e aparecia fora da área visível.
- O diálogo nativo oferece nome acessível, foco inicial, contenção de foco, Escape, retorno do foco e bloqueio de rolagem da página.
- A seleção automática identifica iPhone, iPod e iPad, inclusive o iPad que se apresenta como Mac. Uma seleção explícita feita na seção de instalação é respeitada.
- A aba iPhone explica Safari, Compartilhar, Adicionar à Tela de Início e Adicionar. Em outros navegadores iOS, permite copiar o endereço para abrir no Safari.
- O Android oferece a instalação PWA quando o navegador disponibiliza o prompt e mantém instruções manuais para o Chrome. Cancelar o prompt mantém o guia disponível; aceitar fecha o modal. O prompt é consumido uma única vez.
- O estado de aplicativo instalado acompanha o modo standalone e o evento `appinstalled`.
- O botão de APK só aparece após a consulta de disponibilidade. Enquanto não existe um arquivo publicável, o cliente recebe uma explicação útil.
- `/api/download/apk` oferece GET/HEAD, resposta de indisponibilidade sem cache, MIME de APK, nome de anexo, tamanho do arquivo e entrega por stream. A configuração do Next inclui o futuro binário no rastreamento da função.
- `scripts/build-apk.py` deixou de fabricar arquivos ZIP. Agora valida um APK já compilado com manifesto binário, DEX, assinatura via `apksigner` e atividade inicial via `aapt`, antes de publicar o arquivo.

### Evidência do APK anterior

O pacote tinha `AndroidManifest.xml` em XML textual, DEX sem implementação de uma atividade e `CERT.RSA` com um texto fixo em vez de assinatura criptográfica. O gerador também escrevia uma declaração fictícia de assinatura. Uma cópia foi preservada em `outputs/wplay-invalid-placeholder.apk`, fora dos arquivos publicados. O novo publicador rejeitou esse arquivo no teste de validação.

Para habilitar o download real, o responsável pelo aplicativo deve fornecer seu APK de release e executar o comando descrito no README com os build-tools do Android SDK. Depois é necessário gerar um novo build/deploy. A instalação desse futuro binário em um aparelho Android não foi validada nesta revisão.

## PWA e navegação offline

- Gerados ícones PNG com dimensões reais de 192×192, 512×512 e 180×180; adicionado ícone maskable separado com margem de segurança.
- Corrigido o manifesto, que declarava tamanhos diferentes para o mesmo arquivo de 1080×1080. Acrescentados identidade e escopo do aplicativo.
- O layout usa o ícone Apple adequado e permite ampliar o conteúdo por zoom.
- O service worker agora armazena uma página real de reconexão. O código anterior tentava recuperar respostas de um cache que não era preenchido.
- O worker não armazena preços, respostas de API ou páginas administrativas. A limpeza alcança apenas versões do cache da WPlay.
- A abertura por clique em notificação é limitada à origem da loja. O teste de notificação do painel registra o worker e possui tempo limite.
- Removidas promessas de carregamento instantâneo, ofertas exclusivas e notificações automáticas sem implementação correspondente. O painel apresenta somente um teste local de notificação; envio para clientes não está configurado.

## Design e comportamento responsivo

Foi preservada a identidade existente: superfícies escuras, verde lime `#c7f450`, tipografia e ambiente da WPlay. A execução como subagente utilizou o briefing fornecido e os arquivos PRODUCT.md/DESIGN.md como contexto de decisão.

- Corrigida a largura mínima intrínseca do hero, que causava transbordamento no celular.
- O cabeçalho tem alvos de toque de pelo menos 44 px, texto compacto no celular e nome explícito do download no desktop.
- A navegação se recolhe também em larguras intermediárias e fecha com Escape ou clique fora do cabeçalho.
- O guia de instalação tem uma única superfície, abas claras, passos legíveis e áreas seguras para dispositivos com recortes de tela.
- Removidos o banner duplicado de instalação e os estilos obsoletos do modal anterior.
- Corrigida a sobreposição do cabeçalho sobre a visualização de produto: a camada do modal agora fica acima da navegação.
- Reservado espaço para o botão de fechar junto aos controles de giro, evitando sua sobreposição no celular. A seleção inicial da aba de instalação é aplicada antes da primeira pintura do diálogo.
- O visualizador de iPhone aceita arraste com captura de ponteiro e libera a interação em cancelamento/perda de captura; `touch-action: pan-y` preserva a rolagem vertical do navegador.
- O ambiente animado pausa durante os diálogos. O rodapé oferece uma ação explícita para pausar/retomar as animações, mantendo o tratamento de movimento reduzido existente.
- A faixa horizontal de vantagens pode receber foco pelo teclado.
- A página 404 apresenta uma mensagem factual e caminhos de recuperação para catálogo, pedido e localização.

O detector mecânico Impeccable foi executado e sinalizou cores e raios fora da documentação do sistema em estilos existentes. A identidade visual foi preservada; o resultado do detector não é apresentado como uma aprovação sem ressalvas. As verificações visuais e de acessibilidade foram realizadas separadamente.

## Dados, permissões e administração

- Criado `lib/admin-access.ts`, compartilhado pelo painel e pela invalidação do catálogo. Ele verifica a sessão no Supabase e consulta a autorização do próprio usuário.
- Removidos os atalhos que consideravam um e-mail fixo ou a leitura pública do catálogo como prova de autorização. Erros de permissão impedem o acesso.
- As operações de concessão/revogação verificam também o retorno booleano das RPCs, evitando mensagens de sucesso quando a operação não ocorreu.
- O arquivo de reparo de permissões mantém leitura restrita, proíbe promoção por e-mail fixo e preserva a gestão de acessos pelo administrador principal. Ele depende dos helpers privados do esquema de referência e precisa ser aplicado pelo processo de migração do banco.
- As leituras públicas de produtos/configurações acontecem em paralelo. A compatibilidade com colunas ausentes é acionada pelos códigos específicos desse erro, sem encobrir falhas de permissão ou rede.
- As gravações não descartam silenciosamente colunas para aparentar sucesso. A alteração de um produto exige confirmação de uma linha afetada.
- Os modelos de telefone personalizados sobrevivem à normalização e chegam à vitrine quando a coluna existe. Modelos inválidos são filtrados; gerações personalizadas aparecem no seletor.
- Os preços não recebem mais desconto PIX ou parcelamento calculado automaticamente. Valores inválidos são rejeitados; estoque desconhecido permanece sob consulta.
- O pedido começa vazio e o botão do cabeçalho não adiciona produtos sem escolha do cliente.
- O CRM não repõe contatos fictícios ao receber uma lista vazia nem usa dados locais para encobrir um erro do banco. Erros de leitura/gravação são apresentados no painel.
- Novas leituras online de contatos não gravam a lista privada no localStorage. O telefone da loja não é usado como telefone do cliente; o registro de interesse exige um telefone informado pelo cliente.
- Corrigida a abertura do WhatsApp antes da cópia assíncrona, preservando a ativação do clique. O link de recuperação aparece quando a abertura é bloqueada.
- A invalidação do cache continua notificando a página mesmo quando o armazenamento local está bloqueado.
- Removidos imports, estados e cálculos sem uso. A checagem TypeScript com `noUnusedLocals` e `noUnusedParameters` passou.

## Validação

- `npm test`: **14 testes aprovados**, cobrindo autorização, sessão expirada, permissões negadas, CRM vazio/sem acesso, preço/estoque, modelos personalizados, detecção iOS e transporte GET/HEAD do APK.
- O teste de transporte usa um fixture temporário identificado como conteúdo de teste; ele não representa um APK instalável nem é publicado.
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`: aprovado.
- `npm audit`: nenhuma vulnerabilidade encontrada, incluindo dependências de desenvolvimento.
- `npm run build`: aprovado com código de saída 0; o registro da execução está em `outputs/final-build.log`.
- Verificação em Chromium headless com larguras 320, 390, 768, 820, 1024 e 1366 px: sem transbordamento horizontal nem sobreposição entre marca e ações do cabeçalho.
- Verificados modal, teclado, abas, Escape, restauração do foco, prompt PWA aceito/cancelado, estado instalado, seleção explícita iPhone e navegação offline.
- Arraste horizontal e recuperação após cancelamento de toque verificados com eventos sintetizados pelo Chrome DevTools Protocol; pausa/retomada do ambiente e diálogo em 320×568 e 844×390 também verificados. Isso não substitui uma sessão em aparelho físico.
- Axe com regras WCAG A/AA: nenhuma violação automática nas telas verificadas — vitrine, diálogo de instalação, login administrativo e 404. Essa ferramenta não comprova conformidade completa.
- Testadas respostas HTTP do catálogo com fallback real, ausência de galeria privada na resposta pública, APK indisponível, invalidação sem autenticação, nome de mídia inválido e dimensões dos ícones.
- Detecção iPhone Safari, iPad em modo desktop e iPhone Chrome verificada por emulação de user-agent em Chromium. Instalação real pelo Safari/iOS e uso em aparelhos físicos permanecem fora da evidência deste teste.
- O acesso administrativo autenticado, a persistência online do CRM e a execução das alterações SQL exigem uma conta autorizada e a estrutura correspondente no banco. Foram verificados por testes de regressão locais, sem modificar dados de produção.

O README contém as instruções de operação e publicação. As capturas e o registro da verificação do navegador estão em `outputs/` e não são incluídos no site.
