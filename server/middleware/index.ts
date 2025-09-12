// Universal API Middleware - Entry Point
export * from './types';
export { AuthManager } from './AuthManager';
export { DataTransformer } from './DataTransformer';
export { ProviderRegistry } from './ProviderRegistry';
export { APIMiddleware } from './APIMiddleware';

// Create singleton instance for global use
import { APIMiddleware } from './APIMiddleware';
export const apiMiddleware = new APIMiddleware();