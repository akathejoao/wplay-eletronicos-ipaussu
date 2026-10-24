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

As imagens enviadas são comprimidas e persistidas junto aos dados da loja. Para catálogos maiores, planeje migrar esses arquivos para Supabase Storage. Os modelos 3D são ilustrações, não modelos técnicos dos fabricantes.

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

Execute `npx tsc --noEmit`, `npm audit --omit=dev` e `npm run build` antes de publicar. Não rode o build enquanto o servidor de desenvolvimento usa a mesma pasta `.next`.

Após o deploy, confira a vitrine em celular, os links para o WhatsApp, o acesso administrativo e a persistência de uma alteração em outro navegador. Um pedido pelo WhatsApp não representa pagamento ou reserva de estoque.
