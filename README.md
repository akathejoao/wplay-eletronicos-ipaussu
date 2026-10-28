# WPlay Eletrônicos

Catálogo Next.js com pedidos pelo WhatsApp e administração sincronizada pelo Supabase.

## Desenvolvimento

1. Use Node.js 22 ou 24 e execute `npm ci`.
2. Copie `.env.example` para `.env.local` e configure a URL e a chave publicável do projeto Supabase.
3. Execute `npm run dev` e abra `http://localhost:3000`.

Nunca use uma chave `service_role` ou secreta em variáveis `NEXT_PUBLIC_`. O modo demonstrativo de administração, sem Supabase, só funciona em localhost; não é autenticação de produção.

## Banco e segurança

O esquema de referência está em `supabase/schema.sql`. As alterações aplicadas ao banco também ficam no histórico de migrações do Supabase. Em um projeto existente, revise as migrações antes de alterar tabelas ou permissões.

- Visitantes leem apenas produtos publicados e os dados públicos da loja.
- Administradores autorizados gerenciam o catálogo, imagens e contatos.
- Somente o administrador principal concede ou remove acesso de outras pessoas.
- Autorizações ficam em `store_admin_invites`; contas verificadas são vinculadas a `store_owners` pelo procedimento `claim_store_admin`.
- A autorização inicial do administrador principal é cadastrada pelo responsável pelo banco, nunca pelo navegador público. O e-mail deve ser confirmado pelo Supabase Auth.
- Senhas não são armazenadas nas tabelas públicas da loja.

Os novos uploads são comprimidos no navegador e limitados a 250 KiB antes de ir para o bucket público `catalog-media`, configurado por `supabase/media-storage.sql`. Somente administradores autorizados podem enviar ou remover arquivos. O banco guarda URLs, não a imagem em base64. Os modelos 3D são ilustrações, não modelos técnicos dos fabricantes.

## Administradores

Abra `/admin`. No primeiro acesso, informe o e-mail autorizado e uma senha de pelo menos 12 caracteres, use **Criar conta** e confirme a conta pelo e-mail recebido. Também é possível receber um código ou link por e-mail. As contas do painel são independentes do login utilizado para gerenciar o projeto no site do Supabase. Cadastrar um e-mail como administrador autoriza o acesso, mas não envia uma mensagem de convite automaticamente: compartilhe o endereço `/admin` com a pessoa.

O administrador principal encontra a gestão de acessos na aba **Segurança & Links**. A remoção de acesso é imposta pelo banco mesmo que a sessão da pessoa continue aberta. O administrador principal não pode remover o próprio acesso pelo painel.

## Publicação na Vercel

Importe o repositório GitHub como projeto Next.js e configure estas variáveis nos ambientes desejados:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No Supabase, em **Authentication → URL Configuration**, defina **Site URL** como a URL HTTPS da aplicação e adicione a URL completa de `/admin` à lista de redirecionamentos permitidos. Adicione `http://localhost:3000/admin` somente para desenvolvimento. Para recebimento de códigos por e-mail, o template de autenticação deve conter `{{ .Token }}`; o link de confirmação pode ser mantido também.

O serviço padrão de e-mail do Supabase tem limites e restrições de destinatários. Antes de convidar clientes ou funcionários externos, configure um provedor SMTP próprio em **Authentication → Email**. Verifique o recebimento e a recuperação de acesso antes de entregar o painel ao cliente.

Não publique `.env.local`, pastas de cache, arquivos de credenciais ou dados de navegação. A integração Git da Vercel deve acompanhar a branch de produção aprovada.

## Verificação

Execute `npm test`, `npx tsc --noEmit`, `npm audit --omit=dev` e `npm run build` antes de publicar. Não rode o build enquanto o servidor de desenvolvimento usa a mesma pasta `.next`.

Após o deploy, confira a vitrine em celular, os links para o WhatsApp, o acesso administrativo e a persistência de uma alteração em outro navegador. Um pedido pelo WhatsApp não representa pagamento ou reserva de estoque.

## Consumo no plano gratuito

- A vitrine usa `/api/catalog`, com cache de 5 minutos na camada de dados do Next.js e cache compartilhado na Vercel. Visitantes não consultam o banco diretamente nem abrem conexões Realtime.
- O navegador reutiliza a resposta salva por 5 minutos. Recarregar a página ou alternar abas nesse período não inicia novas consultas ao Supabase. Após falha de atualização, a última versão salva pode ser exibida por até 24 horas com aviso para confirmar disponibilidade.
- A resposta pública não contém a galeria administrativa, usuários, convites ou credenciais. Produtos não publicados continuam restritos aos administradores.
- Ao salvar uma alteração, o painel solicita a invalidação do cache em uma rota autenticada. Apenas administradores autorizados podem invalidá-lo. Se a invalidação falhar, a gravação continua válida e a atualização ocorre pela expiração normal; outros navegadores podem demorar alguns minutos, conservadoramente até cerca de 10 minutos com as camadas de cache. Em falha do provedor, a versão antiga pode durar mais.
- Novos uploads recebem nomes únicos e são servidos por `/api/media/`, com cache longo na Vercel e no navegador. Não é usada a transformação de imagens paga do Supabase. O primeiro carregamento de cada arquivo ainda consome egress do Supabase; os acessos seguintes podem ser servidos pela Vercel.
- Arquivos antigos não são apagados automaticamente: remover uma referência não apaga a foto do Storage, evitando perda acidental. Revise arquivos que não usa mais quando o armazenamento crescer. Imagens externas inseridas por URL mantêm as regras de cache e consumo do provedor de origem.
- A camada de cache reduz tráfego no Supabase, mas também usa as cotas de rede e execução da Vercel. Ela não torna a hospedagem ilimitada nem bloqueia consumo feito diretamente nas APIs do provedor.

