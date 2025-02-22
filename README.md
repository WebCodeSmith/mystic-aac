# Mystic AAC - Open Tibia Server Management Platform

## Descrição
Mystic AAC é uma plataforma de gerenciamento de servidores Open Tibia, desenvolvida com tecnologias modernas para oferecer uma experiência robusta e escalável.

## Tecnologias Principais
- **Backend**: Fastify
- **Banco de Dados**: Prisma ORM
- **Autenticação**: Sessões seguras com Redis
- **Frontend**: EJS Templates
- **Linguagem**: TypeScript
- **Gerenciamento de Configuração**: Zod Schema Validation

## Pré-requisitos
- Node.js (v18+)
- pnpm
- Redis
- PostgreSQL

## Instalação do Redis

### Windows
1. **Usando Windows Subsystem for Linux (WSL2) (Recomendado)**:
   ```bash
   # Instalar WSL2 e Ubuntu
   wsl --install
   
   # Abrir terminal do Ubuntu e executar:
   sudo apt update
   sudo apt install redis-server
   
   # Iniciar serviço Redis
   sudo service redis-server start
   ```

2. **Instalação Manual**:
   - Baixar Redis do site oficial: https://github.com/tporadowski/redis/releases
   - Extrair e executar `redis-server.exe`
   - Adicionar ao PATH para acesso via linha de comando

### macOS
```bash
brew update
brew install redis

# Iniciar serviço Redis
brew services start redis
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server

# Iniciar serviço Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Verificar Instalação do Redis
```bash
# Verificar se Redis está rodando
redis-cli ping
# Deve retornar "PONG"
```

## Instalação

### Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/mystic-aac.git
cd mystic-aac
```

### Instalar Dependências
```bash
pnpm install
```

### Configuração do Ambiente
1. Copie `.env.example` para `.env`
2. Preencha as variáveis de ambiente necessárias

### Configurações do Banco de Dados
```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### Migrações e Utilitários do Prisma

#### Criar ou Atualizar Migrações
```bash
# Criar uma nova migração baseada em mudanças no schema
pnpm prisma migrate dev --name init

# Aplicar migrações em produção
pnpm prisma migrate deploy
```

#### Utilitários do Banco de Dados (Opcional)
```bash
# Abrir visualizador de banco de dados
pnpm prisma studio

# Resetar banco de dados (CUIDADO: Apaga todos os dados)
pnpm prisma migrate reset
```

#### Comandos Adicionais do Prisma
```bash
# Gerar cliente Prisma
pnpm prisma generate

# Formatar schema do Prisma
pnpm prisma format

# Validar schema do Prisma
pnpm prisma validate
```

#### Resolução de Problemas
- Verifique se `DATABASE_URL` no `.env` está correto
- Certifique-se de que o PostgreSQL está rodando
- Confirme se o usuário do banco de dados tem permissões suficientes

### Executar o Projeto
```bash
# Modo de Desenvolvimento
pnpm dev

# Modo de Produção
pnpm build
pnpm start
```

## Estrutura do Projeto
```
mystic-aac/
├── prisma/           # Definições de modelo do banco de dados
├── public/           # Arquivos estáticos
├── src/
│   ├── config/       # Configurações do aplicativo
│   ├── middleware/   # Middlewares customizados
│   ├── routes/       # Definições de rotas
│   ├── services/     # Lógica de negócio e serviços
│   ├── types/        # Definições de tipos TypeScript
│   └── utils/        # Utilitários
├── views/            # Templates EJS
└── .env              # Configurações de ambiente
```

## Recursos Principais
- Autenticação de usuários
- Gerenciamento de contas
- Sistema de sessão seguro
- Integração com banco de dados PostgreSQL
- Validação de esquema com Zod
- Rate limiting
- Logging detalhado

## Contribuição
1. Faça um fork do projeto
2. Crie sua branch de feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença
Este projeto está licenciado sob a MIT License.
