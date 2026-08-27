"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Level = "beginner" | "intermediate" | "advanced";
type Mode = "voice" | "scenario" | "quiz" | "essay" | "progress";
type Persona = "sarah" | "alex" | "david" | "emma";

interface SuggestedReply {
  en: string;
  id: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  translateId?: string | null;
  suggestedReplies?: SuggestedReply[];
  tip?: string | null;
  pitfallTag?: string | null;
  roast?: string | null;
  score?: number;
}

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

interface ScenarioItem {
  id: string;
  title: string;
  partner: Persona;
  context: string;
  missions: string[];
}

interface SessionRecord {
  id: string;
  timestamp: number;
  type: "voice" | "scenario" | "quiz" | "essay";
  title: string;
  score: number;
  durationSeconds?: number;
  pitfalls?: string[];
}

// Global Speech Recognition API Interfaces
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const PERSONAS: Array<{ id: Persona; name: string; tag: string; desc: string }> = [
  { id: "sarah", name: "Sarah", tag: "British Casual", desc: "Ramah, sopan, aksen London natural" },
  { id: "alex", name: "Alex", tag: "American Slang", desc: "Santai, banyak ungkapan modern California" },
  { id: "david", name: "David", tag: "Tech Recruiter", desc: "Wawancara kerja profesional & tajam" },
  { id: "emma", name: "Emma", tag: "IELTS Coach", desc: "Latihan speaking & alur berpikir kritis" },
];

const SCENARIOS: ScenarioItem[] = [
  {
    id: "job_interview",
    title: "Wawancara Kerja Global",
    partner: "david",
    context: "Kamu sedang diwawancarai oleh Senior Tech Recruiter untuk posisi internasional.",
    missions: [
      "Perkenalkan diri dan keahlian utamamu",
      "Jelaskan pengalaman proyek yang paling membanggakan",
      "Sampaikan ekspektasi gaji dan gaya kerjamu",
    ],
  },
  {
    id: "airport_immigration",
    title: "Pemeriksaan Bandara & Imigrasi",
    partner: "sarah",
    context: "Kamu baru mendarat di London Heathrow dan petugas menanyakan tujuan perjalananmu.",
    missions: [
      "Jawab tujuan kedatangan dan lama tinggal",
      "Tunjukkan tempat menginap / reservasi hotel",
      "Jelaskan pekerjaanmu di Indonesia",
    ],
  },
  {
    id: "ordering_cafe",
    title: "Pesan Kopi & Makanan di Kafe",
    partner: "alex",
    context: "Kamu sedang antre di kafe hipster San Francisco dan memesan minuman khusus.",
    missions: [
      "Pesan kopi dengan susu oat dan sedikit gula",
      "Tanya rekomendasi roti/pastry terbaik",
      "Bayar menggunakan kartu non-tunai",
    ],
  },
  {
    id: "salary_negotiation",
    title: "Negosiasi Kenaikan Gaji",
    partner: "david",
    context: "Kamu melakukan sesi 1-on-1 dengan manajer untuk meminta penyesuaian kompensasi.",
    missions: [
      "Ungkapkan kontribusi dan hasil kerjamu tahun ini",
      "Tunjukkan riset standar gaji industri",
      "Capai kesepakatan win-win yang memuaskan",
    ],
  },
  {
    id: "hotel_checkin",
    title: "Check-in Hotel & Request Kamar",
    partner: "emma",
    context: "Kamu tiba di hotel bintang lima dan ingin check-in dengan request lantai tinggi.",
    missions: [
      "Sebutkan nama reservasi dan tunjukkan paspor",
      "Minta kamar bebas rokok dengan pemandangan kota",
      "Tanyakan jadwal sarapan dan fasilitas gym",
    ],
  },
  {
    id: "freelance_client",
    title: "Diskusi Proyek Klien Freelance",
    partner: "alex",
    context: "Klien luar negeri menghubungimu untuk merekrut jasamu dalam proyek kreatif.",
    missions: [
      "Jelaskan alur kerjamu dan estimasi waktu pengerjaan",
      "Sampaikan rate harga jasa dan opsi revisi",
      "Sepakati tenggat waktu dan pembayaran deposit",
    ],
  },
];

