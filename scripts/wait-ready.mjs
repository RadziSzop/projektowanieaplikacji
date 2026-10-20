const base = process.env.API_URL ?? 'http://localhost:8080';
const deadline = Date.now() + 45_000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await fetch(new URL('/api/ready', base), {
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok && (await response.json()).status === 'ready') {
      ready = true;
      break;
    }
  } catch {
    /* Recreating containers temporarily interrupts connections. */
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!ready) throw new Error('API readiness timeout after container recreation');
console.log('API ready through Nginx.');
