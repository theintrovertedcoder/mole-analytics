// Deliveries from PLExyz. What each one does: ../_shared/webhook.ts
import { webhookFromEnv } from '../_shared/env.ts';

Deno.serve(webhookFromEnv((k) => Deno.env.get(k)));
