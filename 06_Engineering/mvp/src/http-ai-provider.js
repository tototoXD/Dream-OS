import { DreamOSAiProvider } from './ai-provider.js';

/**
 * Browser-side adapter. It only talks to our own server; the provider key never
 * enters the bundle or local storage.
 */
export class HttpAiProvider extends DreamOSAiProvider {
  constructor({ baseUrl = '/api' } = {}) {
    super();
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
  }

  async call(operation, payload) {
    const response = await fetch(`${this.baseUrl}/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation, payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `AI_API_${response.status}`);
    return data;
  }

  assessReadiness(payload) { return this.call('assessReadiness', payload); }
  startSession(payload) { return this.call('startSession', payload); }
  continueSession(payload) { return this.call('continueSession', payload); }
  formulateUnderstanding(payload) { return this.call('formulateUnderstanding', payload); }
  respondToSupplement(payload) { return this.call('respondToSupplement', payload); }
}
