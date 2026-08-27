"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Level = "beginner" | "intermediate" | "advanced";
type Mode = "voice" | "quiz" | "essay" | "scenario";
type Persona = "sarah" | "alex" | "david" | "emma";

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  roastWrong: string;
}

interface EssayEvaluation {
  overallBandScore: string;
  overallScore100: number;
  roastReview: string;
  strengths: string[];
  weaknesses: string[];
  grammarCorrections: Array<{
    original: string;
    corrected: string;
    explanation: string;
  }>;
  lexicalSuggestions: Array<{
    simpleWord: string;
    advancedWord: string;
    exampleUsage: string;
  }>;
  perfectedDraft: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tip?: string | null;
  roast?: string | null;
  score?: number;
}

const PERSONAS: Array<{ id: Persona; name: string; tag: string; desc: string }> = [
  { id: "sarah", name: "Sarah", tag: "British Casual", desc: "Ramah, sopan, aksen London natural" },
  { id: "alex", name: "Alex", tag: "American Slang", desc: "Santai, banyak ungkapan modern California" },
  { id: "david", name: "David", tag: "Tech Recruiter", desc: "Wawancara kerja profesional & tajam" },
  { id: "emma", name: "Emma", tag: "IELTS Coach", desc: "Latihan speaking & alur berpikir kritis" },
];

const SCENARIOS = [
  { id: "job_interview", title: "Wawancara Kerja", desc: "Pertanyaan background, kelemahan, dan ekspektasi gaji" },
  { id: "airport_immigration", title: "Bandara & Imigrasi", desc: "Pemeriksaan paspor, visa, dan tujuan perjalanan" },
  { id: "ordering_cafe", title: "Pesan Kopi di Kafe", desc: "Pilihan beans, customize minuman, dan pembayaran" },
  { id: "salary_negotiation", title: "Negosiasi Gaji", desc: "Menyampaikan value dan meminta penawaran lebih tinggi" },
  { id: "hotel_checkin", title: "Check-in Hotel", desc: "Konfirmasi reservasi, request kamar, dan fasilitas" },
];

const ESSAY_TOPICS = [
  "Dampak Artificial Intelligence terhadap lapangan pekerjaan masa depan",
  "Pentingnya kemampuan konten kreator di era ekonomi digital",
  "Kelebihan dan kekurangan sistem kerja Work From Home (WFH)",
  "Apakah gelar sarjana masih relevan untuk sukses di industri teknologi?",
];

