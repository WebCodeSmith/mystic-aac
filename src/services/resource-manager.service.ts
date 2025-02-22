import { ResourceManager } from '../utils/server-helpers';

export class ResourceManagerService extends ResourceManager {
  // Método adicional específico para este serviço
  logResourceStatus() {
    // Lista de recursos padrão para verificar
    const defaultResourceNames = ['fastify', 'redis', 'prisma'];
    
    const registeredResources: string[] = defaultResourceNames.filter(name => {
      try {
        // Tenta recuperar o recurso usando o método público get()
        this.get(name);
        return true;
      } catch {
        // Recurso não registrado, retorna false
        return false;
      }
    });

    console.log('Recursos registrados:', registeredResources);
  }

  // Método para adicionar recursos com log
  registerWithLog(name: string, resource: any) {
    this.register(name, resource);
    console.log(`Recurso registrado: ${name}`);
  }
}
