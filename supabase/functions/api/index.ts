// The app's backend. Routes and rules: ../_shared/api.ts
import { apiFromEnv } from '../_shared/env.ts';

Deno.serve(apiFromEnv((k) => Deno.env.get(k)));
