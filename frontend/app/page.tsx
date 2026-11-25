"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Upload, FileText, Share2, Plus, Trash2, Settings, WifiOff, LogIn, LogOut, Crown, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { processLogoImage } from "../utils/logoProcessor";
import { PdfTemplate } from "../components/PdfTemplate";
import { PaymentSlider } from "../components/PaymentSlider";

interface TeklifKalemi {
  aciklama: string;
  miktar?: number | null;
  birim?: string | null;
  birim_fiyat?: number | null;
  toplam_fiyat?: number | null;
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
  odeme_plani: string | null; // <-- EKLENDİ
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

function formatTrPhone(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  const normalized = digits.length === 10 && digits.startsWith("5") ? `0${digits}` : digits;
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
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const [firmaAdi, setFirmaAdi] = useState("AKSOY ÇATI & İZOLASYON");
  const [firmaTel, setFirmaTel] = useState("0532 411 84 32");
  const [varsayilanYetkililer, setVarsayilanYetkililer] = useState("Yalçın Aksoy, Yavuz Aksoy");
  const [kdvNotu, setKdvNotu] = useState("Fiyatlarımıza KDV dahil değildir. Teklifimiz 15 gün süreyle geçerlidir.");
  const [processedLogo, setProcessedLogo] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (quote) {
      // 3. Ödeme Planı: Sadece plan boşsa veya varsayılan 40/60 planıysa otomatik dolsun
      const pesinat = quote.ana_tutar_rakam * 0.4;
      const kalan = quote.ana_tutar_rakam * 0.6;
      const defaultPlan = `%40 Peşin (${pesinat.toLocaleString("tr-TR")} TL) - %60 İş Tesliminde (${kalan.toLocaleString("tr-TR")} TL)`;

      // Sadece boşsa veya varsayılan 40/60 planıysa (yani %60 İş Tesliminde içeriyorsa) güncelle
      if (!quote.odeme_plani || quote.odeme_plani.includes("%60 İş Tesliminde")) {
        setQuote(prev => prev ? ({
          ...prev,
          odeme_plani: defaultPlan
        }) : null);
      }
    }
  }, [quote?.ana_tutar_rakam]);

  // 4. Mevcut Uzun Maddelerin İlk Açılışta Tam Görünmesi
  useEffect(() => {
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  }, [quote?.yapilacak_isler]);

  useEffect(() => {
    processLogoImage("/logo.png").then(setProcessedLogo);
  }, []);

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
    const savedTel = localStorage.getItem("tp_tel");
    const savedYetkili = localStorage.getItem("tp_yetkili");
    const savedKdv = localStorage.getItem("tp_kdv_notu");
    if (savedFirma) setFirmaAdi(savedFirma);
    if (savedTel) setFirmaTel(savedTel);
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
        if (data.varsayilan_yetkililer) setVarsayilanYetkililer(data.varsayilan_yetkililer);
        if (data.kdv_notu) setKdvNotu(data.kdv_notu);
        if (data.is_pro !== undefined) setIsPro(data.is_pro);
      }
    } catch (e) {
      console.error("Profil çekilemedi:", e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert("Kayıt başarılı! Giriş yapabilirsiniz.");
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
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
    localStorage.setItem("tp_tel", firmaTel);
    localStorage.setItem("tp_yetkili", varsayilanYetkililer);
    localStorage.setItem("tp_kdv_notu", kdvNotu);

    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        firma_adi: firmaAdi,
        firma_tel: firmaTel,
        varsayilan_yetkililer: varsayilanYetkililer,
        kdv_notu: kdvNotu,
        updated_at: new Date().toISOString(),
      });
    }
    setShowSettings(false);
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
      'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'I',
      'Ç': 'C', 'Ğ': 'G', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    };
    return text.replace(/[çğıöşüİÇĞÖŞÜ]/g, m => trMap[m]).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.]/g, "");
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
          clonedDoc.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => el.remove());
        },
      },
      jsPDF: { unit: "px", format: [794, 1123], orientation: "portrait" as const },
    };

    const pdfBlob: Blob = await html2pdf().set(opt).from(pdfRef.current).outputPdf("blob");
    return { blob: pdfBlob, name: dosyaAdi };
  };

  const generateAndSharePdf = async () => {
    const pdfData = await generatePdfBlob();
    if (!pdfData) return;
    
    const file = new File([pdfData.blob], pdfData.name, { type: "application/pdf" });

    if (user) {
      await supabase.from("quotes").insert([
        {
          user_id: user.id,
          tarih: quote.tarih,
          musteri_adi: quote.musteri_adi,
          bina_adi: quote.bina_adi,
          konum: quote.konum,
          ana_tutar_rakam: quote.ana_tutar_rakam,
          quote_data: quote,
        },
      ]);
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
    a.click();
  };

  const aktifYetkililer =
    quote?.ozel_yetkililer && quote.ozel_yetkililer.length > 0
      ? quote.ozel_yetkililer.join(" - ")
      : varsayilanYetkililer;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      <header className="bg-slate-900 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow">
        <div>
          <h1 className="font-bold text-lg tracking-tight">TeklifPro</h1>
          <p className="text-xs text-slate-400">{firmaAdi}</p>
        </div>
        <div className="flex items-center gap-3">
          {isOffline && <WifiOff className="w-5 h-5 text-amber-400" />}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-6">
        {showSettings && (
          <div className="bg-white p-4 rounded-2xl shadow-md space-y-3 border border-slate-200">
            <h2 className="font-semibold text-sm text-slate-700">Firma & İmza Ayarları</h2>
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
            className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center shadow-lg transition-all ${
              isRecording ? "bg-red-600 animate-pulse scale-105" : "bg-amber-600 hover:bg-amber-700"
            } text-white`}
          >
            {isRecording ? <Square className="w-9 h-9" /> : <Mic className="w-10 h-10" />}
          </button>

          <div>
            <p className="font-semibold text-slate-800">
              {loading
                ? "Yapay zeka teklifi hazırlıyor..."
                : isRecording
                ? "Dinliyor... Bitirmek için dokun"
                : "Teklifi Anlatmak İçin Dokun"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Yapılacak işleri, tutarı ve garanti durumunu söyleyin</p>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer bg-slate-100 px-3 py-2 rounded-lg">
              <Upload className="w-4 h-4" />
              Ses Dosyası Yükle (.m4a / .mp3 / .ogg)
              <input type="file" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {quote && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" /> Teklif Düzenleme
              </span>
              <span className="text-xs bg-slate-100 px-2.5 py-1 rounded-md font-medium">{quote.tarih}</span>
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
                    style={{ height: 'auto', minHeight: '60px' }}
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

            {/* Toplam Tutar ve Yazıyla Tutar */}
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
                    
                    // Check if current plan is empty or seems like the previous auto-generated one
                    const isDefault = !quote.odeme_plani || quote.odeme_plani.includes("%60 İş Tesliminde");
                    
                    setQuote({
                      ...quote,
                      ana_tutar_rakam: val,
                      odeme_plani: isDefault ? defaultPlan : quote.odeme_plani
                    });
                  }}
                  className="w-full border rounded-lg p-2 text-sm font-bold mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Yazıyla Tutar</label>
                <input
                  value={quote.ana_tutar_yaziyla}
                  onChange={(e) => setQuote({ ...quote, ana_tutar_yaziyla: e.target.value })}
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
                onChange={(e) => setQuote({ ...quote, teslim_suresi_gun: Number(e.target.value) })}
                className="w-full border rounded-lg p-2 text-sm mt-1"
              />
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={quote.garanti_var_mi}
                  onChange={(e) => setQuote({ ...quote, garanti_var_mi: e.target.checked })}
                  className="w-4 h-4 accent-amber-600"
                />
                Garanti Kapsamında
              </label>
              {quote.garanti_var_mi && (
                <input
                  value={quote.garanti_suresi || "10 Yıl"}
                  onChange={(e) => setQuote({ ...quote, garanti_suresi: e.target.value })}
                  className="w-24 border rounded-lg p-1.5 text-xs text-center bg-white"
                />
              )}
            </div>

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
      </div>

      {/* GİZLİ A4 PDF ŞABLONU */}
      {quote && (
        <PdfTemplate
          pdfRef={pdfRef}
          logoSrc={processedLogo || "/logo.png"}
          companyName={firmaAdi}
          companyPhone={firmaTel}
          date={quote.tarih}
          buildingName={quote.bina_adi || "Belirtilmedi"}
          clientName={quote.musteri_adi || ""}
          clientPhone={formatTrPhone(quote.musteri_telefon)}
          location={quote.konum || ""}
          warranty={quote.garanti_var_mi ? `${formatGaranti(quote.garanti_suresi)} İşçilik & Uygulama Garantili` : "Garanti Kapsamı Dışında"}
          estimatedDays={quote.teslim_suresi_gun ? String(quote.teslim_suresi_gun) : undefined}
          paymentPlan={quote.odeme_plani || ""}
          items={quote.yapilacak_isler.map((item) => item.aciklama)}
          formattedTotal={quote.ana_tutar_rakam.toLocaleString("tr-TR")}
          amountInWords={quote.ana_tutar_yaziyla}
          notes={kdvNotu}
        />
      )}
    </main>
  );
}