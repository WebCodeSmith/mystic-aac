"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceManagerService = void 0;
const server_helpers_1 = require("../utils/server-helpers");
class ResourceManagerService extends server_helpers_1.ResourceManager {
    logResourceStatus() {
        const defaultResourceNames = ['fastify', 'redis', 'prisma'];
        const registeredResources = defaultResourceNames.filter(name => {
            try {
                this.get(name);
                return true;
            }
            catch {
                return false;
            }
        });
        console.log('Recursos registrados:', registeredResources);
    }
    registerWithLog(name, resource) {
        this.register(name, resource);
        console.log(`Recurso registrado: ${name}`);
    }
}
exports.ResourceManagerService = ResourceManagerService;