const ESSAY_TOPICS = [
  "Dampak Artificial Intelligence terhadap lapangan pekerjaan masa depan",
  "Pentingnya kemampuan konten kreator di era ekonomi digital",
  "Kelebihan dan kekurangan sistem kerja Work From Home (WFH)",
  "Apakah gelar sarjana masih relevan untuk sukses di industri teknologi?",
  "Pengaruh media sosial terhadap kesehatan mental generasi muda",
];

export function LancarBahasa({ cost = 2, credits = 0 }: { cost?: number; credits?: number }) {
  const [mode, setMode] = useState<Mode>("voice");
  const [level, setLevel] = useState<Level>("intermediate");
  const [persona, setPersona] = useState<Persona>("sarah");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Voice & Roleplay Call States
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
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  // Active Roleplay Scenario State
  const [activeScenario, setActiveScenario] = useState<ScenarioItem | null>(null);
  const [completedMissions, setCompletedMissions] = useState<Record<number, boolean>>({});

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturedTextRef = useRef<string>("");

  // Quiz States
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizTopic, setQuizTopic] = useState("grammar_tenses");
  const [quizCount, setQuizCount] = useState<number>(5);

  // Essay States
  const [essayTopic, setEssayTopic] = useState(ESSAY_TOPICS[0]);
  const [essayText, setEssayText] = useState("");
  const [essayLoading, setEssayLoading] = useState(false);
  const [essayResult, setEssayResult] = useState<EssayEvaluation | null>(null);

  // Progress & Learning Analytics State (Stored in LocalStorage)
  const [records, setRecords] = useState<SessionRecord[]>([]);

  // Load records from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("malesan_english_records");
      if (saved) {
        setRecords(JSON.parse(saved));
      }
    } catch {}
  }, []);

  // Save record helper
  const saveSessionRecord = useCallback((rec: Omit<SessionRecord, "id" | "timestamp">) => {
    const newRec: SessionRecord = {
      ...rec,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
    };
    setRecords((prev) => {
      const updated = [newRec, ...prev].slice(0, 50);
      try {
        localStorage.setItem("malesan_english_records", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // Play Speech Audio via /api/tts with browser fallback
  const playSpeechAudio = useCallback(
    async (text: string, customPersona?: Persona) => {
      const activeP = customPersona || persona;
      try {
        if (currentAudioElementRef.current) {
          currentAudioElementRef.current.pause();
          currentAudioElementRef.current = null;
        }

        setIsPlayingAudio(true);
        const langCode = activeP === "sarah" || activeP === "emma" ? "en-GB" : "en-US";

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, lang: langCode }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.playbackRate = playbackSpeed;
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
        utterance.lang = activeP === "sarah" || activeP === "emma" ? "en-GB" : "en-US";
        utterance.rate = playbackSpeed * (level === "beginner" ? 0.85 : 1.0);
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
      }
    },
    [persona, level, playbackSpeed],
  );

  // Timer Effect for Active Call / Roleplay
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
              ? Math.max(8, freq * (height * 0.9))
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

  // Start Voice Call or Scenario Chamber
  const startCall = (scenarioItem?: ScenarioItem) => {
    if (credits < cost) {
      setFeedbackNotice(`Kredit lo kurang (${credits} tersisa). Butuh minimal ${cost} kredit.`);
      return;
    }
    const chosenPersona = scenarioItem ? scenarioItem.partner : persona;
    if (scenarioItem) {
      setActiveScenario(scenarioItem);
      setCompletedMissions({});
    } else {
      setActiveScenario(null);
    }

    setCallDuration(0);
    setIsCalling(true);
    setShowCallSummary(false);
    setFeedbackNotice(null);
    setTextInput("");
    capturedTextRef.current = "";

    const initialText = scenarioItem
      ? scenarioItem.id === "job_interview"
        ? "Hello and welcome. Thank you for joining our interview today. To start, could you please tell me about yourself and your professional background?"
        : scenarioItem.id === "airport_immigration"
        ? "Good day. Passport and entry declaration, please. What is the main purpose of your visit to London today?"
        : scenarioItem.id === "ordering_cafe"
        ? "Hey there! Welcome to Blue Bottle. What can I get started for you today?"
        : scenarioItem.id === "salary_negotiation"
        ? "Good morning. Thanks for setting up this 1-on-1 meeting. What would you like to discuss regarding your compensation?"
        : `Hello! Welcome to our ${scenarioItem.title}. How may I help you today?`
      : chosenPersona === "sarah"
      ? "Hello there! So lovely to talk with you today. How is your day going so far?"
      : chosenPersona === "alex"
      ? "Hey what is up! Super stoked to chat. What have you been working on lately?"
      : chosenPersona === "david"
      ? "Good day. Thank you for joining this session. Could you briefly introduce yourself?"
      : "Welcome to today's speaking preparation. Let us begin with your thoughts on our topic.";

    const initialTranslate = scenarioItem
      ? "Halo dan selamat datang. Ceritakan tentang dirimu dan latar belakang pekerjaanmu untuk memulai."
      : "Halo! Senang bisa berbicara denganmu hari ini. Bagaimana harimu sejauh ini?";

    const initialSuggestions: SuggestedReply[] = scenarioItem
      ? [
          { en: "I am a content creator and digital specialist.", id: "Saya seorang konten kreator dan spesialis digital." },
          { en: "I have worked on several global marketing projects.", id: "Saya telah mengerjakan beberapa proyek pemasaran global." },
          { en: "Could you tell me more about the role?", id: "Bisakah Anda jelaskan lebih banyak tentang posisi ini?" },
        ]
      : [
          { en: "I am doing great today, thanks for asking!", id: "Kabar saya sangat baik hari ini, terima kasih sudah bertanya!" },
          { en: "I have been quite busy with work today.", id: "Saya lumayan sibuk dengan pekerjaan hari ini." },
          { en: "Everything is going smoothly so far.", id: "Semuanya berjalan lancar sejauh ini." },
        ];

    setMessages([
      {
        id: "msg_init",
        role: "assistant",
        text: initialText,
        translateId: initialTranslate,
        suggestedReplies: initialSuggestions,
      },
    ]);

    // Auto-play voice greeting
    playSpeechAudio(initialText, chosenPersona);
  };

  // End Call & Save Progress
  const endCall = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
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

    // Save record to local progress analytics
    const userMsgs = messages.filter((m) => m.role === "user");
    const assistantScores = messages.filter((m) => m.score).map((m) => m.score as number);
    const avgScore = assistantScores.length
      ? Math.round(assistantScores.reduce((a, b) => a + b, 0) / assistantScores.length)
      : 80;
    const collectedPitfalls = messages.filter((m) => m.pitfallTag).map((m) => m.pitfallTag as string);

    if (userMsgs.length > 0) {
      saveSessionRecord({
        type: activeScenario ? "scenario" : "voice",
        title: activeScenario ? activeScenario.title : `Panggilan Suara (${persona.toUpperCase()})`,
        score: avgScore,
        durationSeconds: callDuration,
        pitfalls: collectedPitfalls,
      });
    }
  };

  // Toggle Recording with Web Speech API & MediaRecorder Hybrid
  const toggleRecording = async () => {
    if (isProcessing) return;

    if (isRecording) {
      setIsRecording(false);

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }

      const recognized = capturedTextRef.current.trim() || textInput.trim();
      if (recognized) {
        await submitTextMessage(recognized);
      }
    } else {
      capturedTextRef.current = "";
      setTextInput("");
      setFeedbackNotice(null);

      const activeP = activeScenario ? activeScenario.partner : persona;

      // 1. Try Native Web Speech Recognition
      const SpeechRecognition =
        typeof window !== "undefined"
          ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).SpeechRecognition ||
            (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstanceLike; webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike }).webkitSpeechRecognition
          : null;

      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = activeP === "sarah" || activeP === "emma" ? "en-GB" : "en-US";

          recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let transcript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              transcript += event.results[i][0].transcript;
            }
            if (transcript.trim()) {
              capturedTextRef.current = transcript.trim();
              setTextInput(transcript.trim());
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn("Speech recognition start failed:", e);
        }
      }

      // 2. Also start MediaRecorder for audio backup
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          if (!capturedTextRef.current.trim() && audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, {
              type: mediaRecorder.mimeType || "audio/webm",
            });
            await submitAudioChunk(audioBlob);
          }
        };

        mediaRecorder.start(200);
        setIsRecording(true);
      } catch (err) {
        console.warn("Mic getUserMedia failed:", err);
        setIsRecording(true);
      }
    }
  };

  // Submit Audio Blob to /api/speaking/converse (Whisper STT backend)
  const submitAudioChunk = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setFeedbackNotice(null);
    const activeP = activeScenario ? activeScenario.partner : persona;
    const activeScenTitle = activeScenario ? activeScenario.title : "daily";

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "user_voice.webm");
      formData.append("persona", activeP);
      formData.append("level", level);
      formData.append("scenario", activeScenTitle);
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
          translateId: data.translateId,
          suggestedReplies: data.suggestedReplies,
          tip: data.correctionTip,
          pitfallTag: data.pitfallTag,
          roast: data.roastComment,
          score: data.fluencyScore,
        },
      ];

      setMessages(newMessages);
      if (data.correctionTip) setActiveTip(data.correctionTip);
      if (data.roastComment) setActiveRoast(data.roastComment);

      // Auto-check mission progress for scenarios
      if (activeScenario) {
        const userMsgCount = newMessages.filter((m) => m.role === "user").length;
        if (userMsgCount >= 1) setCompletedMissions((prev) => ({ ...prev, 0: true }));
        if (userMsgCount >= 2) setCompletedMissions((prev) => ({ ...prev, 1: true }));
        if (userMsgCount >= 3) setCompletedMissions((prev) => ({ ...prev, 2: true }));
      }

      playSpeechAudio(data.replyEn, activeP);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Text Input Message
  const submitTextMessage = async (explicitText?: string) => {
    const userText = (explicitText || textInput).trim();
    if (!userText || isProcessing) return;

    setTextInput("");
    capturedTextRef.current = "";
    setIsProcessing(true);
    setFeedbackNotice(null);

    const activeP = activeScenario ? activeScenario.partner : persona;
    const activeScenTitle = activeScenario ? activeScenario.title : "daily";

    try {
      const res = await fetch("/api/speaking/converse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          persona: activeP,
          level,
          scenario: activeScenTitle,
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
          translateId: data.translateId,
          suggestedReplies: data.suggestedReplies,
          tip: data.correctionTip,
          pitfallTag: data.pitfallTag,
          roast: data.roastComment,
          score: data.fluencyScore,
        },
      ];

      setMessages(newMessages);
      if (data.correctionTip) setActiveTip(data.correctionTip);
      if (data.roastComment) setActiveRoast(data.roastComment);

      // Auto-check mission progress for scenarios
      if (activeScenario) {
        const userMsgCount = newMessages.filter((m) => m.role === "user").length;
        if (userMsgCount >= 1) setCompletedMissions((prev) => ({ ...prev, 0: true }));
        if (userMsgCount >= 2) setCompletedMissions((prev) => ({ ...prev, 1: true }));
        if (userMsgCount >= 3) setCompletedMissions((prev) => ({ ...prev, 2: true }));
      }

      playSpeechAudio(data.replyEn, activeP);
    } catch (err) {
      setFeedbackNotice(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses percakapan.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Dynamic Fresh Quiz
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
        body: JSON.stringify({
          level,
          topic: quizTopic,
          count: quizCount,
          seed: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        }),
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

  // Complete Quiz & Record Progress
  const finishQuiz = () => {
    setQuizFinished(true);
    let correctCount = 0;
    quizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) correctCount++;
    });
    const finalScore = Math.round((correctCount / quizQuestions.length) * 100);

    saveSessionRecord({
      type: "quiz",
      title: `Kuis Kilat (${quizTopic})`,
      score: finalScore,
    });
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

      saveSessionRecord({
        type: "essay",
        title: `Ujian Esai: ${essayTopic.slice(0, 24)}...`,
        score: data.data.overallScore100 || 80,
      });
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

  // Aggregated Analytics
  const totalMinutesSpoken = Math.round(
    records.filter((r) => r.durationSeconds).reduce((a, b) => a + (b.durationSeconds || 0), 0) / 60,
  );
  const avgOverallScore = records.length
    ? Math.round(records.reduce((a, b) => a + b.score, 0) / records.length)
    : 82;

  // Most common grammar pitfall tags
  const pitfallCounts: Record<string, number> = {};
  records.forEach((r) => {
    r.pitfalls?.forEach((p) => {
      pitfallCounts[p] = (pitfallCounts[p] || 0) + 1;
    });
  });
  const topPitfalls = Object.entries(pitfallCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

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
                AI English Master Studio
              </span>
              <span className="text-micro font-mono text-muted bg-surface-raised px-2 py-0.5 rounded-md border border-hairline">
                {cost} Kredit / Sesi
              </span>
            </div>
            <h1 className="mt-2 font-display text-xl sm:text-2xl font-bold text-ink tracking-tight">
              Lancar Inggris
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
              Speaking AI native, roleplay skenario nyata, kuis interaktif, dan evaluasi tulisan dengan analitik progres belajar.
            </p>
          </div>

          {/* LEVEL SELECTION PILLS */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-hairline bg-surface-raised p-1.5">
            {[
              { id: "beginner", label: "Pemula (A1-A2)" },
              { id: "intermediate", label: "Menengah (B1-B2)" },
              { id: "advanced", label: "Mahir (C1-C2)" },
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

        {/* 5 SUB-MODULE NAVIGATION TABS */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-t border-hairline/60 pt-4">
          {[
            { id: "voice", label: "Panggilan Suara", sub: "Live Speaking" },
            { id: "scenario", label: "Simulasi Skenario", sub: "Roleplay Chamber" },
            { id: "quiz", label: "Kuis Kilat Pro", sub: "Interactive Arena" },
            { id: "essay", label: "Ujian Esai", sub: "IELTS Evaluator" },
            { id: "progress", label: "Rapor & Riwayat", sub: "Learning Tracker" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if (isCalling) endCall();
                setMode(tab.id as Mode);
              }}
              className={`flex flex-col items-start rounded-2xl border p-3 transition-all text-left w-full ${
                mode === tab.id
                  ? "border-ember/60 bg-ember/10 text-ink shadow-sm"
                  : "border-hairline bg-surface hover:border-hairline/90 hover:bg-surface-raised text-muted"
              }`}
            >
              <span className={`text-xs font-bold truncate w-full ${mode === tab.id ? "text-ember" : "text-ink"}`}>
                {tab.label}
              </span>
              <span className="text-[10px] text-muted truncate w-full">{tab.sub}</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-bold text-ink">
                    Pilih Partner Bicara AI
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Setiap partner memiliki kepribadian, dialek, dan aksen native yang khas.
                  </p>
                </div>

                {/* Speed selector for beginners */}
                <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-raised px-3 py-1.5">
                  <span className="text-[11px] font-bold text-muted">Tempo Suara:</span>
                  {[
                    { val: 0.75, label: "0.75x (Pelan)" },
                    { val: 1.0, label: "1.0x (Normal)" },
                  ].map((s) => (
                    <button
                      key={s.val}
                      onClick={() => setPlaybackSpeed(s.val)}
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all ${
                        playbackSpeed === s.val ? "bg-ember text-obsidian" : "text-muted hover:text-ink"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
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
                  <h4 className="text-xs font-bold text-ink">Bebas Bicara Tanpa Takut Salah:</h4>
                  <p className="text-micro text-muted mt-0.5">
                    Tersedia tombol terjemahan instan &amp; contekan jawaban cepat jika lo pemula dan bingung mau merespons apa.
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
                      {isPlayingAudio && <span className="text-ember font-bold ml-1.5">• Sedang bersuara...</span>}
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
              <div className="h-64 sm:h-72 overflow-y-auto rounded-2xl border border-hairline/60 bg-surface-raised/40 p-4 space-y-3.5 custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed space-y-2 ${
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

                      {/* Beginner Feature: Tap to view Indonesian Translation */}
                      {m.role === "assistant" && m.translateId && (
                        <div className="border-t border-hairline/50 pt-1.5">
                          {showTranslations[m.id] ? (
                            <p className="text-[11px] text-muted font-normal italic">
                              Arti: &ldquo;{m.translateId}&rdquo;
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setShowTranslations((prev) => ({ ...prev, [m.id]: true }))
                              }
                              className="text-[10px] font-bold text-ember hover:underline"
                            >
                              Lihat Terjemahan Indo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {m.score && m.role === "assistant" && (
                      <span className="text-[10px] text-muted mt-1 px-1 font-mono">
                        Skor Kelancaran: {m.score}/100
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Beginner Feature: Smart Hint Suggestion Pills */}
              {messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].suggestedReplies && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <span className="text-micro font-bold text-muted uppercase tracking-wider">
                    Contekan Jawaban Cepat (Klik untuk kirim):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {messages[messages.length - 1].suggestedReplies?.map((hint, idx) => (
                      <button
                        key={idx}
                        onClick={() => submitTextMessage(hint.en)}
                        disabled={isProcessing}
                        className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-left text-xs hover:border-ember/60 hover:bg-surface-raised transition-all group max-w-full"
                      >
                        <span className="font-bold text-ink group-hover:text-ember block truncate">{hint.en}</span>
                        <span className="text-[10px] text-muted block truncate">{hint.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Kinetic Waveform Canvas */}
              <div className="rounded-2xl border border-hairline/60 bg-surface-raised p-3 flex flex-col items-center justify-center">
                <canvas ref={canvasRef} width={400} height={50} className="w-full h-12" />
                <p className="text-[11px] font-mono text-muted mt-1">
                  {isRecording
                    ? "Mendengarkan suara lo secara live... Klik tombol merah untuk kirim"
                    : isPlayingAudio
                    ? "Partner AI sedang berbicara..."
                    : isProcessing
                    ? "AI sedang memikirkan balasan..."
                    : "Bicara lewat tombol mikrofon di bawah atau ketik di kolom teks"}
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
                        : "bg-ember text-obsidian hover:brightness-105 active:scale-95"
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
                    onClick={() => submitTextMessage()}
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
                  <p className="font-display text-2xl font-bold text-emerald-400 mt-1">
                    {messages.filter((m) => m.score).length
                      ? Math.round(
                          messages.filter((m) => m.score).reduce((a, b) => a + (b.score || 0), 0) /
                            messages.filter((m) => m.score).length,
                        )
                      : 80}
                    /100
                  </p>
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
      {/* MODE 2: SIMULASI SKENARIO (ROLEPLAY CHAMBER - STAYS IN TAB!) */}
      {/* ========================================================================= */}
      {mode === "scenario" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-6">
          {!isCalling ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Chamber Simulasi Skenario Dunia Nyata
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Latihan situasi spesifik dengan misi objektif, alur cerita, dan lawan bicara AI yang realistis.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {SCENARIOS.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-2xl border border-hairline bg-surface-raised p-4 flex flex-col justify-between space-y-4 hover:border-ember/40 transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-display text-sm font-bold text-ink group-hover:text-ember transition-colors">
                          {s.title}
                        </h4>
                        <span className="text-micro font-mono text-muted bg-surface px-2 py-0.5 rounded-md border border-hairline capitalize">
                          {s.partner}
                        </span>
                      </div>
                      <p className="text-micro text-muted mt-1 leading-relaxed">{s.context}</p>

                      {/* Missions list */}
                      <div className="mt-3 space-y-1">
                        <p className="text-[10px] font-bold text-ember uppercase tracking-wider">Target Misi:</p>
                        <ul className="text-[11px] text-ink/80 space-y-0.5 list-disc list-inside">
                          {s.missions.map((m, i) => (
                            <li key={i} className="truncate">{m}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <button
                      onClick={() => startCall(s)}
                      className="btn-ember w-full h-10 rounded-xl text-xs font-bold text-obsidian shadow-sm hover:brightness-105"
                    >
                      Masuk Simulasi ({s.title}) →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ACTIVE ROLEPLAY CHAMBER VIEW (STAYS IN SCENARIO TAB!) */
            <div className="space-y-6">
              {/* Scenario Context & Objectives Header */}
              <div className="rounded-2xl border border-ember/30 bg-ember/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="font-display text-sm font-bold text-ink">
                      Skenario: {activeScenario?.title}
                    </h3>
                  </div>
                  <button
                    onClick={endCall}
                    className="h-8 px-3 rounded-lg border border-rose-500/40 bg-rose-500/15 text-rose-400 text-micro font-bold hover:bg-rose-500/25"
                  >
                    Selesaikan Simulasi
                  </button>
                </div>
                <p className="text-xs text-muted leading-relaxed">{activeScenario?.context}</p>

                {/* Live Mission Checklist */}
                <div className="border-t border-hairline/60 pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {activeScenario?.missions.map((m, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-2 text-xs flex items-center gap-2 ${
                        completedMissions[idx]
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 font-bold"
                          : "border-hairline bg-surface text-muted"
                      }`}
                    >
                      <span className={`size-4 rounded-full flex items-center justify-center text-[10px] ${
                        completedMissions[idx] ? "bg-emerald-400 text-obsidian font-bold" : "border border-hairline"
                      }`}>
                        {completedMissions[idx] ? "✓" : idx + 1}
                      </span>
                      <span className="truncate">{m}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Transcript */}
              <div className="h-64 sm:h-72 overflow-y-auto rounded-2xl border border-hairline/60 bg-surface-raised/40 p-4 space-y-3.5 custom-scrollbar">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed space-y-2 ${
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
                            onClick={() => playSpeechAudio(m.text, activeScenario?.partner)}
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

                      {/* Indonesian translation toggle */}
                      {m.role === "assistant" && m.translateId && (
                        <div className="border-t border-hairline/50 pt-1.5">
                          {showTranslations[m.id] ? (
                            <p className="text-[11px] text-muted font-normal italic">
                              Arti: &ldquo;{m.translateId}&rdquo;
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setShowTranslations((prev) => ({ ...prev, [m.id]: true }))
                              }
                              className="text-[10px] font-bold text-ember hover:underline"
                            >
                              Lihat Terjemahan Indo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Hints */}
              {messages.length > 0 && messages[messages.length - 1].role === "assistant" && messages[messages.length - 1].suggestedReplies && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <span className="text-micro font-bold text-muted uppercase tracking-wider">
                    Opsi Jawaban Skenario (Klik untuk kirim):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {messages[messages.length - 1].suggestedReplies?.map((hint, idx) => (
                      <button
                        key={idx}
                        onClick={() => submitTextMessage(hint.en)}
                        disabled={isProcessing}
                        className="rounded-xl border border-hairline bg-surface px-3 py-1.5 text-left text-xs hover:border-ember/60 hover:bg-surface-raised transition-all group max-w-full"
                      >
                        <span className="font-bold text-ink group-hover:text-ember block truncate">{hint.en}</span>
                        <span className="text-[10px] text-muted block truncate">{hint.id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Roleplay controls */}
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
                  placeholder="Ketik balasan untuk skenario ini..."
                  disabled={isProcessing}
                  className="flex-1 bg-transparent px-3 text-xs sm:text-sm text-ink placeholder:text-muted/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => submitTextMessage()}
                  disabled={!textInput.trim() || isProcessing}
                  className="btn-ember h-9 px-4 rounded-xl font-display text-xs font-bold text-obsidian disabled:opacity-50"
                >
                  Kirim
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: KUIS KILAT PRO (INTERACTIVE ARENA) */}
      {/* ========================================================================= */}
      {mode === "quiz" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-6">
          {quizQuestions.length === 0 ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-base font-bold text-ink">
                  Kuis Kilat Bahasa Inggris Pro
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Uji pemahaman tenses, idiom, kosakata bisnis, dan perbaikan kalimat dengan soal yang 100% segar &amp; anti-repetisi.
                </p>
              </div>

              {/* Topic Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "grammar_tenses", title: "Tenses & Grammar", desc: "Past, Present, Perfect, & Conditionals" },
                  { id: "idioms_phrases", title: "Idioms & Phrasal Verbs", desc: "Ungkapan sehari-hari penutur asli" },
                  { id: "error_spotting", title: "Error Spotting", desc: "Cari letak kesalahan dalam kalimat" },
                  { id: "business_pro", title: "Business English", desc: "Email profesional, meeting & negosiasi" },
                  { id: "slang_pop", title: "Slang & Pop Culture", desc: "Bahasa gaul internet & tongkrongan global" },
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

              {/* Question Count Selector */}
              <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-raised p-3">
                <span className="text-xs font-bold text-ink">Jumlah Soal:</span>
                {[5, 10, 15].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setQuizCount(cnt)}
                    className={`rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                      quizCount === cnt ? "bg-ember text-obsidian" : "text-muted hover:text-ink bg-surface"
                    }`}
                  >
                    {cnt} Soal
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerateQuiz}
                disabled={quizLoading}
                className="btn-ember h-11 px-6 rounded-xl font-display text-xs font-bold text-obsidian shadow-md hover:brightness-105"
              >
                {quizLoading ? "Menyiapkan Soal Kuis Segar..." : `Mulai Kuis ${quizCount} Soal Baru →`}
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
                        onClick={finishQuiz}
                        className="btn-ember h-10 px-5 rounded-xl text-xs font-bold text-obsidian disabled:opacity-50"
                      >
                        Lihat Skor &amp; Catat Rapor →
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
                const score = Math.round((correctCount / quizQuestions.length) * 100);

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
                        Mulai Kuis Baru (Soal Segar)
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
      {/* MODE 4: UJIAN ESAI (ESSAY EVALUATION) */}
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
      {/* MODE 5: RAPOR & RIWAYAT BELAJAR (LEARNING ANALYTICS & RECOMMENDATIONS) */}
      {/* ========================================================================= */}
      {mode === "progress" && (
        <div className="surface-card rounded-3xl border border-hairline/80 bg-surface/90 p-5 sm:p-7 backdrop-blur-xl shadow-xl space-y-6 animate-in fade-in duration-300">
          <div>
            <h3 className="font-display text-base font-bold text-ink">
              Rapor &amp; Analitik Progres Belajar Lo
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Pantau perkembangan skor kelancaran, durasi latihan bicara, dan rekomendasi materi yang perlu dilatih.
            </p>
          </div>

          {/* Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="rounded-2xl border border-hairline bg-surface-raised p-4 text-center">
              <p className="text-micro font-bold text-muted uppercase tracking-wider">Total Menit Bicara</p>
              <p className="font-display text-2xl font-bold text-ink mt-1">{totalMinutesSpoken} Menit</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-micro font-bold text-emerald-400 uppercase tracking-wider">Rata-rata Skor</p>
              <p className="font-display text-2xl font-bold text-emerald-400 mt-1">{avgOverallScore}/100</p>
            </div>
            <div className="rounded-2xl border border-ember/30 bg-ember/10 p-4 text-center">
              <p className="text-micro font-bold text-ember uppercase tracking-wider">Total Aktivitas</p>
              <p className="font-display text-2xl font-bold text-ember mt-1">{records.length} Sesi</p>
            </div>
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-center">
              <p className="text-micro font-bold text-sky-400 uppercase tracking-wider">Status Level</p>
              <p className="font-display text-2xl font-bold text-sky-400 mt-1 capitalize">{level}</p>
            </div>
          </div>

          {/* Personalized Weakness & Recommendations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                Kelemahan Grammar yang Sering Muncul:
              </h4>
              {topPitfalls.length > 0 ? (
                <div className="space-y-2">
                  {topPitfalls.map(([tag, count], idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-surface/50 rounded-xl p-2.5">
                      <span className="font-bold text-ink">{tag}</span>
                      <span className="font-mono text-rose-400 font-bold">{count}x Terdeteksi</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">
                  Belum ada catatan kesalahan berulang. Terus latihan bicara dan kerjakan kuis!
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-ember/30 bg-ember/10 p-4 space-y-3">
              <h4 className="text-xs font-bold text-ember uppercase tracking-wider">
                Rekomendasi Langkah Belajar:
              </h4>
              <ul className="text-xs text-ink space-y-2 list-disc list-inside">
                <li>
                  {level === "beginner"
                    ? "Fokus latihan Past Tense (V2) dan tanyakan menu di Simulasi Kafe."
                    : level === "intermediate"
                    ? "Latih transisi argumen di Ujian Esai dan perbanyak Idiom sehari-hari."
                    : "Asah spontanitas di Skenario Wawancara Kerja & Negosiasi Gaji tingkat tinggi."}
                </li>
                <li>
                  {topPitfalls.length > 0
                    ? `Coba Kuis Kilat topik "${topPitfalls[0][0]}" untuk memperbaiki titik lemah utama.`
                    : "Lakukan sesi berbicara minimal 5 menit per hari untuk melatih reflek bicara."}
                </li>
              </ul>
            </div>
          </div>

          {/* Session History Feed */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Riwayat Sesi Belajar:</h4>
            {records.length > 0 ? (
              <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-4 space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar">
                {records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-hairline bg-surface text-xs"
                  >
                    <div>
                      <span className="font-bold text-ink block">{r.title}</span>
                      <span className="text-[10px] text-muted font-mono">
                        {new Date(r.timestamp).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {r.durationSeconds ? ` • ${formatSeconds(r.durationSeconds)}` : ""}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-ember bg-ember/15 px-2.5 py-1 rounded-lg border border-ember/30">
                      {r.score}/100
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-hairline bg-surface-raised/40 p-8 text-center text-xs text-muted">
                Belum ada riwayat aktivitas. Mulai panggilan suara, simulasi skenario, atau kuis kilat untuk mencatat progres lo!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
