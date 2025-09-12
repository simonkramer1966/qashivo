import { UniversalProvider, ProviderType, ProviderRegistry as IProviderRegistry } from './types';

/**
 * Provider Registry
 * Manages registration and retrieval of providers
 */
export class ProviderRegistry implements IProviderRegistry {
  providers: Map<string, UniversalProvider> = new Map();

  /**
   * Register a new provider
   */
  register(provider: UniversalProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`Provider ${provider.name} is already registered. Overwriting.`);
    }
    
    this.providers.set(provider.name, provider);
    console.log(`Provider registered: ${provider.name} (${provider.type})`);
  }

  /**
   * Unregister a provider
   */
  unregister(providerName: string): void {
    const provider = this.providers.get(providerName);
    if (provider) {
      // Cleanup provider resources
      provider.disconnect().catch(error => {
        console.error(`Error during cleanup for ${providerName}:`, error);
      });
      
      this.providers.delete(providerName);
      console.log(`Provider unregistered: ${providerName}`);
    } else {
      console.warn(`Provider ${providerName} not found for unregistration`);
    }
  }

  /**
   * Get a specific provider
   */
  get(providerName: string): UniversalProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * List all providers
   */
  list(): UniversalProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers by type
   */
  getByType(type: ProviderType): UniversalProvider[] {
    return this.list().filter(provider => provider.type === type);
  }

  /**
   * Check if a provider is registered
   */
  has(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Get provider names
   */
  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider count
   */
  count(): number {
    return this.providers.size;
  }

  /**
   * Clear all providers
   */
  clear(): void {
    // Cleanup all providers first
    const cleanupPromises = Array.from(this.providers.values()).map(provider => 
      provider.disconnect().catch(error => {
        console.error(`Error during cleanup for ${provider.name}:`, error);
      })
    );

    Promise.allSettled(cleanupPromises).then(() => {
      this.providers.clear();
      console.log('All providers cleared from registry');
    });
  }
}