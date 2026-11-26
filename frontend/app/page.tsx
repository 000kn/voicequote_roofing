"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Upload,
  FileText,
  Share2,
  Plus,
  Trash2,
  WifiOff,
  Download,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { processLogoImage } from "../utils/logoProcessor";
import { PdfTemplate, formatUnits } from "../components/PdfTemplate";
import { PaymentSlider } from "../components/PaymentSlider";

interface TeklifKalemi {
  aciklama: string;
  miktar?: number | null;
  birim?: string | null;
  birim_fiyat?: number | null;
  toplam_fiyat?: number | null;
}

interface NoteItem {
  id: string;
  text: string;
  date: string;
}

interface Quote {
  id: string;
  user_id: string;
  tarih: string;
  bina_adi: string | null;
  musteri_adi: string | null;
  musteri_telefon: string | null;
  konum: string | null;
  yapilacak_isler: TeklifKalemi[];
  ana_tutar_rakam: number;
  ana_tutar_yaziyla: string;
  odeme_plani: string | null;
  tahsil_edilen: number | null;
  garanti_var_mi: boolean;
  garanti_suresi: string | null;
  teslim_suresi_gun: number | null;
  durum: string;
  hatirlatma_tarihi: string | null;
  hatirlatma_notu: string | null;
  created_at?: string;
}

interface QuoteData {
  raw_transcript: string;
  tarih: string;
  musteri_adi: string | null;
  musteri_telefon: string | null;
  bina_adi: string | null;
  konum: string | null;
  baslik: string;
  yapilacak_isler: TeklifKalemi[];
  ana_tutar_rakam: number;
  ana_tutar_yaziyla: string;
  amount_verified: boolean;
  pesinat: number | null;
  odeme_plani: string | null;
  teslim_suresi_gun: number | null;
  garanti_var_mi: boolean;
  garanti_suresi: string | null;
  alternatif_not_var_mi: boolean;
  alternatif_aciklama: string | null;
  alternatif_tutar_rakam: number | null;
  alternatif_tutar_yaziyla: string | null;
  ozel_yetkililer: string[] | null;
  bakim_takibi_gerekli: boolean;
  missing_critical_info: string[];
}

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

function getOneYearFromToday(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

function parseNotes(raw: string | null): NoteItem[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Legacy plain-text note fallback
  }
  return [{ id: "legacy-1", text: raw.trim(), date: "" }];
}

function getMonthKeyAndTitle(tarih: string): { key: string; title: string } {
  if (!tarih) return { key: "0000-00", title: "Tarihsiz" };
  let year = "";
  let monthIdx = -1;

  if (tarih.includes(".")) {
    const parts = tarih.split(".");
    if (parts.length === 3) {
      monthIdx = parseInt(parts[1], 10) - 1;
      year = parts[2];
    }
  } else if (tarih.includes("-")) {
    const parts = tarih.split("-");
    if (parts.length >= 2) {
      year = parts[0];
      monthIdx = parseInt(parts[1], 10) - 1;
    }
  }

  if (year && monthIdx >= 0 && monthIdx < 12) {
    const monthStr = String(monthIdx + 1).padStart(2, "0");
    return {
      key: `${year}-${monthStr}`,
      title: `${TR_MONTHS[monthIdx]} ${year}`,
    };
  }
  return { key: "0000-00", title: "Diğer" };
}

