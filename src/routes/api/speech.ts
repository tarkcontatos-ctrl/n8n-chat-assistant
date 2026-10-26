import { createFileRoute } from '@tanstack/react-router';
import { requestSpeech } from '@/lib/speech-request.server';

export const Route = createFileRoute('/api/speech')({
  server: { handlers: { POST: async ({ request }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return Response.json({ message: 'A voz está sem configuração.' }, { status: 401 });
    let body: unknown;
    try { body = await request.json(); } catch { return Response.json({ message: 'Texto inválido.' }, { status: 400 }); }
    if (!body || typeof body !== 'object' || !('text' in body) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 6000) {
      return Response.json({ message: 'Texto inválido para leitura.' }, { status: 400 });
    }
    try {
      const upstream = await requestSpeech({ baseURL: 'https://ai.gateway.lovable.dev', apiKey: key, model: 'google/gemini-3.1-flash-tts-preview', format: 'gemini', voice: 'Charon' },
        'Leia somente o texto a seguir em português brasileiro. Use uma voz masculina natural, humana, acolhedora e conversacional, com entonação expressiva e pausas suaves. Sem tom robótico ou de locutor. Texto: ' + body.text, false, request.signal);
      return new Response(upstream.body, { status: upstream.status, headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream', 'Cache-Control': 'no-cache, no-transform' } });
    } catch (error) {
      if (request.signal.aborted) return new Response(null, { status: 499 });
      console.error('Speech connection failed', error);
      return Response.json({ message: 'Não foi possível conectar ao serviço de voz.' }, { status: 502 });
    }
  } } },
});
