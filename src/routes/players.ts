import express, { Request, Response } from 'express';
import prisma from '../services/prisma';
import { asyncHandler } from '../middleware/error-handler';
import { requireAuth } from '../middleware/auth-middleware';

const router = express.Router();

// Rota para buscar jogadores com paginação e filtros
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Filtros opcionais
  const vocation = req.query.vocation as string | undefined;
  const minLevel = Number(req.query.minLevel) || undefined;

  const whereCondition = {
    ...(vocation && { vocation }),
    ...(minLevel && { level: { gte: minLevel } })
  };

  const [total, players] = await Promise.all([
    prisma.player.count({ where: whereCondition }),
    prisma.player.findMany({
      where: whereCondition,
      take: limit,
      skip: skip,
      orderBy: { level: 'desc' },
      select: {
        id: true,
        name: true,
        level: true,
        vocation: true,
        avatar: true
      }
    })
  ]);

  res.json({
    total,
    page,
    limit,
    players
  });
}));

// Rota para buscar detalhes de um jogador específico
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const player = await prisma.player.findUnique({
    where: { id: Number(id) },
    include: {
      account: {
        select: {
          id: true,
          username: true
        }
      }
    }
  });

  if (!player) {
    return res.status(404).json({ message: 'Jogador não encontrado' });
  }

  res.json(player);
}));

// Rota para atualizar perfil do jogador (requer autenticação)
router.put('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, avatar, vocation } = req.body;

  const updatedPlayer = await prisma.player.update({
    where: { id: Number(id) },
    data: {
      name,
      avatar,
      vocation
    }
  });

  res.json(updatedPlayer);
}));

export default router;