function formatTrPhone(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const normalized =
    digits.length === 10 && digits.startsWith("5") ? `0${digits}` : digits;
  if (normalized.length === 11 && normalized.startsWith("0")) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9, 11)}`;
  }
  return raw;
}

function formatGaranti(raw: string | null): string {
  const val = (raw || "10 Yıl").trim();
  return val.replace(/\byıl\b/gi, "Yıl");
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(21).fill(15));
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingMessages = [
    "Ses kaydı işleniyor...",
    "Metraj ve malzemeler ayrıştırılıyor...",
    "Tutar ve ödeme planı hesaplanıyor...",
    "Teklif şablonu hazırlanıyor...",
  ];

  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);
  const [activeTab, setActiveTab] = useState<"new" | "list">("new");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);

  // Tahsil input draft map for smooth thousand-separator typing
  const [tahsilDrafts, setTahsilDrafts] = useState<Record<string, string>>({});
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  // Note Modal State
  const [noteModal, setNoteModal] = useState<{
    quoteId: string;
    mode: "add" | "view";
  } | null>(null);
  const [newNoteText, setNewNoteText] = useState("");

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [firmaAdi, setFirmaAdi] = useState("AKSOY ÇATI & İZOLASYON");
  const [firmaAltBaslik, setFirmaAltBaslik] = useState("Su ve Isı İzolasyon Uygulamaları");
  const [firmaTel, setFirmaTel] = useState("0532 411 84 32");
  const [varsayilanYetkililer, setVarsayilanYetkililer] = useState("Yalçın Aksoy, Yavuz Aksoy");
  const [kdvNotu, setKdvNotu] = useState(
    "Fiyatlarımıza KDV dahil değildir. Teklifimiz 15 gün süreyle geçerlidir."
  );
  const [processedLogo, setProcessedLogo] = useState<string | null>(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pdfRef = useRef<HTMLDivElement | null>(null);

  const fetchQuotes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) {
      setQuotes(data);
      const drafts: Record<string, string> = {};
      data.forEach((item: Quote) => {
        drafts[item.id] = Number(item.tahsil_edilen || 0).toLocaleString("tr-TR");
      });
      setTahsilDrafts(drafts);
    }
  };

  useEffect(() => {
    if (user && activeTab === "list") {
      fetchQuotes();
    }
  }, [user, activeTab]);

  const saveQuoteToDb = async (q: QuoteData | null, id: string | null = null) => {
    if (!user || !q) return;

    const quotePayload = {
      user_id: user.id,
      tarih: q.tarih,
      bina_adi: q.bina_adi,
      musteri_adi: q.musteri_adi,
      musteri_telefon: q.musteri_telefon,
      konum: q.konum,
      yapilacak_isler: q.yapilacak_isler,
      ana_tutar_rakam: q.ana_tutar_rakam,
      ana_tutar_yaziyla: q.ana_tutar_yaziyla,
      odeme_plani: q.odeme_plani,
      garanti_var_mi: q.garanti_var_mi,
      garanti_suresi: q.garanti_suresi,
      teslim_suresi_gun: q.teslim_suresi_gun,
    };

    if (id) {
      await supabase.from("quotes").update(quotePayload).eq("id", id);
    } else {
      await supabase.from("quotes").insert([
        {
          ...quotePayload,
          tahsil_edilen: 0,
          durum: "Beklemede",
          hatirlatma_tarihi: getOneYearFromToday(),
          hatirlatma_notu: "[]",
        },
      ]);
    }
    fetchQuotes();
  };

  const exportQuotesToCsv = () => {
    const headers = [
      "Tarih",
      "Müşteri Adı",
      "Apartman / Bina",
      "Durum",
      "Telefon",
      "Konum",
      "Yapılacak İşler",
      "Toplam Tutar",
      "Tahsil Edilen",
      "Kalan Bakiye",
      "Ödeme Planı",
      "Garanti",
      "Bakım Tarihi",
      "Notlar",
    ];
    const rows = quotes.map((q) => {
      const notesText = parseNotes(q.hatirlatma_notu)
        .map((n) => n.text)
        .join(" | ");
      return [
        q.tarih,
        q.musteri_adi || "",
        q.bina_adi || "",
        q.durum,
        q.musteri_telefon || "",
        q.konum || "",
        (q.yapilacak_isler || []).map((i) => i.aciklama).join(" | "),
        q.ana_tutar_rakam,
        q.tahsil_edilen || 0,
        Math.max(0, q.ana_tutar_rakam - (q.tahsil_edilen || 0)),
        q.odeme_plani || "",
        q.garanti_var_mi ? "Evet" : "Hayır",
        q.hatirlatma_tarihi || "",
        notesText,
      ];
    });
    const csvContent =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "teklifler.csv");
    link.click();
  };

  useEffect(() => {
    if (quote) {
      const pesinat = quote.ana_tutar_rakam * 0.4;
      const kalan = quote.ana_tutar_rakam * 0.6;
      const defaultPlan = `%40 Peşin (${pesinat.toLocaleString("tr-TR")} TL) - %60 İş Tesliminde (${kalan.toLocaleString("tr-TR")} TL)`;

      if (!quote.odeme_plani || quote.odeme_plani.includes("%60 İş Tesliminde")) {
        setQuote((prev) =>
          prev
            ? {
                ...prev,
                odeme_plani: defaultPlan,
              }
            : null
        );
      }
    }
  }, [quote?.ana_tutar_rakam]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      const setupAnalyzer = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioContextRef.current = new (window.AudioContext ||
            (window as any).webkitAudioContext)();
          analyzerRef.current = audioContextRef.current.createAnalyser();
          analyzerRef.current.fftSize = 64;
          sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
          sourceRef.current.connect(analyzerRef.current);

          const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);

          const updateLevels = () => {
            animationFrameRef.current = requestAnimationFrame(updateLevels);
            analyzerRef.current?.getByteFrequencyData(dataArray);

            const newLevels = Array(21)
              .fill(0)
              .map((_, i) => {
                const symIndex = 10 - Math.abs(10 - i);
                const val = dataArray[symIndex] || 0;
                return 12 + (val / 255) * 88;
              });
            setAudioLevels(newLevels);
          };
          updateLevels();
        } catch (e) {
          console.error("Audio analyzer error:", e);
        }
      };
      setupAnalyzer();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (sourceRef.current) {
        sourceRef.current.mediaStream.getTracks().forEach((track) => track.stop());
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) audioContextRef.current.close();
      setRecordingTime(0);
      setAudioLevels(Array(21).fill(15));
    }
  }, [isRecording]);

  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      loadingIntervalRef.current = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingMessages.length);
      }, 2200);
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    }
  }, [loading]);

  useEffect(() => {
    processLogoImage("/logo.png").then(setProcessedLogo);
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data && !error) {
        if (data.firma_adi) setFirmaAdi(data.firma_adi);
        if (data.firma_tel) setFirmaTel(data.firma_tel);
        if (data.varsayilan_yetkililer) {
          setVarsayilanYetkililer(
            Array.isArray(data.varsayilan_yetkililer)
              ? data.varsayilan_yetkililer.join(", ")
              : data.varsayilan_yetkililer
          );
        }
        if (data.kdv_notu) setKdvNotu(data.kdv_notu);
        if (data.is_pro !== undefined) setIsPro(data.is_pro);
      }
    } catch (e) {
      console.error("Profil çekilemedi:", e);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsPro(false);
      }
    });

    const savedFirma = localStorage.getItem("tp_firma");
    const savedAlt = localStorage.getItem("tp_alt");
    const savedTel = localStorage.getItem("tp_tel");
    const savedLogo = localStorage.getItem("teklifpro_custom_logo");
    const savedYetkili = localStorage.getItem("tp_yetkili");
    const savedKdv = localStorage.getItem("tp_kdv_notu");
    if (savedFirma) setFirmaAdi(savedFirma);
    if (savedAlt) setFirmaAltBaslik(savedAlt);
    if (savedTel) setFirmaTel(savedTel);
    if (savedLogo) setProcessedLogo(savedLogo);
    if (savedYetkili) setVarsayilanYetkililer(savedYetkili);
    if (savedKdv) setKdvNotu(savedKdv);

    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        alert("Kayıt başarılı! Giriş yapabilirsiniz.");
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setShowAuthModal(false);
      }
    } catch (err: any) {
      alert(`Kimlik doğrulama hatası: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsPro(false);
  };

  const saveSettings = async () => {
    localStorage.setItem("tp_firma", firmaAdi);
    localStorage.setItem("tp_alt", firmaAltBaslik);
    localStorage.setItem("tp_tel", firmaTel);
    localStorage.setItem("tp_yetkili", varsayilanYetkililer);
    localStorage.setItem("tp_kdv_notu", kdvNotu);
    if (processedLogo) localStorage.setItem("teklifpro_custom_logo", processedLogo);

    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        firma_adi: firmaAdi,
        firma_tel: firmaTel,
        firma_alt_baslik: firmaAltBaslik,
        varsayilan_yetkililer: varsayilanYetkililer.split(",").map((s) => s.trim()),
        kdv_notu: kdvNotu,
        logo_base64: processedLogo,
        updated_at: new Date().toISOString(),
      });
    }
    setShowSettings(false);
    setShowCompanyModal(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        await sendAudioToApi(blob, "kayit.webm");
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      alert("Mikrofon izni verilmedi veya cihazda mikrofon bulunamadı.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await sendAudioToApi(file, file.name);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 320;
        const scale = Math.min(MAX_WIDTH / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        setProcessedLogo(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const sendAudioToApi = async (audioBlob: Blob, filename: string) => {
    if (!navigator.onLine) {
      alert("İnternet bağlantısı yok! Bağlantı gelince tekrar deneyin.");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, filename);

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/parse-quote`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "API hatası");
      }
      const data: QuoteData = await res.json();
      data.yapilacak_isler = data.yapilacak_isler.map((item) => ({
        ...item,
        aciklama: formatUnits(item.aciklama),
      }));
      setActiveQuoteId(null);
      setQuote(data);
    } catch (err: any) {
      alert(`Ses işlenirken hata oluştu: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const slugifyFilename = (text: string) => {
    const trMap: Record<string, string> = {
      ç: "c",
      ğ: "g",
      ı: "i",
      ö: "o",
      ş: "s",
      ü: "u",
      İ: "I",
      Ç: "C",
      Ğ: "G",
      Ö: "O",
      Ş: "S",
      Ü: "U",
    };
    return text
      .replace(/[çğıöşüİÇĞÖŞÜ]/g, (m) => trMap[m])
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.]/g, "");
  };

  const generatePdfBlob = async () => {
    if (!pdfRef.current || !quote) return null;
    const html2pdf = (await import("html2pdf.js")).default;
    const baseName = slugifyFilename(quote.bina_adi || quote.musteri_adi || "Teklif");
    const dosyaAdi = `${baseName}_${quote.tarih}.pdf`;

    const opt = {
      margin: 0,
      filename: dosyaAdi,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        width: 794,
        windowWidth: 794,
        useCORS: true,
        onclone: (clonedDoc: Document) => {
          clonedDoc
            .querySelectorAll("style, link[rel='stylesheet']")
            .forEach((el) => el.remove());
        },
      },
      jsPDF: { unit: "px", format: [794, 1123] as [number, number], orientation: "portrait" as const },
    };

    const pdfBlob: Blob = await html2pdf()
      .set(opt)
      .from(pdfRef.current)
      .outputPdf("blob");
    return { blob: pdfBlob, name: dosyaAdi };
  };

  const generateAndSharePdf = async () => {
    const pdfData = await generatePdfBlob();
    if (!pdfData) return;

    const file = new File([pdfData.blob], pdfData.name, { type: "application/pdf" });

    if (user && !activeQuoteId) {
      await saveQuoteToDb(quote, null);
    }

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${firmaAdi} - Fiyat Teklifi`,
      });
    } else {
      const url = URL.createObjectURL(pdfData.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pdfData.name;
      a.click();
    }
  };

  const downloadPdf = async () => {
    const pdfData = await generatePdfBlob();
    if (!pdfData) return;
    const url = URL.createObjectURL(pdfData.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfData.name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Shift maintenance date by +1 or -1 year
  const shiftMaintenanceYear = async (q: Quote, deltaYears: number) => {
    const baseDate = q.hatirlatma_tarihi ? new Date(q.hatirlatma_tarihi) : new Date();
    baseDate.setFullYear(baseDate.getFullYear() + deltaYears);
    const updatedDate = baseDate.toISOString().split("T")[0];

    setQuotes((prev) =>
      prev.map((item) =>
        item.id === q.id ? { ...item, hatirlatma_tarihi: updatedDate } : item
      )
    );
    await supabase
      .from("quotes")
      .update({ hatirlatma_tarihi: updatedDate })
      .eq("id", q.id);
  };

  // Save a new note or delete an existing note
  const handleAddNote = async () => {
    if (!noteModal || !newNoteText.trim()) return;
    const targetQuote = quotes.find((item) => item.id === noteModal.quoteId);
    if (!targetQuote) return;

    const existing = parseNotes(targetQuote.hatirlatma_notu);
    const updatedNotes: NoteItem[] = [
      ...existing,
      {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now()),
        text: newNoteText.trim(),
        date: new Date().toLocaleDateString("tr-TR"),
      },
    ];
    const serialized = JSON.stringify(updatedNotes);

    setQuotes((prev) =>
      prev.map((item) =>
        item.id === targetQuote.id ? { ...item, hatirlatma_notu: serialized } : item
      )
    );
    setNewNoteText("");
    setNoteModal(null);
    await supabase
      .from("quotes")
      .update({ hatirlatma_notu: serialized })
      .eq("id", targetQuote.id);
  };

  const handleDeleteNote = async (quoteId: string, noteId: string) => {
    const targetQuote = quotes.find((item) => item.id === quoteId);
    if (!targetQuote) return;

    const updatedNotes = parseNotes(targetQuote.hatirlatma_notu).filter(
      (n) => n.id !== noteId
    );
    const serialized = JSON.stringify(updatedNotes);

    setQuotes((prev) =>
      prev.map((item) =>
        item.id === quoteId ? { ...item, hatirlatma_notu: serialized } : item
      )
    );
    await supabase
      .from("quotes")
      .update({ hatirlatma_notu: serialized })
      .eq("id", quoteId);
  };

  // Group quotes vertically by month (newest first)
  const groupedQuotes = React.useMemo(() => {
    const map = new Map<string, { key: string; title: string; items: Quote[] }>();
    quotes.forEach((q) => {
      const { key, title } = getMonthKeyAndTitle(q.tarih);
      if (!map.has(key)) {
        map.set(key, { key, title, items: [] });
      }
      map.get(key)!.items.push(q);
    });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [quotes]);

  const activeModalQuote = noteModal
    ? quotes.find((item) => item.id === noteModal.quoteId) || null
    : null;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      <header className="bg-slate-900 text-white shadow sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-lg tracking-tight">TeklifPro</h1>
              <p className="text-xs text-slate-400">{firmaAdi}</p>
            </div>
            <div className="flex items-center gap-3">
              {isOffline && <WifiOff className="w-5 h-5 text-amber-400" />}
              {user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs">{user.email?.split("@")[0]}</span>
                  <button
                    onClick={handleLogout}
                    className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg"
                  >
                    Çıkış
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-xs bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg font-medium"
                >
                  Giriş Yap
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="max-w-5xl mx-auto px-4 pb-2">
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("new")}
              className={`flex-1 py-2 text-xs font-medium rounded-lg ${
                activeTab === "new" ? "bg-slate-700 text-white" : "text-slate-400"
              }`}
            >
              Yeni Teklif
            </button>
            <button
              onClick={() => setActiveTab("list")}
              className={`flex-1 py-2 text-xs font-medium rounded-lg ${
                activeTab === "list" ? "bg-slate-700 text-white" : "text-slate-400"
              }`}
            >
              Tekliflerim
            </button>
          </div>
        </div>
      </header>

      <div
        className={`${
          activeTab === "list" ? "max-w-6xl" : "max-w-xl"
        } mx-auto p-4 space-y-6`}
      >
        {activeTab === "new" ? (
          <>
            {showSettings && (
              <div className="bg-white p-4 rounded-2xl shadow-md space-y-3 border border-slate-200">
                <h2 className="font-semibold text-sm text-slate-700">
                  Firma & İmza Ayarları
                </h2>
                <input
                  value={firmaAdi}
                  onChange={(e) => setFirmaAdi(e.target.value)}
                  placeholder="Firma Adı"
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
                <input
                  value={firmaTel}
                  onChange={(e) => setFirmaTel(e.target.value)}
                  placeholder="Firma Telefonu"
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
                <input
                  value={varsayilanYetkililer}
                  onChange={(e) => setVarsayilanYetkililer(e.target.value)}
                  placeholder="Teklif Veren Yetkililer"
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
                <textarea
                  rows={2}
                  value={kdvNotu}
                  onChange={(e) => setKdvNotu(e.target.value)}
                  placeholder="Standart Teklif Koşulları (KDV / Geçerlilik)"
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
                <button
                  onClick={saveSettings}
                  className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium"
                >
                  Ayarları Kaydet
                </button>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-center space-y-4">
              <button
                onClick={toggleRecording}
                disabled={loading}
                className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center shadow-lg transition-all relative ${
                  isRecording
                    ? "bg-red-600 scale-105"
                    : "bg-amber-600 hover:bg-amber-700"
                } text-white`}
              >
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-600 animate-ping opacity-50"></div>
                )}
                {loading ? (
                  <Loader2 className="w-10 h-10 animate-spin" />
                ) : isRecording ? (
                  <Square className="w-9 h-9" />
                ) : (
                  <Mic className="w-10 h-10" />
                )}
              </button>

              {isRecording && (
                <div className="flex items-center justify-center gap-1 h-10 w-full max-w-xs mx-auto">
                  {audioLevels.map((level, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-gradient-to-t from-amber-500 to-red-500 transition-all duration-75"
                      style={{ height: `${level}%` }}
                    ></div>
                  ))}
                </div>
              )}

              <div>
                <p className="font-semibold text-slate-800">
                  {loading
                    ? loadingMessages[loadingStep]
                    : isRecording
                    ? `Dinleniyor... ${formatTime(recordingTime)}`
                    : "Teklifi Anlatmak İçin Dokun"}
                </p>
                {!isRecording && !loading && (
                  <p className="text-xs text-slate-500 mt-1">
                    Yapılacak işleri, tutarı ve garanti durumunu söyleyin
                  </p>
                )}
              </div>

              {!isRecording && !loading && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer bg-slate-100 px-3 py-2 rounded-lg">
                    <Upload className="w-4 h-4" />
                    Ses Dosyası Yükle (.m4a / .mp3 / .ogg)
                    <input type="file" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              )}
            </div>

            {quote && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" /> Teklif Düzenleme
                  </span>
                  <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md font-medium">
                    {quote.tarih}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-500">Firma Logosu</label>
                  <div className="flex items-center gap-4">
                    {processedLogo && (
                      <img
                        src={processedLogo}
                        alt="Logo Önizleme"
                        className="h-16 w-16 object-contain border rounded-lg"
                      />
                    )}
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-3 rounded-lg font-medium flex items-center gap-1.5"
                    >
                      📷 Logo Yükle / Değiştir
                    </button>
                  </div>
                  {processedLogo && (
                    <button
                      onClick={() => setProcessedLogo(null)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Logoyu Kaldır
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Bina / Site Adı</label>
                    <input
                      value={quote.bina_adi || ""}
                      onChange={(e) => setQuote({ ...quote, bina_adi: e.target.value })}
                      placeholder="Örn: Yılmaz Apt."
                      className="w-full border rounded-lg p-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Müşteri / Yönetici</label>
                    <input
                      value={quote.musteri_adi || ""}
                      onChange={(e) => setQuote({ ...quote, musteri_adi: e.target.value })}
                      placeholder="Örn: Ahmet Bey"
                      className="w-full border rounded-lg p-2 text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-500 block">Yapılacak İşler</label>
                  {quote.yapilacak_isler.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <textarea
                        value={item.aciklama}
                        onChange={(e) => {
                          const updated = [...quote.yapilacak_isler];
                          updated[idx].aciklama = e.target.value;
                          setQuote({ ...quote, yapilacak_isler: updated });
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = "auto";
                          target.style.height = target.scrollHeight + "px";
                        }}
                        className="w-full border rounded-lg p-2 text-sm overflow-hidden resize-none"
                        style={{ height: "auto", minHeight: "60px" }}
                      />
                      <button
                        onClick={() => {
                          const updated = quote.yapilacak_isler.filter((_, i) => i !== idx);
                          setQuote({ ...quote, yapilacak_isler: updated });
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setQuote({
                        ...quote,
                        yapilacak_isler: [...quote.yapilacak_isler, { aciklama: "" }],
                      })
                    }
                    className="text-xs font-medium text-amber-700 flex items-center gap-1 pt-1"
                  >
                    <Plus className="w-4 h-4" /> Yeni Madde Ekle
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <label className="text-xs text-slate-500">Toplam Tutar (TL)</label>
                    <input
                      type="number"
                      value={quote.ana_tutar_rakam}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const pesinat = val * 0.4;
                        const kalan = val * 0.6;
                        const defaultPlan = `%40 Peşin (${pesinat.toLocaleString("tr-TR")} TL) - %60 İş Tesliminde (${kalan.toLocaleString("tr-TR")} TL)`;
                        const isDefault =
                          !quote.odeme_plani ||
                          quote.odeme_plani.includes("%60 İş Tesliminde");

                        setQuote({
                          ...quote,
                          ana_tutar_rakam: val,
                          odeme_plani: isDefault ? defaultPlan : quote.odeme_plani,
                        });
                      }}
                      className="w-full border rounded-lg p-2 text-sm font-bold mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Yazıyla Tutar</label>
                    <input
                      value={quote.ana_tutar_yaziyla}
                      onChange={(e) =>
                        setQuote({ ...quote, ana_tutar_yaziyla: e.target.value })
                      }
                      className="w-full border rounded-lg p-2 text-sm mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs text-slate-500 block">Ödeme Planı</label>
                  <PaymentSlider
                    plan={quote.odeme_plani || ""}
                    total={quote.ana_tutar_rakam}
                    onChange={(newPlan) => setQuote({ ...quote, odeme_plani: newPlan })}
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500">Tahmini Süre (Gün)</label>
                  <input
                    type="number"
                    value={quote.teslim_suresi_gun || ""}
                    onChange={(e) =>
                      setQuote({ ...quote, teslim_suresi_gun: Number(e.target.value) })
                    }
                    className="w-full border rounded-lg p-2 text-sm mt-1"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={quote.garanti_var_mi}
                      onChange={(e) =>
                        setQuote({ ...quote, garanti_var_mi: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-600"
                    />
                    Garanti Kapsamında
                  </label>
                  {quote.garanti_var_mi && (
                    <input
                      value={quote.garanti_suresi || "10 Yıl"}
                      onChange={(e) =>
                        setQuote({ ...quote, garanti_suresi: e.target.value })
                      }
                      className="w-24 border rounded-lg p-1.5 text-xs text-center bg-white"
                    />
                  )}
                </div>

                {user && (
                  <button
                    onClick={async () => {
                      await saveQuoteToDb(quote, activeQuoteId);
                      alert(activeQuoteId ? "Teklif güncellendi!" : "Teklif kaydedildi!");
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow flex items-center justify-center gap-2"
                  >
                    <FileText className="w-5 h-5" />{" "}
                    {activeQuoteId ? "Değişiklikleri Güncelle" : "Panelime Kaydet"}
                  </button>
                )}

                <button
                  onClick={generateAndSharePdf}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-xl shadow flex items-center justify-center gap-2"
                >
                  <Share2 className="w-5 h-5" /> PDF Oluştur ve WhatsApp&apos;tan Gönder
                </button>
                <button
                  onClick={downloadPdf}
                  className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3.5 rounded-xl shadow border border-slate-200 flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" /> PDF İndir
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6">
            {/* Global KPI Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-slate-500">Toplam</p>
                <p className="font-bold text-base mt-0.5">
                  ₺
                  {quotes
                    .reduce((a, b) => a + b.ana_tutar_rakam, 0)
                    .toLocaleString("tr-TR")}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-slate-500">Tahsil Edilen</p>
                <p className="font-bold text-base text-emerald-600 mt-0.5">
                  ₺
                  {quotes
                    .reduce((a, b) => a + (b.tahsil_edilen || 0), 0)
                    .toLocaleString("tr-TR")}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs text-slate-500">Kalan</p>
                <p className="font-bold text-base text-red-600 mt-0.5">
                  ₺
                  {quotes
                    .reduce(
                      (a, b) =>
                        a + Math.max(0, b.ana_tutar_rakam - (b.tahsil_edilen || 0)),
                      0
                    )
                    .toLocaleString("tr-TR")}
                </p>
              </div>
            </div>

            {/* Upcoming Maintenance Alert Banner */}
            {quotes.some(
              (q) =>
                q.hatirlatma_tarihi &&
                q.hatirlatma_tarihi <=
                  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split("T")[0] &&
                q.durum !== "İptal"
            ) && (
              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800 space-y-1">
                <p className="font-semibold">⚠️ Yaklaşan / Geciken Bakımlar:</p>
                {quotes
                  .filter(
                    (q) =>
                      q.hatirlatma_tarihi &&
                      q.hatirlatma_tarihi <=
                        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                          .toISOString()
                          .split("T")[0] &&
                      q.durum !== "İptal"
                  )
                  .map((q) => (
                    <p key={q.id}>
                      • {q.bina_adi || q.musteri_adi || "Teklif"} —{" "}
                      {q.hatirlatma_tarihi} (Bakım)
                    </p>
                  ))}
              </div>
            )}

            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg text-slate-800">Tekliflerim</h2>
              <button
                onClick={exportQuotesToCsv}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg font-medium"
              >
                Excel İndir
              </button>
            </div>

            {groupedQuotes.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-500 border border-slate-200">
                Henüz kayıtlı teklif bulunmuyor.
              </div>
            ) : (
              <div className="space-y-6">
                {groupedQuotes.map((group) => {
                  const isCollapsed = !!collapsedMonths[group.key];
                  const monthTotal = group.items.reduce(
                    (sum, item) => sum + item.ana_tutar_rakam,
                    0
                  );

                  return (
                    <div
                      key={group.key}
                      className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
                    >
                      {/* Monthly Header Bar */}
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedMonths((prev) => ({
                            ...prev,
                            [group.key]: !prev[group.key],
                          }))
                        }
                        className="w-full flex items-center justify-between bg-slate-100 hover:bg-slate-200/70 px-4 py-3 border-b border-slate-200 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2 font-semibold text-sm text-slate-800">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          )}
                          <span>{group.title}</span>
                        </div>
                        <div className="text-xs font-medium text-slate-600">
                          {group.items.length} İş • Toplam:{" "}
                          <span className="font-bold text-slate-900">
                            ₺{monthTotal.toLocaleString("tr-TR")}
                          </span>
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 border-b text-slate-600">
                              <tr>
                                <th className="p-3 whitespace-nowrap">Tarih</th>
                                <th className="p-3 whitespace-nowrap">Müşteri</th>
                                <th className="p-3 whitespace-nowrap">
                                  Apartman / Bina
                                </th>
                                <th className="p-3 whitespace-nowrap">Durum</th>
                                <th className="p-3 whitespace-nowrap">Toplam</th>
                                <th className="p-3 whitespace-nowrap">
                                  Tahsil Edilen
                                </th>
                                <th className="p-3 whitespace-nowrap">Kalan</th>
                                <th className="p-3 whitespace-nowrap">Bakım</th>
                                <th className="p-3 whitespace-nowrap">Not</th>
                                <th className="p-3 whitespace-nowrap">İşlem</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((q) => {
                                const notesList = parseNotes(q.hatirlatma_notu);
                                const safeStatus =
                                  q.durum === "Onaylandı" ? "Beklemede" : q.durum;
                                const remaining = Math.max(
                                  0,
                                  q.ana_tutar_rakam - (q.tahsil_edilen || 0)
                                );
                                const draftVal =
                                  tahsilDrafts[q.id] ??
                                  Number(q.tahsil_edilen || 0).toLocaleString("tr-TR");

                                return (
                                  <tr
                                    key={q.id}
                                    className="border-b last:border-b-0 bg-white hover:bg-gray-50"
                                  >
                                    <td className="p-3 whitespace-nowrap">
                                      {q.tarih}
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                                      {q.musteri_adi || "-"}
                                    </td>
                                    <td className="p-3 whitespace-nowrap text-slate-700">
                                      {q.bina_adi || "-"}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <select
                                        value={safeStatus}
                                        onChange={async (e) => {
                                          const nextStatus = e.target.value;
                                          if (nextStatus === "İptal") {
                                            const shouldDelete = window.confirm(
                                              "İlgili teklifi tablodan silmek ister misiniz?"
                                            );
                                            if (shouldDelete) {
                                              setQuotes((prev) =>
                                                prev.filter((item) => item.id !== q.id)
                                              );
                                              await supabase
                                                .from("quotes")
                                                .delete()
                                                .eq("id", q.id);
                                              return;
                                            }
                                          }
                                          setQuotes((prev) =>
                                            prev.map((item) =>
                                              item.id === q.id
                                                ? { ...item, durum: nextStatus }
                                                : item
                                            )
                                          );
                                          await supabase
                                            .from("quotes")
                                            .update({ durum: nextStatus })
                                            .eq("id", q.id);
                                        }}
                                        className="bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-xs"
                                      >
                                        <option value="Beklemede">Beklemede</option>
                                        <option value="İş Başladı">İş Başladı</option>
                                        <option value="Tamamlandı">Tamamlandı</option>
                                        <option value="İptal">İptal</option>
                                      </select>
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-medium">
                                      ₺{q.ana_tutar_rakam.toLocaleString("tr-TR")}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        value={draftVal}
                                        onChange={(e) => {
                                          const digits = e.target.value.replace(
                                            /\D/g,
                                            ""
                                          );
                                          const rawNum = digits
                                            ? parseInt(digits, 10)
                                            : 0;
                                          const clamped = Math.min(
                                            Math.max(0, rawNum),
                                            q.ana_tutar_rakam
                                          );
                                          setTahsilDrafts((prev) => ({
                                            ...prev,
                                            [q.id]: clamped.toLocaleString("tr-TR"),
                                          }));
                                          setQuotes((prev) =>
                                            prev.map((item) =>
                                              item.id === q.id
                                                ? { ...item, tahsil_edilen: clamped }
                                                : item
                                            )
                                          );
                                        }}
                                        onBlur={async () => {
                                          const numeric = Math.min(
                                            Math.max(0, Number(q.tahsil_edilen || 0)),
                                            q.ana_tutar_rakam
                                          );
                                          await supabase
                                            .from("quotes")
                                            .update({ tahsil_edilen: numeric })
                                            .eq("id", q.id);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            (e.target as HTMLInputElement).blur();
                                          }
                                        }}
                                        className="w-24 border border-slate-300 rounded-md px-2 py-1 text-xs"
                                      />
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-medium text-slate-700">
                                      ₺{remaining.toLocaleString("tr-TR")}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <div className="flex flex-col gap-1 w-32">
                                        <input
                                          type="date"
                                          value={q.hatirlatma_tarihi || ""}
                                          onChange={async (e) => {
                                            const val = e.target.value;
                                            setQuotes((prev) =>
                                              prev.map((item) =>
                                                item.id === q.id
                                                  ? {
                                                      ...item,
                                                      hatirlatma_tarihi: val,
                                                    }
                                                  : item
                                              )
                                            );
                                            await supabase
                                              .from("quotes")
                                              .update({ hatirlatma_tarihi: val })
                                              .eq("id", q.id);
                                          }}
                                          className="border border-slate-300 rounded-md px-1.5 py-1 text-[11px] w-full"
                                        />
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              shiftMaintenanceYear(q, -1)
                                            }
                                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded py-0.5 text-[10px] font-medium"
                                          >
                                            -1 Yıl
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              shiftMaintenanceYear(q, 1)
                                            }
                                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded py-0.5 text-[10px] font-medium"
                                          >
                                            +1 Yıl
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        {notesList.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setNoteModal({
                                                quoteId: q.id,
                                                mode: "view",
                                              })
                                            }
                                            title="Notları görüntüle"
                                            className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-semibold flex items-center justify-center hover:bg-slate-700"
                                          >
                                            {notesList.length}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setNewNoteText("");
                                            setNoteModal({
                                              quoteId: q.id,
                                              mode: "add",
                                            });
                                          }}
                                          title="Not ekle"
                                          className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center"
                                        >
                                          +
                                        </button>
                                      </div>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveQuoteId(q.id);
                                            setQuote(q as any);
                                            setActiveTab("new");
                                          }}
                                          className="text-blue-600 hover:underline font-medium"
                                        >
                                          Düzenle
                                        </button>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (
                                              !window.confirm(
                                                "Bu teklifi kalıcı olarak silmek istiyor musunuz?"
                                              )
                                            )
                                              return;
                                            setQuotes((prev) =>
                                              prev.filter((item) => item.id !== q.id)
                                            );
                                            await supabase
                                              .from("quotes")
                                              .delete()
                                              .eq("id", q.id);
                                          }}
                                          className="text-red-600 hover:underline font-medium"
                                        >
                                          Sil
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Note Add / View Modal */}
      {noteModal && activeModalQuote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-5 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <h3 className="font-semibold text-sm text-slate-800">
                {noteModal.mode === "add"
                  ? "Yeni Not Ekle"
                  : `Notlar (${parseNotes(activeModalQuote.hatirlatma_notu).length})`}
              </h3>
              <button
                type="button"
                onClick={() => setNoteModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {noteModal.mode === "add" ? (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  autoFocus
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Notunuzu yazın..."
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setNoteModal(null)}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {parseNotes(activeModalQuote.hatirlatma_notu).map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="text-slate-800 whitespace-pre-wrap">{n.text}</p>
                        {n.date && (
                          <p className="text-[10px] text-slate-400">{n.date}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(activeModalQuote.id, n.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Notu sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewNoteText("");
                    setNoteModal({ quoteId: activeModalQuote.id, mode: "add" });
                  }}
                  className="w-full py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Yeni Not Ekle
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GİZLİ A4 PDF ŞABLONU */}
      {quote && (
        <PdfTemplate
          pdfRef={pdfRef}
          logoSrc={processedLogo}
          companyInfo={{
            name: firmaAdi,
            subtitle: firmaAltBaslik,
            phone: firmaTel,
          }}
          date={quote.tarih}
          buildingName={quote.bina_adi || "Belirtilmedi"}
          clientName={quote.musteri_adi || ""}
          clientPhone={formatTrPhone(quote.musteri_telefon)}
          location={quote.konum || ""}
          warranty={
            quote.garanti_var_mi
              ? `${formatGaranti(quote.garanti_suresi)} İşçilik & Uygulama Garantili`
              : "Garanti Kapsamı Dışında"
          }
          estimatedDays={
            quote.teslim_suresi_gun ? String(quote.teslim_suresi_gun) : undefined
          }
          paymentPlan={quote.odeme_plani || ""}
          items={quote.yapilacak_isler.map((item) => item.aciklama)}
          formattedTotal={quote.ana_tutar_rakam.toLocaleString("tr-TR")}
          amountInWords={quote.ana_tutar_yaziyla}
          notes={kdvNotu}
        />
      )}

      {showCompanyModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg text-slate-800">Firma Ayarları</h2>
            <input
              value={firmaAdi}
              onChange={(e) => setFirmaAdi(e.target.value)}
              placeholder="Firma Adı"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
            <input
              value={firmaAltBaslik}
              onChange={(e) => setFirmaAltBaslik(e.target.value)}
              placeholder="Alt Başlık"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
            <input
              value={firmaTel}
              onChange={(e) => setFirmaTel(e.target.value)}
              placeholder="Firma Telefonu"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
            <button
              onClick={saveSettings}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium"
            >
              Kaydet
            </button>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg text-slate-800">
              {isRegistering ? "Ücretsiz Hesap Aç" : "Giriş Yap"}
            </h2>
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="E-posta"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Şifre"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
            <button
              onClick={handleAuth}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium"
            >
              {isRegistering ? "Kayıt Ol" : "Giriş Yap"}
            </button>
            <p
              className="text-xs text-center text-slate-500 cursor-pointer"
              onClick={() => setIsRegistering(!isRegistering)}
            >
              {isRegistering
                ? "Zaten hesabınız var mı? Giriş yapın."
                : "Hesabınız yok mu? Ücretsiz kayıt olun."}
            </p>
            <button
              onClick={() => setShowAuthModal(false)}
              className="w-full text-slate-500 text-xs mt-2"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </main>
  );
}