Os limites mostrados no painel do projeto em outubro de 2026 são 500 MB de banco, 1 GB de Storage, 5 GB de egress não cacheado e outros 5 GB de egress cacheado. O egress cacheado do Supabase refere-se ao CDN do Storage, não ao cache da Vercel. Banco e armazenamento são limites de capacidade, não franquias que zeram todo mês. As franquias de egress pertencem à organização e podem ser compartilhadas com outros projetos.

Como referência de planejamento, 10 mil sessões com cinco minutos de navegação causavam aproximadamente 100–120 mil consultas públicas antes do cache (duas leituras por minuto e por visitante). Agora os visitantes compartilham os resultados: as leituras ao Supabase acompanham as expirações e invalidações do cache, não o número de visitantes. A redução real depende de regiões, acessos, alterações, tamanho do catálogo e comportamento dos caches; não há garantia de consumo máximo fixo.

Confira semanalmente **Supabase → Organization → Usage**, principalmente egress e Storage, e com maior frequência após campanhas ou novos uploads. Considere 70% como alerta operacional e 85% como sinal para reduzir tráfego/uploads ou rever o plano; esses percentuais são recomendações, não alertas automáticos implementados. Não houve alteração de plano, cobrança ou configuração de gasto.

Referências: [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Bandwidth do Storage](https://supabase.com/docs/guides/storage/serving/bandwidth), [limites e política de uso](https://supabase.com/docs/guides/platform/billing-faq).

## Instalação do app

O botão **Baixar app** do cabeçalho e a seção **A WPlay na sua tela inicial** abrem as opções Android e iPhone/iPad. No iOS, o guia é selecionado automaticamente, inclusive no iPad com identificação de desktop. Outros navegadores no iOS recebem orientação para abrir o Safari.

- **Android pelo navegador:** use a oferta de instalação do Chrome quando disponível ou o menu **Adicionar à tela inicial / Instalar app**.
- **iPhone/iPad:** no Safari, toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**. Os nomes e a posição do menu podem variar conforme a versão do iOS.
- **APK Android:** publique um aplicativo real, compilado e assinado, em `public/downloads/wplay-app.apk`. A rota `/api/download/apk` entrega o arquivo como anexo e oferece `HEAD` para verificar a disponibilidade. Enquanto o arquivo não existir, a interface informa a indisponibilidade e mantém o guia pelo navegador.

O arquivo anterior era um ZIP com manifesto não compilado, DEX vazio e assinatura fictícia; foi retirado da distribuição. `scripts/build-apk.py` agora valida um APK existente com `apksigner` e `aapt` do Android SDK, antes de copiá-lo para a pasta pública:

```powershell
python scripts/build-apk.py caminho/app-release.apk --build-tools caminho/Android/Sdk/build-tools/35.0.0
```

Esse comando não compila um aplicativo e não cria uma chave de assinatura. O responsável pelo app precisa fornecer o APK de release. Depois de publicar o arquivo, gere um novo build/deploy para incluir o binário na função de download.

A instalação PWA exige HTTPS em produção. O service worker mostra uma página de reconexão quando não há internet; ele não armazena preços, respostas de API nem páginas administrativas. A consulta do catálogo exige conexão. O site não implementa envio de notificações a clientes; o painel oferece apenas um teste local, com permissão do navegador.

## Compatibilidade do banco

As leituras aceitam bancos anteriores às colunas opcionais de preço PIX, parcelamento, estoque e modelos personalizados. Erros de permissão continuam sendo exibidos. Gravações não descartam campos para aparentar sucesso: se uma coluna necessária estiver ausente, o painel informa a falha.

Os modelos personalizados exigem `store_settings.custom_phone_models`; preço PIX, parcelamento, estoque e CRM têm estrutura de referência em `supabase/crm-leads-stock.sql`. A correção de permissões em `supabase/fix-store-owners-access.sql` pressupõe os helpers privados de `supabase/schema.sql`, preserva os privilégios do administrador principal e não cadastra administradores por e-mail fixo. Revise esses arquivos e aplique as alterações pelo processo de migração do banco antes de usar as funções correspondentes. Nenhuma alteração no banco remoto é feita automaticamente pelo site.

O CRM online não usa contatos fictícios nem armazena a lista privada de clientes no localStorage. Uma consulta vazia permanece vazia; falhas de leitura e gravação são informadas no painel. O pedido inicial começa vazio, e o site registra interesse somente quando o cliente informa um telefone.
