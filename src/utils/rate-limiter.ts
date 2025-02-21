// Constantes de rate limiting
const MAX_LOGIN_ATTEMPTS = 5;
const BLOCK_DURATION_MINUTES = 15;

// Mapa de tentativas de login
const loginAttempts = new Map<string, { attempts: number, lastAttempt: number }>();

export class RateLimiter {
  /**
   * Verifica e registra tentativas de login
   * @param username Nome de usuário para verificação
   * @returns true se login pode ser tentado, false se bloqueado
   */
  static checkLoginAttempts(username: string): boolean {
    const now = Date.now();
    const userAttempts = loginAttempts.get(username) || { attempts: 0, lastAttempt: 0 };

    // Resetar tentativas se passou do tempo de bloqueio
    if (now - userAttempts.lastAttempt > BLOCK_DURATION_MINUTES * 60 * 1000) {
      loginAttempts.delete(username);
      return true;
    }

    // Verificar número de tentativas
    if (userAttempts.attempts >= MAX_LOGIN_ATTEMPTS) {
      return false;
    }

    // Atualizar tentativas
    loginAttempts.set(username, {
      attempts: userAttempts.attempts + 1,
      lastAttempt: now
    });

    return true;
  }

  /**
   * Obtém o tempo restante de bloqueio
   * @param username Nome de usuário
   * @returns Minutos restantes de bloqueio
   */
  static getRemainingBlockTime(username: string): number {
    const now = Date.now();
    const userAttempts = loginAttempts.get(username);

    if (!userAttempts) return 0;

    const elapsedTime = now - userAttempts.lastAttempt;
    const remainingTime = (BLOCK_DURATION_MINUTES * 60 * 1000) - elapsedTime;

    // Converter para minutos e arredondar para cima
    return Math.ceil(remainingTime / (60 * 1000));
  }

  /**
   * Limpa as tentativas de login para um usuário específico
   * @param username Nome de usuário
   */
  static clearLoginAttempts(username: string): void {
    loginAttempts.delete(username);
  }
}
