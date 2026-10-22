// scripts/check-live-env.mjs — `npm run deploy` only ships a real-data build.
// Without Mole V3's URL and anon key, and somewhere to get data (the Mole API
// gateway, or this product's own function), the build would show "This site
// isn't connected yet" to everyone at sense.mole.is. Sample data is
// `npm run deploy:sample`, on purpose.
const need = ['VITE_MOLE_SUPABASE_URL', 'VITE_MOLE_SUPABASE_ANON_KEY'];
const missing = need.filter(k => !process.env[k]);
if (!process.env.VITE_MOLE_API_URL && !process.env.VITE_ANALYTICS_API_URL) missing.push('VITE_MOLE_API_URL (or VITE_ANALYTICS_API_URL)');
if (missing.length) {
  console.error(`✗ not deploying: ${missing.join(', ')} not set. For the sample site use npm run deploy:sample.`);
  process.exit(1);
}
if (process.env.VITE_SAMPLE_DATA === 'true') {
  console.error('✗ VITE_SAMPLE_DATA=true would deploy sample data. Unset it, or use npm run deploy:sample.');
  process.exit(1);
}
console.log('✓ real-data settings present');
