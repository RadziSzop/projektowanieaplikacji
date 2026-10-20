const [key, base = process.env.API_URL ?? 'http://localhost:8080'] = process.argv.slice(2);
if (!key) {
  console.error('Usage: npm run verify -- <license-key> [http://localhost:8080]');
  process.exitCode = 2;
} else {
  try {
    const response = await fetch(new URL('/api/licenses/verify', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error(data.error ?? 'Verification unavailable');
      process.exitCode = 2;
    } else {
      console.log(data.status);
      process.exitCode = data.status === 'VALID' ? 0 : 1;
    }
  } catch {
    console.error('Verification unavailable');
    process.exitCode = 2;
  }
}
