async function retry(fn, retries = 3) {
  let lastErr;
  const attempts = Math.max(1, Number.isFinite(retries) ? retries : 1);

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastErr || new Error('retry: unknown failure');
}

module.exports = retry;