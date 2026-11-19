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
            {/* Üst Antet */}
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

            {/* Müşteri / Bina Bilgisi */}
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

            {/* İş Kalemleri */}
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

            {/* Garanti */}
            {quote.garanti_var_mi && (
              <p style={{ marginBottom: "12px", fontWeight: "bold", fontSize: "11px", color: "#065f46" }}>
                ✓{" "}
                {quote.garanti_suresi && quote.garanti_suresi !== "Belirtilmemiş"
                  ? `Yapılan uygulama ${quote.garanti_suresi} firmamız garantisi altındadır.`
                  : "Yapılan uygulama firmamız garantisi altındadır."}
              </p>
            )}

            {/* Toplam Tutar */}
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

            {/* Alternatif Not */}
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

            {/* İmza Bloğu */}
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