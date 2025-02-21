import express from 'express';
import bcrypt from 'bcrypt';
import prisma from '../services/prisma';
import { User } from '../types/express-session';

const router = express.Router();

// Middleware para processar JSON e formulários
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// Rota para exibir a página de criação de conta
router.get('/create', (req: any, res: any) => {
    res.render('pages/account-create', { 
        title: 'Criar Conta', 
        error: null 
    });
});

// Rota para processar a criação de conta
router.post('/create', async (req: any, res: any, next: any) => {
    try {
        const { username, email, password } = req.body;

        // Validações básicas
        if (!username || !email || !password) {
            return res.render('pages/account-create', { 
                title: 'Criar Conta', 
                error: 'Todos os campos são obrigatórios' 
            });
        }

        // Verificar se usuário ou email já existem
        const existingAccount = await prisma.account.findFirst({
            where: {
                OR: [
                    { username },
                    { email }
                ]
            }
        });

        if (existingAccount) {
            return res.render('pages/account-create', { 
                title: 'Criar Conta', 
                error: 'Usuário ou email já cadastrado' 
            });
        }

        // Hash da senha
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Criar conta
        const newAccount = await prisma.account.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role: 'player',
                isActive: true
            }
        });

        // Redirecionar para login
        res.redirect('/login');

    } catch (error) {
        console.error('Erro ao criar conta:', error);
        next(error);
    }
});

// Rota para exibir a página de login
router.get('/login', (req: any, res: any) => {
    res.render('pages/login', { 
        title: 'Login', 
        error: null 
    });
});

// Rota para processar o login
router.post('/login', async (req: any, res: any, next: any) => {
  try {
    const { username, password } = req.body;

    // Validações básicas
    if (!username || !password) {
      return res.render('pages/login', { 
        title: 'Login', 
        error: 'Usuário e senha são obrigatórios' 
      });
    }

    // Buscar usuário
    const account = await prisma.account.findUnique({
      where: { username }
    });

    if (!account) {
      return res.render('pages/login', { 
        title: 'Login', 
        error: 'Usuário não encontrado' 
      });
    }

    // Verificar senha
    const isPasswordValid = await bcrypt.compare(password, account.password);

    if (!isPasswordValid) {
      return res.render('pages/login', { 
        title: 'Login', 
        error: 'Senha incorreta' 
      });
    }

    // Verificação de sessão com tratamento detalhado
    return new Promise<void>((resolve, reject) => {
      // Verificação explícita da sessão
      if (!req.session) {
        console.error('Sessão não inicializada');
        return res.status(500).render('pages/error', {
          title: 'Erro de Sessão',
          message: 'Não foi possível iniciar a sessão. Tente novamente.'
        });
      }

      // Regenerar sessão de forma segura
      req.session.regenerate(async (err) => {
        if (err) {
          console.error('Erro ao regenerar sessão:', err);
          return res.status(500).render('pages/error', {
            title: 'Erro de Sessão',
            message: 'Não foi possível iniciar a sessão. Tente novamente.'
          });
        }

        // Preparar dados do usuário para sessão
        const sessionUser: User = {
          id: account.id,
          username: account.username,
          email: account.email,
          role: account.role,
          isActive: account.isActive,
          lastLogin: account.lastLogin || new Date(),
          createdAt: account.createdAt,
          updatedAt: account.updatedAt
        };

        // Definir usuário na sessão
        req.session.user = sessionUser;

        try {
          // Atualizar último login
          await prisma.account.update({
            where: { id: account.id },
            data: { lastLogin: new Date() }
          });

          // Redirecionar para dashboard
          res.redirect('/dashboard');
          resolve();
        } catch (updateError) {
          console.error('Erro ao atualizar último login:', updateError);
          res.redirect('/dashboard');
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('Erro no login:', error);
    next(error);
  }
});

export default router;
