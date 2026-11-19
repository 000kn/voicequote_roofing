import os
from datetime import datetime
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()
load_dotenv("usta_decoder/.env")

app = FastAPI(title="TeklifPro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# ==========================================
# 1. AI ÇIKTI ŞEMASI & API YANIT MODELİ
# ==========================================
class TeklifKalemi(BaseModel):
    aciklama: str = Field(
        description="Standartlaştırılmış iş/malzeme maddesi (Baş harf büyük, sonu noktalı)"
    )
    miktar: Optional[float] = Field(default=None, description="Varsa miktar veya alan")
    birim: Optional[str] = Field(default=None, description="Varsa birim (m2, metre, adet vb.)")
    birim_fiyat: Optional[float] = Field(default=None, description="Varsa birim fiyat (TL)")
    toplam_fiyat: Optional[float] = Field(default=None, description="Varsa kalem toplamı (TL)")


# Gemini'nin dolduracağı şema (Tarih alanı burada yok, uyduramaz)
class GeminiQuoteOutput(BaseModel):
    raw_transcript: str = Field(description="Ses kaydının birebir ham dökümü")
    musteri_adi: Optional[str] = Field(None, description="Sadece müşteri veya yönetici adı")
    musteri_telefon: Optional[str] = Field(
        None, description="Sadece MÜŞTERİYE ait telefon numarası (Teklif verenin numarasını yazma)"
    )
    bina_adi: Optional[str] = Field(None, description="Apartman, site veya iş yeri adı")
    konum: Optional[str] = Field(None, description="İl/ilçe/semt bilgisi")
    baslik: str = Field(
        default="Binanızda yapılacak işler:",
        description="Yapılacak işler listesinin üzerindeki ana başlık",
    )
    yapilacak_isler: List[TeklifKalemi] = Field(
        description="Sırayla yapılacak işler ve varsa miktar/fiyat detayları"
    )
    ana_tutar_rakam: float = Field(description="İşçilik ve malzeme dahil ana tutar (TL)")
    ana_tutar_yaziyla: str = Field(
        description="Ana tutarın kurumsal yazıyla ifadesi (Rakam veya TL ekleme. Örn: 'Altmış Bin')"
    )
    amount_verified: bool = Field(
        description="Kalem fiyatları söylendiyse toplamları genel tutarla örtüşüyor mu? Kalem fiyatı yoksa True yap."
    )
    pesinat: Optional[float] = Field(None, description="İstenen peşinat tutarı (TL)")
    teslim_suresi_gun: Optional[int] = Field(None, description="Tahmini iş süresi (gün)")
    garanti_var_mi: bool = Field(
        default=True,
        description="'Garanti yok', 'garantisiz' dendiğinde veya garanti belirtilmediğinde False yap.",
    )
    garanti_suresi: Optional[str] = Field(
        default="10 yıl", description="Garanti süresi (Garanti yoksa None)"
    )
    alternatif_not_var_mi: bool = Field(default=False)
    alternatif_aciklama: Optional[str] = Field(
        None, description="Alternatif uygulama açıklaması (İçine fiyat yazma)"
    )
    alternatif_tutar_rakam: Optional[float] = Field(None)
    alternatif_tutar_yaziyla: Optional[str] = Field(None)
    ozel_yetkililer: Optional[List[str]] = Field(
        default=None,
        description="Ses kaydında imza/teklif veren kısmıyla ilgili ÖZEL bir değişiklik istendiyse doldur, yoksa None bırak.",
    )
    bakim_takibi_gerekli: bool = Field(
        default=False, description="Periyodik bakım takibi gerekiyor mu?"
    )
    missing_critical_info: List[str] = Field(
        default_factory=list,
        description="Eksik kritik bilgiler (Örn: Bina adı, Müşteri adı, Fiyat)",
    )


# Frontend'e dönecek nihai yanıt (Gerçek sunucu tarihi eklenmiş hali)
class DecodedQuoteResponse(GeminiQuoteOutput):
    tarih: str


SYSTEM_PROMPT = """
Sen inşaat, çatı ve tadilat ustalarının şantiyede aldığı ses kayıtlarını kurumsal teklif verisine dönüştüren bir yapay zeka asistanısın.

GÖREV VE KURALLAR:
1. Önce sesi birebir çözüp 'raw_transcript' alanına yaz.
2. 'yapilacak_isler' maddelerini Türkçe imla kurallarına uygun yaz (Baş harf büyük, sonu noktalı). Sektör terimlerini (membran, kiremit aktarma, gizli dere, izocam, şap, PPRC boru vb.) doğru yaz.
3. BAŞLIK: Varsayılan 'Binanızda yapılacak işler:'. Konuşmada özel bir giriş cümlesi söylendiyse 'baslik' alanına onu yaz.
4. GARANTİ: Konuşmada 'garanti yok', 'garantisiz' denirse veya garantiden hiç bahsedilmezse 'garanti_var_mi' = False ve 'garanti_suresi' = None yap.
5. YAZIYLA TUTAR: 'ana_tutar_yaziyla' ve 'alternatif_tutar_yaziyla' alanlarına sadece baş harfleri büyük kelimeler yaz; rakam, 'lira' veya 'TL' ekleme (Örn: 'Altmış Beş Bin').
6. TELEFON VE İMZA AYRIMI: Konuşmada teklifi veren ustanın/firmanın kendi numarası veya imza değişikliği geçiyorsa bunu kesinlikle 'musteri_telefon' alanına YAZMA; özel imza talimatı varsa 'ozel_yetkililer' listesine ekle, yoksa None bırak.
7. DOĞRULAMA: Kalem fiyatları tek tek söylendiyse toplamlarını genel tutarla kıyasla ve 'amount_verified' alanını belirle. Söylenmeyen hiçbir bilgiyi uydurma.
"""


# ==========================================
# 2. SES -> JSON ENDPOINT
# ==========================================
@app.post("/api/parse-quote", response_model=DecodedQuoteResponse)
async def parse_quote(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Boş ses dosyası.")

    mime_type = audio.content_type or "audio/mp4"
    models = ["gemini-3.5-flash-lite", "gemini-3.5-flash"]
    last_error = None

    for model_name in models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                    "Bu ses kaydını analiz et ve teklif şemasını doldur.",
                ],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=GeminiQuoteOutput,
                    temperature=0.1,
                ),
            )
            parsed = GeminiQuoteOutput.model_validate_json(response.text)
            bugun = datetime.now().strftime("%d.%m.%Y")
            return DecodedQuoteResponse(**parsed.model_dump(), tarih=bugun)
        except Exception as e:
            last_error = e
            continue

    raise HTTPException(status_code=503, detail=f"AI servisi yanıt vermedi: {last_error}")