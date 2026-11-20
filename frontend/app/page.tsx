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

  const [firmaAdi, setFirmaAdi] = useState("AKSOY ÇATI & İZOLASYON");
  const [firmaTel, setFirmaTel] = useState("0532 411 84 32");
  const [varsayilanYetkililer, setVarsayilanYetkililer] = useState("Yalçın Aksoy, Yavuz Aksoy");
  const [kdvNotu, setKdvNotu] = useState("Fiyatlarımıza KDV dahil değildir. Teklifimiz 15 gün süreyle geçerlidir.");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const saveSettings = () => {
    localStorage.setItem("tp_firma", firmaAdi);
    localStorage.setItem("tp_tel", firmaTel);
    localStorage.setItem("tp_yetkili", varsayilanYetkililer);
    localStorage.setItem("tp_kdv_notu", kdvNotu);
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
        useCORS: true,
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
              minHeight: "265mm",
              boxSizing: "border-box",
              backgroundColor: "#ffffff",
              color: "#1e293b",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "10.5px",
              lineHeight: "1.45",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              {/* Kurumsal Üst Antet */}
              <div
                style={{
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  padding: "16px 20px",
                  borderRadius: "6px 6px 0 0",
                  borderBottom: "3px solid #d97706",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img
                    src="/logo.png"
                    alt="Firma Logosu"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    style={{
                      height: "42px",
                      width: "auto",
                      objectFit: "contain",
                      borderRadius: "4px",
                      backgroundColor: "#ffffff",
                      padding: "4px",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "0.4px" }}>
                      {firmaAdi}
                    </div>
                    <div style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "3px" }}>
                      Çatı Sistemleri • Su &amp; Isı İzolasyon Uygulamaları
                    </div>
                    <div style={{ fontSize: "10px", color: "#fbbf24", marginTop: "2px", fontWeight: "bold" }}>
                      Tel: {firmaTel}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "bold",
                      letterSpacing: "1px",
                      color: "#ffffff",
                    }}
                  >
                    FİYAT TEKLİFİ
                  </div>
                  <div style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "4px" }}>
                    Tarih: <strong style={{ color: "#ffffff" }}>{quote.tarih}</strong>
                  </div>
                </div>
              </div>

              {/* Müşteri & Teklif Koşulları Kartları */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "14px",
                  marginBottom: "16px",
                }}
              >
                {/* Sol Kart: Müşteri / Bina */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "5px",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      fontWeight: "bold",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "5px",
                    }}
                  >
                    Müşteri &amp; Yapı Bilgileri
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#0f172a" }}>
                    {quote.bina_adi || "Belirtilmedi"}
                  </div>
                  {quote.musteri_adi && (
                    <div style={{ marginTop: "2px" }}>
                      <strong>Sayın:</strong> {quote.musteri_adi}
                    </div>
                  )}
                  {quote.musteri_telefon && (
                    <div style={{ marginTop: "2px" }}>
                      <strong>İletişim:</strong> {formatTrPhone(quote.musteri_telefon)}
                    </div>
                  )}
                  {quote.konum && (
                    <div style={{ marginTop: "2px" }}>
                      <strong>Konum:</strong> {quote.konum}
                    </div>
                  )}
                </div>

                {/* Sağ Kart: İş Koşulları */}
                <div
                  style={{
                    flex: 1,
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "5px",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      fontWeight: "bold",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "5px",
                    }}
                  >
                    Uygulama &amp; Teslim Koşulları
                  </div>
                  <div>
                    <strong>Garanti:</strong>{" "}
                    {quote.garanti_var_mi
                      ? `${formatGaranti(quote.garanti_suresi)} İşçilik & Uygulama Garantili`
                      : "Garanti Kapsamı Dışında"}
                  </div>
                  {quote.teslim_suresi_gun && (
                    <div style={{ marginTop: "2px" }}>
                      <strong>Tahmini Süre:</strong> {quote.teslim_suresi_gun} İş Günü
                    </div>
                  )}
                  {quote.pesinat && (
                    <div style={{ marginTop: "2px" }}>
                      <strong>Ödeme Planı:</strong> {quote.pesinat.toLocaleString("tr-TR")} TL Peşinat
                    </div>
                  )}
                </div>
              </div>

              {/* İş Kalemleri Tablosu */}
              <div
                style={{
                  fontSize: "11.5px",
                  fontWeight: "bold",
                  color: "#0f172a",
                  marginBottom: "8px",
                  paddingLeft: "6px",
                  borderLeft: "3px solid #d97706",
                }}
              >
                {quote.baslik}
              </div>

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: "16px",
                  fontSize: "10.5px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#1e293b", color: "#ffffff" }}>
                    <th style={{ padding: "8px", textAlign: "center", width: "36px" }}>No</th>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>
                      Yapılacak İş ve Malzeme Detayı
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quote.yapilacak_isler.map((item, idx) => (
                    <tr
                      key={idx}
                      style={{
                        backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <td
                        style={{
                          padding: "9px 8px",
                          textAlign: "center",
                          fontWeight: "bold",
                          fontSize: "10.5px",
                          color: "#475569",
                          verticalAlign: "middle",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          padding: "9px 12px",
                          color: "#0f172a",
                          verticalAlign: "middle",
                        }}
                      >
                        {item.aciklama}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Toplam Tutar Kutusu */}
              <div
                style={{
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  padding: "12px 16px",
                  borderRadius: "5px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <div style={{ fontSize: "9.5px", color: "#94a3b8", textTransform: "uppercase" }}>
                    İşçilik ve Malzeme Dahil Toplam Tutar
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#e2e8f0", marginTop: "2px" }}>
                    Yalnız: <strong>{quote.ana_tutar_yaziyla} Türk Lirası</strong>
                  </div>
                </div>
                <div style={{ fontSize: "16px", fontWeight: "bold", color: "#fbbf24" }}>
                  {quote.ana_tutar_rakam.toLocaleString("tr-TR")} TL
                </div>
              </div>

              {/* Alternatif Seçenek Kutusu */}
              {quote.alternatif_not_var_mi && quote.alternatif_aciklama && (
                <div
                  style={{
                    backgroundColor: "#fffbeb",
                    border: "1px solid #fcd34d",
                    borderLeft: "4px solid #d97706",
                    borderRadius: "4px",
                    padding: "9px 12px",
                    marginBottom: "14px",
                    fontSize: "10px",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#92400e", marginBottom: "2px" }}>
                    ALTERNATİF UYGULAMA SEÇENEĞİ
                  </div>
                  <div style={{ color: "#1e293b" }}>
                    {quote.alternatif_aciklama}
                    {quote.alternatif_tutar_rakam && (
                      <strong style={{ marginLeft: "6px", color: "#0f172a" }}>
                        — {quote.alternatif_tutar_rakam.toLocaleString("tr-TR")} TL (
                        {quote.alternatif_tutar_yaziyla} TL)
                      </strong>
                    )}
                  </div>
                </div>
              )}

              {/* Genel Teklif Koşulları & Notlar */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "5px",
                  padding: "10px 12px",
                  marginBottom: "14px",
                  fontSize: "9.5px",
                  color: "#475569",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: "bold",
                    color: "#334155",
                    textTransform: "uppercase",
                    letterSpacing: "0.4px",
                    marginBottom: "4px",
                  }}
                >
                  Teklif Koşulları &amp; Genel Notlar
                </div>
                <div style={{ lineHeight: "1.5" }}>
                  • {kdvNotu}
                  <br />• Belirtilen tutar, yukarıda kapsamı yazılı işler için anahtar teslim götürü bedeldir.
                  <br />• İş başlangıcında iş güvenliği tedbirleri ve malzeme sevkiyatı firmamız tarafından sağlanacaktır.
                </div>
              </div>
            </div>

            {/* Alt Kaşe & İmza Alanı */}
            <div
              style={{
                borderTop: "1px solid #cbd5e1",
                paddingTop: "14px",
                marginTop: "20px",
                display: "flex",
                justifyContent: "space-between",
                gap: "24px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  border: "1px dashed #cbd5e1",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  minHeight: "56px",
                }}
              >
                <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase" }}>
                  Müşteri / Yönetici Onayı
                </div>
                <div style={{ fontSize: "10px", fontWeight: "bold", marginTop: "3px" }}>
                  {quote.musteri_adi || quote.bina_adi || "İmza / Kaşe"}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "4px",
                  padding: "10px 12px",
                  minHeight: "56px",
                  textAlign: "right",
                }}
              >
                <div style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase" }}>
                  Teklif Veren Firma Yetkilisi
                </div>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: "#0f172a", marginTop: "3px" }}>
                  {aktifYetkililer}
                </div>
                <div style={{ fontSize: "9.5px", color: "#475569", marginTop: "1px" }}>
                  {firmaAdi} • {firmaTel}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}