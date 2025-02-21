import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { 
  requireAuth, 
  preventAuthenticatedAccess, 
  logUserActivity 
} from '../middleware/auth-middleware';
import { 
  AuthService, 
  LoginSchema, 
  RecoverPasswordSchema, 
  CreateAccountSchema 
} from '../services/auth-service';
import { RateLimiter } from '../utils/rate-limiter';
import { renderPage } from '../utils/render-helper';
import { AppError, asyncHandler } from '../middleware/error-handler';
import prisma from '../services/prisma';
import logger from '../config/logger';

// Serviços e utilitários importados

// Constantes
const ONLINE_PLAYERS_COUNT = 42; // Substituir por valor real/dinâmico

const router = express.Router();

// Middleware para renderização consistente
const renderPageWithOnlinePlayers = (
  res: Response, 
  page: string, 
  options: { 
    title: string, 
    error?: string, 
    success?: string
  }
) => {
  renderPage(res, page, { 
    ...options, 
    onlinePlayers: ONLINE_PLAYERS_COUNT 
  });
};

// Rota para exibir a página de login
router.get('/login', 
  preventAuthenticatedAccess, 
  (req: Request, res: Response) => {
    renderPageWithOnlinePlayers(res, 'login', { 
      title: 'Login'
    });
  }
);

// Rota para processar o login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { username, password } = LoginSchema.parse(req.body);

    console.log('Login attempt:', { 
      username, 
      sessionId: req.sessionID,
      nodeEnv: process.env.NODE_ENV
    });

    if (!RateLimiter.checkLoginAttempts(username)) {
      const remainingBlockTime = RateLimiter.getRemainingBlockTime(username);
      return res.status(429).render('pages/login', {
        title: 'Login',
        error: `Muitas tentativas de login. Tente novamente em ${remainingBlockTime} minuto(s).`
      });
    }

    const sessionUser = await AuthService.validateLogin(username, password);
    
    console.log('User validated:', { 
      userId: sessionUser.id, 
      username: sessionUser.username,
      sessionId: req.sessionID,
      nodeEnv: process.env.NODE_ENV,
      sessionConfig: JSON.stringify({
        sessionExists: !!req.session,
        sessionId: req.sessionID,
        cookieConfig: req.session?.cookie
      }, null, 2)
    });

    // Regenerar sessão de forma síncrona
    return new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) {
          console.error('Erro ao regenerar sessão em produção:', {
            error: err,
            nodeEnv: process.env.NODE_ENV
          });
          logger.error('Erro ao regenerar sessão:', err);
          return res.status(500).render('pages/error', {
            title: 'Erro de Sessão',
            message: 'Não foi possível iniciar a sessão. Tente novamente.'
          });
        }

        // Definir usuário na sessão
        req.session.user = {
          id: sessionUser.id,
          username: sessionUser.username,
          email: sessionUser.email,
          role: sessionUser.role,
          isActive: sessionUser.isActive,
          lastLogin: sessionUser.lastLogin,
          createdAt: sessionUser.createdAt,
          updatedAt: sessionUser.updatedAt
        };

        console.log('Sessão criada em produção:', {
          sessionId: req.sessionID,
          user: JSON.stringify(req.session.user, null, 2),
          nodeEnv: process.env.NODE_ENV
        });

        // Atualizar último login
        AuthService.updateLastLogin(sessionUser.id)
          .then(() => {
            res.redirect('/dashboard');
            resolve();
          })
          .catch((updateError) => {
            console.error('Erro ao atualizar último login em produção:', {
              error: updateError,
              nodeEnv: process.env.NODE_ENV
            });
            logger.error('Erro ao atualizar último login:', updateError);
            res.redirect('/dashboard');
            resolve();
          });
      });
    });
  } catch (error) {
    console.error('Erro no processo de login em produção:', {
      error,
      nodeEnv: process.env.NODE_ENV
    });

    logger.error('Erro no processo de login:', error);

    if (error instanceof AppError) {
      return res.status(error.statusCode).render('pages/login', {
        title: 'Erro de Login',
        error: error.message
      });
    }

    // Erro genérico
    return res.status(500).render('pages/error', {
      title: 'Erro de Login',
      message: 'Ocorreu um erro inesperado. Tente novamente.'
    });
  }
}));

// Rota para recuperação de senha
router.get('/recover', (req: Request, res: Response) => {
  renderPageWithOnlinePlayers(res, 'password-recover', { 
    title: 'Recuperar Senha'
  });
});

router.post('/recover', asyncHandler(async (req: Request, res: Response) => {
  const { email, username } = RecoverPasswordSchema.parse(req.body);
  
  await AuthService.recoverPassword(email, username);

  renderPageWithOnlinePlayers(res, 'password-recover', { 
    title: 'Recuperar Senha', 
    success: 'Instruções de recuperação enviadas para seu e-mail.'
  });
}));

// Rota para criar conta
router.get('/create', (req: Request, res: Response) => {
  renderPageWithOnlinePlayers(res, 'account-create', { 
    title: 'Criar Conta'
  });
});

router.post('/create', asyncHandler(async (req: Request, res: Response) => {
  const accountData = CreateAccountSchema.parse(req.body);
  
  await AuthService.createAccount(accountData);

  renderPageWithOnlinePlayers(res, 'account-create', { 
    title: 'Criar Conta', 
    success: 'Conta criada com sucesso! Faça login para continuar.'
  });
}));

// Rota para o dashboard (protegida)
router.get('/dashboard', 
  requireAuth, 
  logUserActivity, 
  asyncHandler(async (req: Request, res: Response) => {
    // Verificação de segurança para req.session.user
    if (!req.session.user || !req.session.user.username) {
      throw new AppError('Você precisa fazer login para acessar esta página.', 401);
    }

    // Buscar dados do usuário e jogador
    const account = await prisma.account.findUnique({
      where: { username: req.session.user.username },
      include: { 
        Player: {
          select: {
            id: true,
            name: true,
            level: true,
            vocation: true,
            experience: true,
            avatar: true
          }
        }
      }
    });

    if (!account) {
      throw new AppError('Não foi possível encontrar sua conta. Por favor, faça login novamente.', 404);
    }

    // Buscar notícias recentes
    const news = await prisma.news.findMany({
      orderBy: { date: 'desc' },
      take: 5
    });

    res.render('pages/dashboard', {
      title: 'Painel do Jogador',
      user: req.session.user,
      player: account.Player || null,
      news: news || [],
      onlinePlayers: ONLINE_PLAYERS_COUNT
    });
  })
);

// Rota para logout
router.get('/logout', (req: Request, res: Response) => {
  // Registrar logout
  const username = req.session.user?.username || 'Usuário Desconhecido';
  
  // Destruir sessão de forma segura
  req.session.destroy((err) => {
    if (err) {
      logger.error(`Erro ao fazer logout para ${username}:`, err);
      return res.status(500).redirect('/');
    }

    // Limpar cookie de sessão
    res.clearCookie('connect.sid');
    
    // Log de logout
    logger.info(`Logout bem-sucedido para ${username}`);
    
    // Redirecionar para página inicial
    res.redirect('/');
  });
});

export default router;
