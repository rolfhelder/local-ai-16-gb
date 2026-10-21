export function serverTimings(log) {
  const prompt = [], generation = [];
  for (const line of log.split('\n')) {
    const match = /(?:prompt\s+)?eval time\s*=\s*([\d.]+) ms\s*\/\s*(\d+) tokens\s*\([^,]*,\s*([\d.]+) tokens per second\)/.exec(line);
    if (match) (line.includes('prompt eval time') ? prompt : generation).push({ milliseconds: Number(match[1]), tokens: Number(match[2]), tps: Number(match[3]) });
  }
  const average = entries => entries.length ? entries.reduce((sum, item) => sum + item.tps, 0) / entries.length : null;
  return { prompt, generation, promptTpsMean: average(prompt), generationTpsMean: average(generation),
    generationTpsWeighted: generation.length ? generation.reduce((sum, item) => sum + Math.max(0, item.tokens - 1), 0) / (generation.reduce((sum, item) => sum + item.milliseconds, 0) / 1000) : null };
}
