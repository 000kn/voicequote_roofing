import React from 'react';

export interface PdfTemplateProps {
  pdfRef: React.RefObject<HTMLDivElement | null>;
  logoSrc?: string;
  companyName?: string;
  companySubtitle?: string;
  companyPhone?: string;
  date: string;
  buildingName: string;
  clientName: string;
  clientPhone?: string;
  location?: string;
  warranty?: string;
  estimatedDays?: string;
  paymentPlan?: string;
  items: string[];
  formattedTotal: string;
  amountInWords: string;
  notes?: string;
}

export const PdfTemplate: React.FC<PdfTemplateProps> = ({
  pdfRef,
  logoSrc,
  companyName = 'AKSOY ÇATI & İZOLASYON',
  companySubtitle = 'Su ve Isı İzolasyon Uygulamaları',
  companyPhone = '0532 411 84 32',
  date,
  buildingName,
  clientName,
  clientPhone,
  location,
  warranty = '10 Yıl İşçilik & Uygulama Garantili',
  estimatedDays,
  paymentPlan,
  items,
  formattedTotal,
  amountInWords,
  notes = 'Fiyatlarımıza KDV dahil değildir. Teklifimiz 15 gün süreyle geçerlidir.',
}) => {
  return (
    <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
      <div
        ref={pdfRef}
        style={{
          width: '794px',
          padding: '72px 56px 24px 56px',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {/* Antet / Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #000000',
            paddingBottom: '14px',
            marginBottom: '22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {logoSrc && (
              <img
                src={logoSrc}
                alt="Firma Logosu"
                style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
              />
            )}
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#000000', letterSpacing: '0.3px' }}>
                {companyName}
              </div>
              {companySubtitle && (
                <div style={{ fontSize: '11px', color: '#000000', marginTop: '2px' }}>
                  {companySubtitle}
                </div>
              )}
              {companyPhone && (
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#000000', marginTop: '2px' }}>
                  Tel: {companyPhone}
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: '12px', fontWeight: 700, color: '#000000' }}>
            Tarih: {date}
          </div>
        </div>

        {/* Müşteri & Yapı Bilgileri */}
        <div style={{ marginBottom: '16px', fontSize: '12px', lineHeight: 1.5, color: '#000000' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px', color: '#000000' }}>
            MÜŞTERİ & YAPI BİLGİLERİ
          </div>
          {buildingName && <div style={{ fontWeight: 700 }}>{buildingName}</div>}
          {clientName && (
            <div>
              <strong>Sayın:</strong> {clientName}
            </div>
          )}
          {clientPhone && (
            <div>
              <strong>İletişim:</strong> {clientPhone}
            </div>
          )}
          {location && (
            <div>
              <strong>Konum:</strong> {location}
            </div>
          )}
        </div>

        {/* Uygulama & Teslim Koşulları */}
        <div style={{ marginBottom: '20px', fontSize: '12px', lineHeight: 1.5, color: '#000000' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px', color: '#000000' }}>
            UYGULAMA & TESLİM KOŞULLARI
          </div>
          {warranty && (
            <div>
              <strong>Garanti:</strong> {warranty}
            </div>
          )}
          {estimatedDays && (
            <div>
              <strong>Tahmini Süre:</strong> {estimatedDays} İş Günü
            </div>
          )}
          {paymentPlan && (
            <div>
              <strong>Ödeme Planı:</strong> {paymentPlan}
            </div>
          )}
        </div>

        {/* Yapılacak İşler Tablosu */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '22px',
            fontSize: '12px',
            color: '#000000',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: 'transparent', borderBottom: 'none' }}>
              <th style={{ width: '40px', padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}></th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, fontSize: '12px' }}>
                Yapılacak İş ve Malzeme Detayı
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td
                  style={{
                    padding: '7px 8px',
                    textAlign: 'center',
                    verticalAlign: 'top',
                    fontSize: '12px',
                    color: '#000000',
                  }}
                >
                  {index + 1}
                </td>
                <td
                  style={{
                    padding: '7px 8px',
                    verticalAlign: 'top',
                    lineHeight: 1.45,
                    fontSize: '12px',
                    color: '#000000',
                  }}
                >
                  {item}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Toplam Tutar */}
        <div style={{ textAlign: 'right', marginBottom: '24px', color: '#000000' }}>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>
            TOPLAM: {formattedTotal} TL
          </div>
          {amountInWords && (
            <div style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '2px' }}>
              Yalnız: {amountInWords}
            </div>
          )}
        </div>

        {/* Teklif Koşulları & Genel Notlar */}
        <div style={{ marginBottom: '12px', color: '#000000' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px' }}>
            TEKLİF KOŞULLARI & GENEL NOTLAR
          </div>
          <div style={{ fontSize: '11px', lineHeight: 1.45 }}>{notes}</div>
        </div>

        {/* İmza Alanı (Madde sayısına göre adaptif boşluk) */}
        <div
          style={{
            marginTop: items.length >= 7 ? '48px' : '128px',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-start',
            color: '#000000',
          }}
        >
          <div style={{ textAlign: 'center', width: '180px' }}>
            <div style={{ borderTop: '1px solid #000000', paddingTop: '6px', fontSize: '10px' }}>
              MÜŞTERİ / YÖNETİCİ ONAYI
            </div>
          </div>
          <div style={{ textAlign: 'center', width: '180px' }}>
            <div style={{ borderTop: '1px solid #000000', paddingTop: '6px', fontSize: '10px' }}>
              TEKLİF VEREN FİRMA YETKİLİSİ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};