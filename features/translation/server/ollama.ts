const endpoint = 'http://127.0.0.1:11434/api/chat';
const defaultModel = 'qwen3.5:9b';

export class TranslationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type StructuredQuestion = {
  instructions: string;
  input: object;
  schema: object;
};

export function createOllamaChat(requestSignal: AbortSignal) {
  const model = process.env.FOLIO_OLLAMA_MODEL?.trim() || defaultModel;
  if (/(?:^|[:/-])cloud(?:$|[:/-])/i.test(model)) {
    throw new TranslationError('Configure um modelo local do Ollama em FOLIO_OLLAMA_MODEL.', 503);
  }
  const usesGptOss = /^gpt-oss(?::|$)/i.test(model);
  const timeout = AbortSignal.timeout(90_000);
  const signal = AbortSignal.any([requestSignal, timeout]);

  return async function ask({ instructions, input, schema }: StructuredQuestion): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal,
        body: JSON.stringify({
          model,
          stream: false,
          think: usesGptOss ? 'low' : false,
          format: schema,
          messages: [
            { role: 'system', content: instructions },
            { role: 'user', content: JSON.stringify(input) },
          ],
          options: { temperature: 0, num_ctx: 8192, num_predict: usesGptOss ? 1024 : 512 },
        }),
      });
      if (response.status === 404) {
        throw new TranslationError(`O modelo ${model} não está disponível no Ollama. Rode ollama pull ${model} no PC.`, 503);
      }
      if (!response.ok) {
        throw new TranslationError('O Ollama não conseguiu gerar a tradução. Confira o modelo e tente novamente.', 502);
      }
      const payload = await response.json();
      if (typeof payload?.message?.content !== 'string' || payload.done_reason === 'length') return null;
      return JSON.parse(payload.message.content);
    } catch (error) {
      if (requestSignal.aborted) throw error;
      if (timeout.aborted) throw new TranslationError('O Ollama demorou para responder. Tente novamente.', 504);
      if (error instanceof TranslationError) throw error;
      if (error instanceof SyntaxError) return null;
      throw new TranslationError('Não consegui conectar ao Ollama. Abra o Ollama no PC e tente novamente.', 503);
    }
  };
}
