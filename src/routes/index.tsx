import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowUp, Mic, Volume2, Copy, Plus, ShieldCheck, Activity, AudioLines, Square } from "lucide-react";
import innovationImage from "@/assets/vigyon-innovation.jpg";
import { streamSpeech } from "@/lib/stream-speech";
import { chunkText } from "@/lib/chunk-text";
import { askVigyon } from "@/lib/chat.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vigyon AI — Segurança do trabalho por voz e texto" },
      { name: "description", content: "Pergunte sobre SST, SMS/QSMS e meio ambiente e receba respostas por escrito e em áudio." },
      { property: "og:title", content: "Vigyon AI — Segurança do trabalho por voz e texto" },
      { property: "og:description", content: "Assistente de SST, SMS/QSMS e meio ambiente em pt-BR, por voz ou texto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Msg = { id: number; role: "user" | "bot"; text: string };
type Status = { s: "ready" | "listening" | "busy" | "error"; text: string };

const WELCOME =
  "Olá, eu sou o Vigyon. Pergunte sobre segurança do trabalho, SMS/QSMS ou meio ambiente. Se faltar contexto, eu peço antes de concluir.";

const TOPICS = [
  ["Análise de risco de uma tarefa", "NR-1", "Como faço uma análise de risco em uma usina de asfalto?"],
  ["Trabalho em altura", "NR-35", "Quais cuidados são necessários para trabalho em altura?"],
  ["Espaço confinado", "NR-33", "Quais são os requisitos para entrada em espaço confinado?"],
  ["Escolha e uso de EPI", "NR-6", "Como escolher e controlar o uso de EPI?"],
  ["Proteção de máquinas", "NR-12", "Como proteger máquinas e equipamentos contra acidentes?"],
  ["Plano de emergência", "Brigada", "Como montar um plano de emergência?"],
  ["Investigação de incidentes", "Causa raiz", "Como investigar um incidente ou acidente de trabalho?"],
  ["Resíduos e licenciamento", "Ambiental", "Como gerenciar resíduos e quais cuidados ter com licenciamento ambiental?"],
] as const;

const READY = "Pronto. Respostas pelo assistente Vigyon.";

function newSession() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(36).slice(2);
}

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2" aria-label="Vigyon AI">
      <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">
        <path d="M14 1 L27 6 V15 C27 23 21 29 14 31 C7 29 1 23 1 15 V6 Z" fill="var(--brand)" />
        <path d="M8 11 L14 23 L20 11" fill="none" stroke="var(--on-brand)" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="14" cy="5" r="2.5" fill="var(--alert)" />
      </svg>
      <span className="vg-display text-2xl leading-none">
        VIGYON <span className="vg-brand">AI</span>
      </span>
    </a>
  );
}

function BotText({ text }: { text: string }) {
  const blocks: Array<{ type: "p"; t: string } | { type: "ul"; items: string[] }> = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const li = /^[-*•]\s+/.test(line);
    const clean = line.replace(/^[-*•]\s+/, "").replace(/\*\*/g, "");
    if (li) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.items.push(clean);
      else blocks.push({ type: "ul", items: [clean] });
    } else blocks.push({ type: "p", t: clean });
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.type === "p" ? <p key={i}>{b.t}</p> : (
          <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
        ),
      )}
    </>
  );
}

