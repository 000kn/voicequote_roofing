"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Upload, FileText, Share2, Plus, Trash2, Settings, WifiOff } from "lucide-react";

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

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [firmaAdi, setFirmaAdi] = useState("AKSOY ÇATI & İZOLASYON");
  const [firmaTel, setFirmaTel] = useState("0532 411 84 32");
  const [varsayilanYetkililer, setVarsayilanYetkililer] = useState("Yalçın Aksoy, Yavuz Aksoy");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedFirma = localStorage.getItem("tp_firma");
    const savedTel = localStorage.getItem("tp_tel");
    const savedYetkili = localStorage.getItem("tp_yetkili");
    if (savedFirma) setFirmaAdi(savedFirma);
    if (savedTel) setFirmaTel(savedTel);
    if (savedYetkili) setVarsayilanYetkililer(savedYetkili);

    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const saveSettings = () => {
    localStorage.setItem("tp_firma", firmaAdi);
    localStorage.setItem("tp_tel", firmaTel);
    localStorage.setItem("tp_yetkili", varsayilanYetkililer);
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

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await fetch(`${apiUrl}/api/parse-quote`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("API hatası");
      const data: QuoteData = await res.json();
      setQuote(data);
    } catch (err) {
      alert("Ses işlenirken hata oluştu. Backend sunucusunun açık olduğundan emin olun.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateAndSharePdf = async () => {
    if (!pdfRef.current || !quote) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const dosyaAdi = `${(quote.bina_adi || quote.musteri_adi || "Teklif").replace(/\s+/g, "_")}_${quote.tarih}.pdf`;

    const opt = {
      margin: 12,
      filename: dosyaAdi,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc: Document) => {
          clonedDoc.querySelectorAll("style, link[rel='stylesheet']").forEach((el) => el.remove());
        },
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
    };

    const pdfBlob: Blob = await html2pdf().set(opt).from(pdfRef.current).outputPdf("blob");
    const file = new File([pdfBlob], dosyaAdi, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${firmaAdi} - Fiyat Teklifi`,
      });
    } else {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = dosyaAdi;
      a.click();
    }
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
              {loading ? "Yapay zeka teklifi hazırlıyor..." : isRecording ? "Dinliyor... Bitirmek için dokun" : "Teklifi Anlatmak İçin Dokun"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Yapılacak işleri, tutarı ve garanti durumunu söyleyin</p>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer bg-slate-100 px-3 py-2 rounded-lg">
              <Upload className="w-4 h-4" />
              Ses Dosyası Yükle (.m4a / .mp3 / .ogg)
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
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

            <div>
              <label className="text-xs text-slate-500">Teklif Başlığı</label>
              <input
                value={quote.baslik}
                onChange={(e) => setQuote({ ...quote, baslik: e.target.value })}
                className="w-full border rounded-lg p-2 text-sm mt-1 font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-slate-500 block">Yapılacak İşler</label>
              {quote.yapilacak_isler.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <textarea
                    rows={2}
                    value={item.aciklama}
                    onChange={(e) => {
                      const updated = [...quote.yapilacak_isler];
                      updated[idx].aciklama = e.target.value;
                      setQuote({ ...quote, yapilacak_isler: updated });
                    }}
                    className="w-full border rounded-lg p-2 text-sm"
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
                  onChange={(e) => setQuote({ ...quote, ana_tutar_rakam: Number(e.target.value) })}
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
                  value={quote.garanti_suresi || "10 yıl"}
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
          </div>
        )}
      </div>

      {/* GİZLİ A4 PDF ŞABLONU */}
      {quote && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <div
            ref={pdfRef}
            style={{
              width: "186mm",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
              color: "#0f172a",
              padding: "16px",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "11px",
              lineHeight: "1.5",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1.5px solid #1e293b",
                paddingBottom: "10px",
                marginBottom: "14px",
              }}
            >
              <div>
                <div style={{ fontSize: "15px", fontWeight: "bold", color: "#0f172a" }}>
                  {firmaAdi}
                </div>
                <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                  Tel: {firmaTel}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: "bold", fontSize: "12px", color: "#1e293b" }}>
                  FİYAT TEKLİFİ
                </div>
                <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                  Tarih: {quote.tarih}
                </div>
              </div>
            </div>

            {(quote.bina_adi || quote.musteri_adi) && (
              <div
                style={{
                  marginBottom: "14px",
                  backgroundColor: "#f8fafc",
                  padding: "9px 11px",
                  borderRadius: "4px",
                  border: "1px solid #e2e8f0",
                  fontSize: "11px",
                }}
              >
                {quote.bina_adi && (
                  <div>
                    <strong>Bina / Site:</strong> {quote.bina_adi}
                  </div>
                )}
                {quote.musteri_adi && (
                  <div>
                    <strong>Sayın:</strong> {quote.musteri_adi}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                fontWeight: "bold",
                fontSize: "12px",
                marginBottom: "8px",
                textDecoration: "underline",
              }}
            >
              {quote.baslik}
            </div>
            <ol style={{ paddingLeft: "18px", marginBottom: "14px", fontSize: "11px" }}>
              {quote.yapilacak_isler.map((item, idx) => (
                <li key={idx} style={{ marginBottom: "4px" }}>
                  {item.aciklama}
                </li>
              ))}
            </ol>

            {quote.garanti_var_mi && (
              <p style={{ marginBottom: "12px", fontWeight: "bold", fontSize: "11px", color: "#065f46" }}>
                ✓{" "}
                {quote.garanti_suresi && quote.garanti_suresi !== "Belirtilmemiş"
                  ? `Yapılan uygulama ${quote.garanti_suresi} firmamız garantisi altındadır.`
                  : "Yapılan uygulama firmamız garantisi altındadır."}
              </p>
            )}

            <div
              style={{
                borderTop: "1px solid #cbd5e1",
                borderBottom: "1px solid #cbd5e1",
                padding: "9px 11px",
                margin: "12px 0",
                backgroundColor: "#f8fafc",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                Toplam Tutar: {quote.ana_tutar_rakam.toLocaleString("tr-TR")} TL (
                {quote.ana_tutar_yaziyla} Türk Lirası)
              </div>
            </div>

            {quote.alternatif_not_var_mi && quote.alternatif_aciklama && (
              <div
                style={{
                  marginBottom: "14px",
                  padding: "8px 10px",
                  border: "1px dashed #94a3b8",
                  fontSize: "10.5px",
                }}
              >
                <strong>Alternatif Seçenek:</strong> {quote.alternatif_aciklama}
                {quote.alternatif_tutar_rakam && (
                  <span>
                    {" "}
                    — {quote.alternatif_tutar_rakam.toLocaleString("tr-TR")} TL (
                    {quote.alternatif_tutar_yaziyla} TL)
                  </span>
                )}
              </div>
            )}

            <div style={{ marginTop: "28px" }}>
              <div style={{ fontSize: "10px", color: "#64748b" }}>Teklif Veren Yetkililer</div>
              <div style={{ fontWeight: "bold", fontSize: "11px", marginTop: "2px" }}>
                {aktifYetkililer}
              </div>
              <div style={{ fontSize: "10px", color: "#475569" }}>{firmaTel}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}