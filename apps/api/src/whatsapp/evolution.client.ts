import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SendTextResult = { ok: true } | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class EvolutionApiClient {
  private readonly logger = new Logger(EvolutionApiClient.name);
  private readonly url: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly instance: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('EVOLUTION_API_URL')?.replace(/\/$/, '');
    this.apiKey = this.config.get<string>('EVOLUTION_API_KEY');
    this.instance = this.config.get<string>('EVOLUTION_INSTANCE');
  }

  isConfigured(): boolean {
    return Boolean(this.url && this.apiKey && this.instance);
  }

  async sendText(toPhoneE164: string, text: string): Promise<SendTextResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Evolution API not configured' };
    }

    const endpoint = `${this.url}/message/sendText/${this.instance}`;
    const body = JSON.stringify({ number: toPhoneE164, text });

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.apiKey!,
          },
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.ok) {
          return { ok: true };
        }

        const isRetryable = response.status >= 500;
        const errorText = await response
          .text()
          .catch(() => response.statusText);
        if (!isRetryable || attempt === 1) {
          this.logger.error(
            `Evolution API send failed (${response.status}): ${errorText}`,
          );
          return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
        }
      } catch (error) {
        if (attempt === 1) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Evolution API send failed: ${message}`);
          return { ok: false, error: message };
        }
      }
    }

    return { ok: false, error: 'Unknown send failure' };
  }
}