export function LancarBahasa({ cost = 2, credits = 0 }: { cost?: number; credits?: number }) {
  const [mode, setMode] = useState<Mode>("voice");
  const [level, setLevel] = useState<Level>("intermediate");
  const [persona, setPersona] = useState<Persona>("sarah");
  const [scenario, setScenario] = useState<string>("daily");
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Voice Call States
  const [isCalling, setIsCalling] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTip, setActiveTip] = useState<string | null>(null);
  const [activeRoast, setActiveRoast] = useState<string | null>(null);
  const [showCallSummary, setShowCallSummary] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Quiz States
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizTopic, setQuizTopic] = useState("grammar_tenses");

  // Essay States
  const [essayTopic, setEssayTopic] = useState(ESSAY_TOPICS[0]);
  const [essayText, setEssayText] = useState("");
  const [essayLoading, setEssayLoading] = useState(false);
  const [essayResult, setEssayResult] = useState<EssayEvaluation | null>(null);

  // Play Speech Audio via /api/tts with browser fallback
  const playSpeechAudio = useCallback(
    async (text: string) => {
      try {
        if (currentAudioElementRef.current) {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current = null;
        }

        setIsPlayingAudio(true);
        const langCode = persona === "sarah" || persona === "emma" ? "en-GB" : "en-US";

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: langCode }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioElementRef.current = audio;
          audio.onended = () => {
            setIsPlayingAudio(false);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            setIsPlayingAudio(false);
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("API TTS playback failed, falling back to Web Speech:", err);
      }

      // Fallback: Web Speech Synthesis
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = persona === "sarah" || persona === "emma" ? "en-GB" : "en-US";
        utterance.rate = level === "beginner" ? 0.85 : 1.0;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
      }
    },
    [persona, level],
  );

  // Timer Effect for Call
  useEffect(() => {
    if (!isCalling) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCalling]);

  // Audio Visualizer Waveform Animation Loop
  useEffect(() => {
    if (!isCalling) return;

    let animId: number;

    const renderWaveform = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const width = canvas.width;
          const height = canvas.height;
          const barWidth = 4;
          const gap = 3;
          const barCount = Math.floor(width / (barWidth + gap));
          const time = Date.now() * 0.005;

          for (let i = 0; i < barCount; i++) {
            const freq = Math.sin(time + i * 0.3) * 0.5 + 0.5;
            const barHeight = isRecording
              ? Math.max(6, freq * (height * 0.85))
              : isPlayingAudio
              ? Math.max(6, Math.sin(time * 3 + i * 0.4) * (height * 0.75))
              : isProcessing
              ? Math.max(4, Math.sin(time * 2 + i * 0.2) * (height * 0.45))
              : 4;

            const x = i * (barWidth + gap);
            const y = (height - barHeight) / 2;

            ctx.fillStyle = isRecording
              ? "#ef4444"
              : isPlayingAudio
              ? "#10b981"
              : isProcessing
              ? "#3b82f6"
              : "#3f3f46";
            ctx.fillRect(x, y, barWidth, barHeight);
          }
        }
      }
      animId = requestAnimationFrame(renderWaveform);
    };

    animId = requestAnimationFrame(renderWaveform);
    return () => cancelAnimationFrame(animId);
  }, [isCalling, isRecording, isProcessing, isPlayingAudio]);

  // Start Voice Call & Play Opening Audio
  const startCall = (customScenario?: string) => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    if (customScenario) setScenario(customScenario);
    setCallDuration(0);
    setIsCalling(true);
    setShowCallSummary(false);
    setFeedbackNotice(null);
    setLiveTranscript("");

    const initialText =
      persona === "sarah"
        ? "Hello there! So lovely to talk with you today. How is your day going so far?"
        : persona === "alex"
        ? "Hey what is up! Super stoked to chat. What have you been working on lately?"
        : persona === "david"
        ? "Good day. Thank you for joining this interview session. Could you briefly introduce yourself?"
        : "Welcome to today's speaking preparation. Let us begin with your thoughts on our topic.";

    setMessages([
      {
        id: "msg_init",
        role: "assistant",
        text: initialText,
      },
    ]);

    // Auto-play voice greeting
    playSpeechAudio(initialText);
  };

  // End Voice Call
  const endCall = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsRecording(false);
    setIsCalling(false);
    setIsPlayingAudio(false);
    setShowCallSummary(true);
  };

  // Toggle Recording via MediaRecorder
  const toggleRecording = async () => {
    if (isProcessing) return;

    if (isRecording) {
      // Stop and send audio
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start Recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : "";

        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          await submitAudioChunk(audioBlob);
        };

        mediaRecorder.start();
        setIsRecording(true);
        setFeedbackNotice(null);
      } catch (err) {
        console.error("Mic access error:", err);
        setFeedbackNotice("Izin mikrofon belum aktif. Lo juga bisa ketik pesan langsung di kolom teks bawah.");
      }
    }
  };

  // Submit Audio Blob to /api/speaking/converse
  const submitAudioChunk = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setFeedbackNotice(null);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "user_voice.webm");
      formData.append("persona", persona);
      formData.append("level", level);
      formData.append("scenario", scenario);
      formData.append(
        "history",
        JSON.stringify(
          messages.map((m) => ({ role: m.role, text: m.text })),
        ),
      );

      const res = await fetch("/api/speaking/converse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memproses percakapan.");
      }

      const data = await res.json();

      // Add user message & AI response
      const newMessages: ChatMessage[] = [
        ...messages,
        {
          id: `usr_${Date.now()}`,
          role: "user",
          text: data.userTranscribedText,
        },
        {
          id: `ast_${Date.now()}`,
          role: "assistant",
          text: data.replyEn,
          tip: data.correctionTip,
          roast: data.roastComment,
          score: data.fluencyScore,
        },
      ];

      setMessages(newMessages);
      if (data.correctionTip) setActiveTip(data.correctionTip);
      if (data.roastComment) setActiveRoast(data.roastComment);

      // Play audio response
      playSpeechAudio(data.replyEn);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Text Input fallback
  const submitTextMessage = async () => {
    if (!textInput.trim() || isProcessing) return;
    const userText = textInput.trim();
    setTextInput("");
    setIsProcessing(true);
    setFeedbackNotice(null);

    try {
      const res = await fetch("/api/speaking/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          persona,
          level,
          scenario,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memproses percakapan.");
      }

      const data = await res.json();

      const newMessages: ChatMessage[] = [
        ...messages,
        {
          id: `usr_${Date.now()}`,
          role: "user",
          text: userText,
        },
        {
          id: `ast_${Date.now()}`,
          role: "assistant",
          text: data.replyEn,
          tip: data.correctionTip,
          roast: data.roastComment,
          score: data.fluencyScore,
        },
      ];

      setMessages(newMessages);
      if (data.correctionTip) setActiveTip(data.correctionTip);
      if (data.roastComment) setActiveRoast(data.roastComment);

      // Play audio response
      playSpeechAudio(data.replyEn);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses percakapan.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Quiz
  const handleGenerateQuiz = async () => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    setQuizLoading(true);
    setQuizFinished(false);
    setSelectedAnswers({});
    setCurrentQuestionIdx(0);
    setFeedbackNotice(null);
    try {
      const res = await fetch("/api/speaking/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic: quizTopic }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal membuat kuis.");
      }
      const data = await res.json();
      setQuizQuestions(data.questions || []);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Gagal memuat kuis.");
    } finally {
      setQuizLoading(false);
    }
  };

  // Evaluate Essay
  const handleEvaluateEssay = async () => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    if (!essayText.trim() || essayText.trim().length < 20) {
      setFeedbackNotice("Tulis esai minimal 20 karakter sebelum dievaluasi.");
      return;
    }

    setEssayLoading(true);
    setEssayResult(null);
    setFeedbackNotice(null);
    try {
      const res = await fetch("/api/speaking/essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level, topic: essayTopic, essayText }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal mengevaluasi esai.");
      }
      const data = await res.json();
      setEssayResult(data.data);
      setFeedbackNotice("Evaluasi esai berhasil diselesaikan.");
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Gagal mengevaluasi esai.");
    } finally {
      setEssayLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="w-full space-y-6">
      {/* GLOBAL FEEDBACK BANNER */}
      {feedbackNotice && (
        <div className="rounded-2xl border border-ember/40 bg-ember/15 p-4 text-xs sm:text-sm font-medium text-ember flex items-center justify-between animate-in fade-in duration-200">
          <span>{feedbackNotice}</span>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-micro font-bold underline hover:opacity-80 ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* HEADER BAR */}
      <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/80 p-5 sm:p-6 backdrop-blur-xl shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/30 bg-ember/15 px-3 py-0.5 text-[11px] font-bold text-ember uppercase tracking-wider">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3 text-ember">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                AI Language Studio
              </span>
              <span className="text-micro font-mono text-muted bg-surface-raised px-2 py-0.5 rounded-md border border-hairline">
                {cost} Kredit / Sesi
              </span>
            </div>
            <h1 className="mt-2 font-display text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Lancar Bahasa
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
              Latihan bicara suara interaktif, kuis kilat, dan ujian esai dengan koreksi real-time &amp; humor cerdas.
            </p>
          </div>

          {/* LEVEL SELECTION PILLS */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-hairline bg-surface-raised p-1.5">
            {[
              { id: "beginner", label: "Pemula" },
              { id: "intermediate", label: "Menengah" },
              { id: "advanced", label: "Mahir" },
            ].map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setLevel(lvl.id as Level)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  level === lvl.id
                    ? "bg-ember text-obsidian shadow-sm"
                    : "text-muted hover:text-ink hover:bg-surface"
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* MODE NAVIGATION TABS */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-hairline/60 pt-4">
          {[
            { id: "voice", label: "Panggilan Suara", sub: "Live Speaking Call" },
            { id: "quiz", label: "Kuis Kilat", sub: "Multiple Choice Quiz" },
            { id: "essay", label: "Ujian Esai", sub: "Writing & IELTS Evaluator" },
            { id: "scenario", label: "Simulasi Skenario", sub: "Real Roleplay" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (isCalling) endCall();
                setMode(tab.id as Mode);
              }}
              className={`flex flex-col items-start rounded-2xl border px-4 py-2.5 transition-all text-left min-w-[140px] sm:min-w-[160px] ${
                mode === tab.id
                  ? "border-ember/60 bg-ember/10 text-ink shadow-sm"
                  : "border-hairline bg-surface hover:border-hairline/90 hover:bg-surface-raised text-muted"
              }`}
            >
              <span className={`text-xs font-bold ${mode === tab.id ? "text-ember" : "text-ink"}`}>
                {tab.label}
              </span>
              <span className="text-[10px] text-muted">{tab.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: PANGGILAN SUARA (LIVE SPEAKING CALL) */}
      {/* ========================================================================= */}
      {mode === "voice" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-6">
          {!isCalling && !showCallSummary ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Pilih Partner Bicara AI
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Setiap karakter memiliki aksen dan gaya bahasa yang berbeda.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPersona(p.id)}
                    className={`rounded-2xl border p-4 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                      persona === p.id
                        ? "border-ember bg-ember/10 shadow-md ring-1 ring-ember/30"
                        : "border-hairline bg-surface-raised/60 hover:border-hairline/90"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold text-ink">{p.name}</span>
                        <span className="text-[10px] font-mono font-bold text-ember bg-ember/15 px-2 py-0.5 rounded-md">
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-micro text-muted mt-2 leading-relaxed">{p.desc}</p>
                    </div>
                    {persona === p.id && (
                      <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-ember">
                        <span className="size-1.5 rounded-full bg-ember" /> Dipilih
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-hairline/60 bg-surface-raised/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-ink">Tips Latihan Suara:</h4>
                  <p className="text-micro text-muted mt-0.5">
                    Bicara santai tanpa takut salah. AI akan langsung membalas dengan suara dan memberikan koreksi halus di layar.
                  </p>
                </div>
                <button
                  onClick={() => startCall()}
                  className="btn-ember shrink-0 h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105"
                >
                  Mulai Panggilan Suara →
                </button>
              </div>
            </div>
          ) : isCalling ? (
            /* ACTIVE PHONE CALL SCREEN */
            <div className="space-y-6">
              {/* Call Top Bar */}
              <div className="flex items-center justify-between border-b border-hairline/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full border border-ember/40 bg-ember/20 flex items-center justify-center text-ember font-display font-bold text-sm">
                    {persona.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-ink capitalize">
                      {persona} ({PERSONAS.find((p) => p.id === persona)?.tag})
                    </h3>
                    <p className="text-micro text-emerald-400 font-mono flex items-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                      Terhubung • {formatSeconds(callDuration)}
                      {isPlayingAudio && <span className="text-ember font-bold ml-1.5">• Sedang berbicara...</span>}
                    </p>
                  </div>
                </div>

                <button
                  onClick={endCall}
                  className="h-9 px-4 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-400 text-xs font-bold hover:bg-rose-500/25 transition-all"
                >
                  Akhiri Panggilan
                </button>
              </div>

              {/* Real-time Tips & Roast Alert Badges */}
              {(activeTip || activeRoast) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  {activeTip && (
                    <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
                      <p className="font-bold text-sky-400 text-micro uppercase tracking-wider">Koreksi Grammar Halus:</p>
                      <p className="text-ink mt-0.5 font-medium">{activeTip}</p>
                    </div>
                  )}
                  {activeRoast && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                      <p className="font-bold text-amber-400 text-micro uppercase tracking-wider">Catatan Humoris Malesan:</p>
                      <p className="text-ink mt-0.5 font-medium italic">&ldquo;{activeRoast}&rdquo;</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chat / Transcript Stream */}
              <div className="h-64 sm:h-72 overflow-y-auto rounded-2xl border border-hairline/60 bg-surface-raised/40 p-4 space-y-3 custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                        m.role === "user"
                          ? "bg-ember text-obsidian font-medium rounded-tr-xs"
                          : "border border-hairline/80 bg-surface text-ink rounded-tl-xs shadow-xs"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span>{m.text}</span>
                        {m.role === "assistant" && (
                          <button
                            type="button"
                            onClick={() => playSpeechAudio(m.text)}
                            title="Putar suara"
                            className="shrink-0 text-muted hover:text-ember transition-colors p-0.5"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {m.score && m.role === "assistant" && (
                      <span className="text-[10px] text-muted mt-1 px-1 font-mono">
                        Skor Kelancaran: {m.score}/100
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Kinetic Waveform Canvas */}
              <div className="rounded-2xl border border-hairline/60 bg-surface-raised p-3 flex flex-col items-center justify-center">
                <canvas ref={canvasRef} width={400} height={50} className="w-full h-12" />
                <p className="text-[11px] font-mono text-muted mt-1">
                  {isRecording
                    ? "Mendengarkan suara lo... Tekan tombol merah untuk kirim"
                    : isPlayingAudio
                    ? "Partner AI sedang berbicara..."
                    : isProcessing
                    ? "AI sedang memikirkan balasan..."
                    : "Bicara lewat mikrofon atau ketik pesan di bawah"}
                </p>
              </div>

              {/* Controls Bar: Dual-Mode Audio Mic + Quick Text Box */}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isProcessing}
                    className={`h-14 px-8 rounded-2xl font-display text-sm font-bold transition-all flex items-center gap-2.5 shadow-lg ${
                      isRecording
                        ? "bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30"
                        : isProcessing
                        ? "bg-surface-raised text-muted cursor-not-allowed border border-hairline"
                        : "bg-ember text-obsidian hover:brightness-105"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                    {isRecording
                      ? "Selesai Bicara (Kirim Obrolan)"
                      : isProcessing
                      ? "Memproses Suara..."
                      : "Tekan untuk Mulai Bicara"}
                  </button>
                </div>

                {/* Instant Text Input Alternative */}
                <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface-raised p-1.5 focus-within:border-ember/60 transition-all">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitTextMessage();
                      }
                    }}
                    placeholder="Atau ketik pesan bahasa Inggris di sini..."
                    disabled={isProcessing}
                    className="flex-1 bg-transparent px-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitTextMessage}
                    disabled={!textInput.trim() || isProcessing}
                    className="btn-ember h-9 px-4 rounded-xl font-display text-xs font-bold text-obsidian disabled:opacity-50"
                  >
                    Kirim
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* POST-CALL SCORECARD */
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="border-b border-hairline/60 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Rapor Selesai Percakapan
                  </h3>
                  <p className="text-xs text-muted">Durasi Panggilan: {formatSeconds(callDuration)}</p>
                </div>
                <button
                  onClick={() => setShowCallSummary(false)}
                  className="btn-ember h-9 px-4 rounded-xl text-xs font-bold text-obsidian"
                >
                  Panggilan Baru
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-hairline bg-surface-raised p-4 text-center">
                  <p className="text-micro font-bold text-muted uppercase tracking-wider">Total Kalimat</p>
                  <p className="font-display text-2xl font-bold text-ink mt-1">
                    {messages.filter((m) => m.role === "user").length}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <p className="text-micro font-bold text-emerald-400 uppercase tracking-wider">Rata-rata Skor</p>
                  <p className="font-display text-2xl font-bold text-emerald-400 mt-1">82/100</p>
                </div>
                <div className="rounded-2xl border border-ember/30 bg-ember/10 p-4 text-center">
                  <p className="text-micro font-bold text-ember uppercase tracking-wider">Koreksi Diberikan</p>
                  <p className="font-display text-2xl font-bold text-ember mt-1">
                    {messages.filter((m) => m.tip).length} Catatan
                  </p>
                </div>
              </div>

              {/* Transcript History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Rangkuman Obrolan:</h4>
                <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-4 space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                  {messages.map((m) => (
                    <div key={m.id} className="text-xs">
                      <span className="font-bold text-ember capitalize">{m.role === "user" ? "Lo" : persona}: </span>
                      <span className="text-ink">{m.text}</span>
                      {m.tip && (
                        <p className="text-micro text-sky-400 mt-0.5 ml-4 font-medium">Tip: {m.tip}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: KUIS KILAT (MULTIPLE CHOICE QUIZ) */}
      {/* ========================================================================= */}
      {mode === "quiz" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-6">
          {quizQuestions.length === 0 ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Kuis Kilat Bahasa Inggris
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Uji pemahaman tenses, idiom, dan perbaikan kalimat dengan kuis cerdas 5 soal.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "grammar_tenses", title: "Tenses & Grammar", desc: "Past, Present, Perfect, & Conditionals" },
                  { id: "idioms_phrases", title: "Idioms & Phrasal Verbs", desc: "Ungkapan sehari-hari penutur asli" },
                  { id: "error_spotting", title: "Error Spotting", desc: "Cari letak kesalahan dalam kalimat" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setQuizTopic(t.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      quizTopic === t.id
                        ? "border-ember bg-ember/10 shadow-sm ring-1 ring-ember/30"
                        : "border-hairline bg-surface-raised/60 hover:border-hairline/90"
                    }`}
                  >
                    <p className="font-display text-sm font-bold text-ink">{t.title}</p>
                    <p className="text-micro text-muted mt-1">{t.desc}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerateQuiz}
                disabled={quizLoading}
                className="btn-ember h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105"
              >
                {quizLoading ? "Menyiapkan Soal Kuis..." : "Mulai Kuis 5 Soal →"}
              </button>
            </div>
          ) : !quizFinished ? (
            /* ACTIVE QUIZ QUESTION */
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3">
                <span className="text-xs font-bold text-ember uppercase tracking-wider">
                  Soal {currentQuestionIdx + 1} dari {quizQuestions.length}
                </span>
                <span className="text-micro text-muted font-mono">Tingkat: {level.toUpperCase()}</span>
              </div>

              {quizQuestions[currentQuestionIdx] && (
                <div className="space-y-4">
                  <h3 className="font-display text-base sm:text-lg font-bold text-ink leading-relaxed">
                    {quizQuestions[currentQuestionIdx].question}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quizQuestions[currentQuestionIdx].options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIdx] === optIdx;
                      const isAnswered = selectedAnswers[currentQuestionIdx] !== undefined;
                      const isCorrect = optIdx === quizQuestions[currentQuestionIdx].correctIndex;

                      let btnStyle = "border-hairline bg-surface hover:border-hairline/90 text-ink";
                      if (isAnswered) {
                        if (isCorrect) btnStyle = "border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold";
                        else if (isSelected) btnStyle = "border-rose-500 bg-rose-500/15 text-rose-400 font-bold";
                        else btnStyle = "border-hairline/40 bg-surface/40 text-muted opacity-50";
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isAnswered}
                          onClick={() => {
                            setSelectedAnswers((prev) => ({ ...prev, [currentQuestionIdx]: optIdx }));
                          }}
                          className={`rounded-2xl border p-4 text-left text-xs sm:text-sm transition-all ${btnStyle}`}
                        >
                          <span className="font-mono font-bold mr-2 text-muted">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation & Roast Box */}
                  {selectedAnswers[currentQuestionIdx] !== undefined && (
                    <div className="rounded-2xl border border-hairline bg-surface-raised p-4 space-y-2 animate-in fade-in duration-200">
                      {selectedAnswers[currentQuestionIdx] === quizQuestions[currentQuestionIdx].correctIndex ? (
                        <p className="text-xs font-bold text-emerald-400">Jawaban Benar!</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-rose-400">Jawaban Kurang Tepat!</p>
                          <p className="text-xs text-amber-400 italic">
                            &ldquo;{quizQuestions[currentQuestionIdx].roastWrong}&rdquo;
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted leading-relaxed">
                        <b>Penjelasan:</b> {quizQuestions[currentQuestionIdx].explanation}
                      </p>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex justify-end gap-2 pt-2">
                    {currentQuestionIdx < quizQuestions.length - 1 ? (
                      <button
                        disabled={selectedAnswers[currentQuestionIdx] === undefined}
                        onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                        className="btn-ember h-10 px-5 rounded-xl text-xs font-bold text-obsidian disabled:opacity-50"
                      >
                        Soal Berikutnya →
                      </button>
                    ) : (
                      <button
                        disabled={selectedAnswers[currentQuestionIdx] === undefined}
                        onClick={() => setQuizFinished(true)}
                        className="btn-ember h-10 px-5 rounded-xl text-xs font-bold text-obsidian disabled:opacity-50"
                      >
                        Lihat Skor Akhir →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* QUIZ SUMMARY */
            <div className="space-y-6 text-center animate-in fade-in duration-300">
              <h3 className="font-display text-xl font-bold text-ink">Hasil Kuis Lo</h3>
              {(() => {
                let correctCount = 0;
                quizQuestions.forEach((q, idx) => {
                  if (selectedAnswers[idx] === q.correctIndex) correctCount++;
                });
                const score = (correctCount / quizQuestions.length) * 100;

                return (
                  <div className="space-y-4">
                    <div className="size-24 rounded-full border-2 border-ember bg-ember/15 mx-auto flex items-center justify-center font-display text-2xl font-bold text-ember">
                      {score}%
                    </div>
                    <p className="text-xs text-muted">
                      Lo berhasil menjawab benar <b>{correctCount}</b> dari <b>{quizQuestions.length}</b> soal.
                    </p>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={handleGenerateQuiz}
                        className="btn-ember h-10 px-5 rounded-xl text-xs font-bold text-obsidian"
                      >
                        Ulang Kuis Baru
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: UJIAN ESAI (ESSAY EVALUATION) */}
      {/* ========================================================================= */}
      {mode === "essay" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-6">
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Ujian Esai &amp; Evaluasi Tulisan Bahasa Inggris
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Tulis paragraf opini atau esai lo, AI akan membedah tata bahasa, skor setara IELTS, dan memberikan draf sempurna.
            </p>
          </div>

          {/* Topic selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-ink">Pilih Topik atau Tulis Topik Sendiri:</label>
            <div className="flex flex-wrap gap-2">
              {ESSAY_TOPICS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setEssayTopic(t)}
                  className={`rounded-xl border px-3 py-1.5 text-xs text-left transition-all ${
                    essayTopic === t
                      ? "border-ember bg-ember/15 text-ember font-bold"
                      : "border-hairline bg-surface-raised/60 text-muted hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink">Tulis Esai Bahasa Inggris Lo:</label>
              <span className="text-micro font-mono text-muted">
                {essayText.trim().split(/\s+/).filter(Boolean).length} Kata • {essayText.length} Karakter
              </span>
            </div>
            <textarea
              rows={6}
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
              placeholder="Write your English essay or opinion here (minimum 20 characters)..."
              className="w-full rounded-2xl border border-hairline bg-surface-raised p-4 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:border-ember focus:outline-none transition-all leading-relaxed"
            />
          </div>

          <button
            onClick={handleEvaluateEssay}
            disabled={essayLoading}
            className="btn-ember h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105 disabled:opacity-50"
          >
            {essayLoading ? "Menganalisis Esai..." : "Evaluasi & Bedah Esai Sekarang →"}
          </button>

          {/* Result View */}
          {essayResult && (
            <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-5 space-y-6 animate-in fade-in duration-300">
              {/* Score Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-ember/40 bg-ember/15 p-4 text-center">
                  <p className="text-micro font-bold text-ember uppercase tracking-wider">Estimasi Skor IELTS</p>
                  <p className="font-display text-2xl font-bold text-ember mt-1">
                    Band {essayResult.overallBandScore}
                  </p>
                </div>
                <div className="rounded-2xl border border-hairline bg-surface p-4 text-center">
                  <p className="text-micro font-bold text-muted uppercase tracking-wider">Nilai Keseluruhan</p>
                  <p className="font-display text-2xl font-bold text-ink mt-1">
                    {essayResult.overallScore100} / 100
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                  <p className="text-micro font-bold text-amber-400 uppercase tracking-wider">Koreksi Grammar</p>
                  <p className="font-display text-2xl font-bold text-amber-400 mt-1">
                    {essayResult.grammarCorrections?.length || 0} Poin
                  </p>
                </div>
              </div>

              {/* Roast / Humor Box */}
              {essayResult.roastReview && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
                  <p className="font-bold text-amber-400 text-micro uppercase tracking-wider">Catatan Roasting Malesan:</p>
                  <p className="text-ink mt-1 font-medium italic">&ldquo;{essayResult.roastReview}&rdquo;</p>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Kekuatan Tulisan:</p>
                  <ul className="space-y-1 text-xs text-ink list-disc list-inside">
                    {essayResult.strengths?.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
                  <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Kelemahan &amp; Area Perbaikan:</p>
                  <ul className="space-y-1 text-xs text-ink list-disc list-inside">
                    {essayResult.weaknesses?.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Perfected Rewrite Draft */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-ink uppercase tracking-wider">Versi Draf Sempurna (High-Level Rewrite):</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(essayResult.perfectedDraft);
                      setFeedbackNotice("Draf sempurna berhasil disalin ke clipboard.");
                    }}
                    className="text-micro font-bold text-ember hover:underline"
                  >
                    Salin Draf
                  </button>
                </div>
                <div className="rounded-2xl border border-hairline bg-surface p-4 text-xs sm:text-sm text-ink leading-relaxed font-serif">
                  {essayResult.perfectedDraft}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 4: SIMULASI SKENARIO (ROLEPLAY) */}
      {/* ========================================================================= */}
      {mode === "scenario" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-6">
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Pilih Skenario Percakapan Nyata
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Latihan situasi realistis di dunia nyata untuk meningkatkan kepercayaan diri bicara.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {SCENARIOS.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-hairline bg-surface-raised p-4 flex flex-col justify-between space-y-3 hover:border-ember/40 transition-all"
              >
                <div>
                  <h4 className="font-display text-sm font-bold text-ink">{s.title}</h4>
                  <p className="text-micro text-muted mt-1 leading-relaxed">{s.desc}</p>
                </div>
                <button
                  onClick={() => {
                    setMode("voice");
                    startCall(s.title);
                  }}
                  className="btn-ember h-9 px-4 rounded-xl text-micro font-bold text-obsidian shadow-sm hover:brightness-105"
                >
                  Mulai Simulasi →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