function Index() {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, role: "bot", text: WELCOME }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ s: "ready", text: READY });
  const [voiceReply, setVoiceReply] = useState(true);
  const [autoSend, setAutoSend] = useState(true);
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

  const audioController = useRef<AbortController | null>(null);
  const session = useRef<string>("");
  const busyRef = useRef(false);
  const idRef = useRef(1);
  const logRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);
  const transcriptRef = useRef("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opts = useRef({ voiceReply, autoSend, rate });
  opts.current = { voiceReply, autoSend, rate };

  useEffect(() => { session.current = newSession(); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [msgs, busy]);

  function stopAudio() {
    audioController.current?.abort();
    audioController.current = null;
    setSpeaking(false);
  }

  async function speak(text: string) {
    stopAudio();
    const controller = new AbortController();
    audioController.current = controller;
    setSpeaking(true);
    try {
      const cleaned = text.replace(/^[-*•]\s+/gm, "").replace(/\*\*/g, "");
      for (const chunk of chunkText(cleaned)) {
        controller.signal.throwIfAborted();
        await streamSpeech('/api/speech', chunk, controller.signal, opts.current.rate);
      }
    } catch (error) {
      if (!controller.signal.aborted) setStatus({ s: "error", text: error instanceof Error ? error.message : "Não foi possível reproduzir a voz." });
    } finally {
      if (audioController.current === controller) { audioController.current = null; setSpeaking(false); }
    }
  }

  async function send(raw: string) {
    const message = raw.trim().slice(0, 1500);
    if (!message || busyRef.current) return;
    stopAudio();
    busyRef.current = true;
    setBusy(true);
    setInput("");
    setMsgs((m) => [...m, { id: idRef.current++, role: "user", text: message }]);
    setStatus({ s: "busy", text: "Processando a pergunta…" });
    try {
      const { answer } = await askVigyon({ data: { message, sessionId: session.current } });
      setMsgs((m) => [...m, { id: idRef.current++, role: "bot", text: answer }]);
      setStatus({ s: "ready", text: READY });
      if (opts.current.voiceReply) speak(answer);
    } catch (e) {
      console.error(e);
      setStatus({ s: "error", text: "Não foi possível obter a resposta agora. Tente de novo em instantes." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setStatus({ s: "error", text: "Seu navegador não reconhece voz. Use Chrome, Edge ou Safari, ou digite a pergunta." });
      return;
    }
    stopAudio();
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    transcriptRef.current = "";
    let failed = false;
    rec.onresult = (ev: any) => {
      let t = "";
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      transcriptRef.current = t;
      setInput(t);
    };
    rec.onerror = (ev: any) => {
      failed = true;
      const map: Record<string, string> = {
        "not-allowed": "Microfone bloqueado. Libere a permissão no navegador ou digite a pergunta.",
        "service-not-allowed": "Microfone bloqueado. Libere a permissão no navegador ou digite a pergunta.",
        "no-speech": "Não ouvi nada. Toque no microfone e tente de novo.",
        "audio-capture": "Nenhum microfone encontrado. Digite a pergunta.",
      };
      setStatus({ s: "error", text: map[ev.error] ?? "Não foi possível usar o microfone. Digite a pergunta." });
    };
    rec.onend = () => {
      setListening(false);
      if (failed) return;
      const t = transcriptRef.current.trim();
      if (!t) { setStatus({ s: "error", text: "Não ouvi nada. Toque no microfone e tente de novo." }); return; }
      if (opts.current.autoSend) send(t);
      else setStatus({ s: "ready", text: "Revise o texto e toque em Enviar." });
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
    setStatus({ s: "listening", text: "Ouvindo… fale sua pergunta." });
  }

  function goChat() { document.getElementById("assistente")?.scrollIntoView({ block: "start" }); }

  function newChat() {
    stopAudio();
    recRef.current?.abort?.();
    session.current = newSession();
    setMsgs([{ id: idRef.current++, role: "bot", text: WELCOME }]);
    setInput("");
    setStatus({ s: "ready", text: READY });
  }

  async function copy(m: Msg) {
    try { await navigator.clipboard.writeText(m.text); setCopied(m.id); setTimeout(() => setCopied(null), 1800); } catch { /* ignore */ }
  }

  return (
    <div id="top">
      <header className="vg-header">
        <div className="vg-wrap flex h-full items-center justify-between gap-4">
          <Logo />
          <div className="flex items-center gap-6">
            <nav className="vg-nav flex gap-6" aria-label="Principal">
              <a href="#assistente">Assistente</a>
              <a href="#temas">Temas</a>

            </nav>
            <Button className="vg-btn vg-btn-outline" onClick={() => { setLoginMsg(""); dialogRef.current?.showModal(); }}>Entrar</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="vg-hero">
          <img className="vg-hero-image" src={innovationImage} width={1536} height={1024} alt="Mão robótica com escudo de proteção verde" />
          <div className="vg-wrap vg-hero-content">
            <div className="vg-eyebrow"><span className="vg-dot" data-s="ready" /> INTELIGÊNCIA APLICADA À PROTEÇÃO</div>
            <h1 className="vg-display vg-h1">VIGYON<span className="vg-brand"> AI</span></h1>
            <h2 className="vg-hero-statement">Antecipe o risco.<br />Avance com inteligência.</h2>
            <p className="vg-muted vg-hero-description">Segurança do trabalho, meio ambiente e gestão de riscos. Uma nova perspectiva para cada decisão.</p>
            <div className="flex flex-wrap gap-3">
              <Button className="vg-btn vg-btn-primary" onClick={goChat}>Iniciar conversa <ArrowUpRight /></Button>
              <Button variant="outline" className="vg-btn vg-btn-outline" onClick={() => { goChat(); toggleMic(); }}><Mic /> Falar com Vigyon</Button>
            </div>
            <div className="vg-hero-meta"><span><ShieldCheck size={16} /> SST / QSMS</span><span><Activity size={16} /> INTELIGÊNCIA ARTIFICIAL</span></div>
          </div>
        </section>
        <div className="vg-ticker"><div className="vg-wrap">PREVENÇÃO <span>+</span> INTELIGÊNCIA <span>+</span> EVOLUÇÃO <span>+</span> SEGURANÇA</div></div>
        <section className="vg-wrap vg-workspace">
          <div className="vg-section-heading"><div><p className="vg-eyebrow">01 / ASSISTENTE</p><h2 className="vg-display vg-h2">Sua próxima decisão<br /><span className="vg-muted">começa aqui.</span></h2></div><span className="vg-online"><span className="vg-dot" data-s="ready" /> Vigyon conectado</span></div>
          <section id="assistente" className="vg-panel" aria-label="Conversa com o Vigyon" style={{ scrollMarginTop: 80 }}>
            <div className="vg-panel-head">
              <strong className="mr-auto flex items-center gap-2"><AudioLines size={20} /> VIGYON <span className="vg-muted">/ Conversa</span></strong>
              <label className="flex items-center gap-2"><input type="checkbox" checked={voiceReply} onChange={(e) => setVoiceReply(e.target.checked)} />Responder em voz</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />Enviar ao parar de falar</label>
              <label className="flex items-center gap-2">Velocidade
                <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="h-9 px-2">
                  <option value={0.9}>lenta</option><option value={1}>normal</option><option value={1.2}>rápida</option>
                </select>
              </label>
              {speaking && <Button className="vg-btn vg-btn-ghost" onClick={stopAudio}><Square /> Parar áudio</Button>}
              <Button className="vg-btn vg-btn-ghost" onClick={newChat}><Plus /> Nova conversa</Button>
            </div>

            <div className="vg-log" ref={logRef} role="log" aria-live="polite" aria-label="Mensagens">
              {msgs.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="vg-msg vg-user">{m.text}</div>
                ) : (
                  <div key={m.id} className="vg-msg vg-bot">
                    <BotText text={m.text} />
                    <div className="mt-2 flex gap-2">
                      <Button className="vg-btn-sm" onClick={() => speak(m.text)} title="Ouvir resposta" aria-label="Ouvir resposta"><Volume2 /></Button>
                      <Button className="vg-btn-sm" onClick={() => copy(m)} title={copied === m.id ? "Copiado" : "Copiar"} aria-label={copied === m.id ? "Copiado" : "Copiar"}><Copy /></Button>
                    </div>
                  </div>
                ),
              )}
              {busy && <div className="vg-msg vg-bot vg-muted">Vigyon está pensando…</div>}
            </div>

            <form className="vg-composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <label htmlFor="q" className="sr-only">Sua pergunta</label>
              <textarea id="q" rows={2} maxLength={1500} className="vg-input" placeholder="Digite ou fale sua pergunta…"
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
              <Button type="button" className="vg-mic" aria-pressed={listening} aria-label={listening ? "Parar de ouvir" : "Falar pelo microfone"} onClick={toggleMic}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </Button>
              <Button type="submit" className="vg-btn vg-btn-primary" style={{ minHeight: 52 }} disabled={busy || !input.trim()} aria-label="Enviar"><ArrowUp /></Button>
            </form>
            <div className="vg-status" aria-live="polite"><span className="vg-dot" data-s={status.s} />{status.text}</div>
          </section>
        </section>

        <section id="temas" className="vg-wrap py-16" style={{ scrollMarginTop: 64 }}>
          <p className="vg-eyebrow mb-3">02 / ÁREAS DE ATUAÇÃO</p><h2 className="vg-display vg-h2 mb-6">Explore. Questione. Previna.</h2>
          <div className="vg-topics">
            {TOPICS.map(([title, tag, q]) => (
              <Button key={title} className="vg-topic" onClick={() => { goChat(); send(q); }}>
                <span>{title}</span><span className="flex items-center gap-3"><span className="vg-tag">{tag}</span><ArrowUpRight size={18} /></span>
              </Button>
            ))}
          </div>
        </section>

      </main>

      <footer className="border-t">
        <div className="vg-wrap py-8 text-sm vg-muted flex flex-col gap-2">
          <p>O Vigyon apoia a decisão e não substitui o profissional de SST responsável. Confirme normas e limites na fonte oficial vigente antes de autorizar qualquer atividade.</p>
          <p>O microfone só é ativado quando você toca no botão.</p>
        </div>
      </footer>

      <dialog ref={dialogRef} className="vg-dialog" aria-labelledby="login-t">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setLoginMsg("Informe um e-mail válido."); return; }
          setLoginMsg("Demonstração: o login ainda não está conectado ao backend.");
        }} className="flex flex-col gap-4">
          <h2 id="login-t" className="vg-display text-3xl">Entrar</h2>
          <label className="flex flex-col gap-1 text-sm font-medium">E-mail
            <input type="email" className="vg-input h-11 px-3 text-base" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {loginMsg && <p className="text-sm vg-muted" role="status">{loginMsg}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="vg-btn vg-btn-primary">Receber link de acesso</Button>
            <Button type="button" className="vg-btn vg-btn-outline" onClick={() => dialogRef.current?.close()}>Fechar</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
