import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger, maskPhone } from './logger.js';

const log = logger('sms');

export interface SmsProvider {
  /** Name shown in logs; also tells callers whether a real SMS leaves the server. */
  readonly name: 'fast2sms' | 'console';
  send(phone: string, message: string): Promise<void>;
}

/** Fast2SMS "Quick SMS" route (route=q): custom text, no DLT template required. */
class Fast2SmsProvider implements SmsProvider {
  readonly name = 'fast2sms' as const;

  constructor(private readonly apiKey: string) {}

  async send(phone: string, message: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { Authorization: this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'q', message, numbers: phone }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      log.error(`Fast2SMS unreachable (to ${maskPhone(phone)}): ${error instanceof Error ? error.message : error}`);
      throw new AppError(502, 'SMS_UNAVAILABLE', 'Could not send the SMS right now. Please try again shortly.');
    }

    const body = (await response.json().catch(() => ({}))) as {
      return?: boolean | string;
      status_code?: number;
      message?: string | string[];
    };

    if (!response.ok || !(body.return === true || body.return === 'true')) {
      // Log the provider's reason (e.g. 416 low wallet balance, 999 minimum recharge) but never the API key.
      log.error(`Fast2SMS rejected the message to ${maskPhone(phone)}: http=${response.status} status_code=${body.status_code} message=${JSON.stringify(body.message)}`);
      throw new AppError(502, 'SMS_FAILED', 'Could not send the SMS. Please try again later.');
    }
    log.info(`Fast2SMS accepted the message to ${maskPhone(phone)}`);
  }
}

/** Development fallback: prints the message instead of sending it, so no SMS is sent or charged. */
class ConsoleProvider implements SmsProvider {
  readonly name = 'console' as const;

  async send(phone: string, message: string): Promise<void> {
    log.info(`console provider, nothing sent. To ${phone}: ${message}`);
  }
}

export const sms: SmsProvider = env.FAST2SMS_API_KEY ? new Fast2SmsProvider(env.FAST2SMS_API_KEY) : new ConsoleProvider();
