const months = new Set([
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]);

export function suggestImpersonalDate(selected: string, followingText: string) {
  if (selected.toLowerCase() !== 'it') return null;
  const date = /^\s+(?:is|was)\s+([a-z]+)\s+[12]\d{3}(?=\s|[,.;!?]|$)/i.exec(followingText);
  if (!date || !months.has(date[1].toLowerCase())) return null;
  return { translation: 'Sujeito impessoal, omitido em português.' };
}
