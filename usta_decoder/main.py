import json
import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from fpdf import FPDF
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field
from typing import List, Optional

# Windows konsol Türkçe karakter desteği
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# ==========================================
# 1. VERİ ŞEMASI (Pydantic)
# ==========================================
class KarmaşıkTeklif(BaseModel):
    tarih: str = Field(
        default_factory=lambda: datetime.now().strftime("%d.%m.%Y"),
        description="Teklif tarihi (DD.MM.YYYY formatında)",
    )
    baslik: str = Field(
        default="Binanızın çatısında yapılacak işler:",
        description="Yapılacak işler listesinin üzerindeki ana başlık metni veya ses kaydında söylenen cümle/özel başlık.",
    )
    yapilacak_isler: List[str] = Field(
        description="Binanın çatısında veya uygulama alanında yapılacak işlerin sırayla maddeleri"
    )
    ana_tutar_rakam: float = Field(
        description="İşçilik ve malzeme dahil ana tutar"
    )
    ana_tutar_yaziyla: str = Field(
        description=(
            "Ana tutarın kurumsal yazıyla ifadesi (Örn: 'Altmış Bin')"
        )
    )
    garanti_var_mi: bool = Field(
        default=True,
        description="Teklifte garanti ve çalışma şartları yer alacak mı? Ses kaydında 'garanti yok', 'garantisiz' dendiğinde veya garanti belirtilmediğinde False yap."
    )
    garanti_suresi: Optional[str] = Field(
        default="10 yıl", description="Garantili olduğu yıl sayısı (Garanti yoksa None)"
    )

    alternatif_not_var_mi: bool = Field(default=False)
    alternatif_aciklama: Optional[str] = Field(
        None,
        description=(
            "NOT kısmındaki sadece alternatif uygulama açıklaması"
        ),
    )
    alternatif_tutar_rakam: Optional[float] = Field(None)
    alternatif_tutar_yaziyla: Optional[str] = Field(None)

    teklif_veren_baslik_goster: bool = Field(
        default=True,
        description="'Teklif Veren / Firma Yetkilisi' başlığı gösterilsin mi? 'Başlığı kaldır', 'Sadece isim yaz' dendiğinde False yap."
    )
    teklif_veren_baslik_metni: str = Field(
        default="Teklif Veren / Firma Yetkilisi",
        description="Teklif veren kısmının başlık metni."
    )
    yetkililer: List[str] = Field(
        default=[
            "YALÇIN AKSOY – 0532 411 48 38",
            "YAVUZ AKSOY – 0532 291 38 18",
            "Mim. OKAN AKSOY – oda no: 67763",
        ],
        description="Teklifi veren yetkililerin isim ve iletişim listesi. Ses kaydında özel isim/numara belirtildiyse (örn: 'Oğuz Çelik – 0532 291 38 18') doğrudan o isimleri yaz."
    )


# ==========================================
# 2. AKSOY ÇATI PDF TEMA SINIFI
# ==========================================
class AksoyTeklifPDF(FPDF):

    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")

        # A4 GENEL SAYFA MARJİNLERİ (Sol: 25mm, Üst: 20mm, Sağ: 25mm)
        self.set_margins(left=25, top=20, right=25)
        self.set_auto_page_break(auto=True, margin=20)

        # Windows Calibri Fontları
        font_path = r"C:\Windows\Fonts\calibri.ttf"
        font_bold_path = r"C:\Windows\Fonts\calibrib.ttf"

        self.add_font("CalibriTR", "", font_path)
        self.add_font("CalibriTR", "B", font_bold_path)

        self.logo_bottom_y = 60.0

    def header(self):
        logo_yolu = "logo.png"

        if os.path.exists(logo_yolu):
            box_x = 30.0  # 3 cm sol boşluk
            box_y = 25.0  # 2.5 cm üst boşluk
            max_w = 50.0  # 5 cm maksimum genişlik
            max_h = 35.0  # 3.5 cm maksimum yükseklik

            with Image.open(logo_yolu) as img:
                img_rgba = img.convert("RGBA")
                alpha = img_rgba.split()[-1]
                bbox = alpha.getbbox()
                cropped_img = img.crop(bbox) if bbox else img

                orig_w, orig_h = cropped_img.size
                aspect = orig_w / orig_h
                box_aspect = max_w / max_h

                if aspect > box_aspect:
                    render_w = max_w
                    render_h = max_w / aspect
                else:
                    render_h = max_h
                    render_w = max_h * aspect

                self.image(
                    cropped_img, x=box_x, y=box_y, w=render_w, h=render_h
                )
                self.logo_bottom_y = box_y + render_h
        else:
            self.set_font("CalibriTR", "B", 22)
            self.cell(0, 8, "AKSOY", align="L", new_x="LMARGIN", new_y="NEXT")
            self.set_font("CalibriTR", "B", 11)
            self.cell(
                0,
                5,
                "ÇATI SİSTEMLERİ",
                align="L",
                new_x="LMARGIN",
                new_y="NEXT",
            )
            self.logo_bottom_y = self.get_y()


def aksoy_pdf_olustur(veri: KarmaşıkTeklif, cikti_dosyasi="aksoy_teklif.pdf"):
    pdf = AksoyTeklifPDF()
    pdf.add_page()

    bugun_str = datetime.now().strftime("%d.%m.%Y")

    # TARİH: Logonun alt hizasına tam yapışık ve sağa dayalı (12 pt)
    tarih_y = pdf.logo_bottom_y - 5.0
    pdf.set_y(tarih_y)
    pdf.set_font("CalibriTR", size=12)
    pdf.cell(0, 5, bugun_str, align="R", new_x="LMARGIN", new_y="NEXT")

    # Logonun altından başlık başlangıcına geçiş
    baslik_y = pdf.logo_bottom_y + 10.0
    pdf.set_y(baslik_y)

    # DİNAMİK BAŞLIK: Maddelerin hizasıyla aynı (Sol: 30 mm / 3 cm), Sonu İki Noktalı (:)
    pdf.set_left_margin(30)
    pdf.set_x(30)
    pdf.set_font("CalibriTR", "B", 14)

    baslik_metni = veri.baslik.strip()
    if not baslik_metni.endswith(":"):
        baslik_metni += ":"

    pdf.multi_cell(155, 6.5, baslik_metni)
    pdf.ln(3)

    # MADDELER: Soldan 3 cm (30 mm), Sağdan 2.5 cm (25 mm) boşluk (14 pt)
    pdf.set_left_margin(30)
    pdf.set_font("CalibriTR", size=14)
    for i, madde in enumerate(veri.yapilacak_isler, 1):
        madde_temiz = madde.strip()
        if not madde_temiz.endswith((".", "!", "?")):
            madde_temiz += "."
        metin = f"{i}. {madde_temiz}"
        pdf.set_x(30)
        pdf.multi_cell(155, 6.5, metin)
        pdf.ln(2)

    pdf.ln(3)

    # GENEL MARJİNE DÖNÜŞ (Sol: 2.5 cm / 25 mm)
    pdf.set_left_margin(25)

    # TUTAR ALANI (14 pt Bold)
    pdf.set_x(25)
    pdf.set_font("CalibriTR", "B", 14)
    tutar_str = f"{veri.ana_tutar_rakam:,.0f}".replace(",", ".")
    tutar_metni = f"TUTARI: İşçilik ve malzeme dahil {tutar_str} ({veri.ana_tutar_yaziyla}) TL + KDV'dir."
    pdf.multi_cell(160, 6.5, tutar_metni)
    pdf.ln(4)

    # GARANTİ & ŞARTLAR (Opsiyonel)
    if veri.garanti_var_mi and veri.garanti_suresi:
        pdf.set_font("CalibriTR", size=14)
        garanti_metni = (
            veri.garanti_suresi
            if "yıl" in veri.garanti_suresi.lower()
            else f"{veri.garanti_suresi} yıl"
        )
        pdf.set_x(25)
        pdf.multi_cell(
            160,
            6.5,
            f"Çatı onarımı firmamız tarafından {garanti_metni} garantilidir.",
        )
        pdf.ln(1)
        pdf.set_x(25)
        pdf.multi_cell(
            160,
            6.5,
            (
                "Çalışmalar ara vermeden tamamlanacaktır. Çalışan elemanların"
                " sorumluluğu firmamıza aittir."
            ),
        )
        pdf.ln(4)

    # VARSA NOT / ALTERNATİF (14 pt Bold)
    if veri.alternatif_not_var_mi and veri.alternatif_aciklama:
        alt_tutar_str = (
            f"{veri.alternatif_tutar_rakam:,.0f}".replace(",", ".")
            if veri.alternatif_tutar_rakam
            else ""
        )
        not_aciklama = veri.alternatif_aciklama.strip()
        if not not_aciklama.endswith((".", ",", ";")):
            not_aciklama += "."

        not_metni = f"NOT: {not_aciklama}\nTUTARI: İşçilik ve malzeme dahil {alt_tutar_str} ({veri.alternatif_tutar_yaziyla}) TL + KDV'dir."
        pdf.set_x(25)
        pdf.set_font("CalibriTR", "B", 14)
        pdf.multi_cell(160, 6.5, not_metni)
        pdf.ln(4)

    # ==========================================
    # İMZA / FİRMA YETKİLİSİ BLOĞU (İçeriği Takip Eden Dinamik Yerleşim)
    # ==========================================
    pdf.ln(10)  # İçerikten sonra doğal boşluk

    # 1. Başlık (Açık ise basılır)
    if veri.teklif_veren_baslik_goster and veri.teklif_veren_baslik_metni:
        pdf.set_x(25)
        pdf.set_font("CalibriTR", "B", 11)
        pdf.cell(
            0, 5, veri.teklif_veren_baslik_metni, new_x="LMARGIN", new_y="NEXT"
        )
        pdf.ln(1)

    # 2. Yetkili Listesi (11 pt Normal)
    pdf.set_font("CalibriTR", size=11)
    for yetkili in veri.yetkililer:
        pdf.set_x(25)
        pdf.cell(0, 4.8, yetkili, new_x="LMARGIN", new_y="NEXT")

    pdf.output(cikti_dosyasi)
    print(f"\n[BAŞARILI] PDF oluşturuldu: {cikti_dosyasi}")


# ==========================================
# 3. ANA SÜREÇ (Gemini 3.5-Flash-Lite)
# ==========================================
def sesi_teklife_donustur(ses_dosyasi_yolu: str):
    print("1/2: Ses yükleniyor ve Gemini verileri ayıklıyor...")
    audio_file = client.files.upload(file=ses_dosyasi_yolu)

    prompt = """
    Sen Aksoy ÇATI Sistemleri için teklif hazırlayan bir yapay zeka asistanısın.
    Bu ses kaydını dinle ve 'yapilacak_isler' listesini oluştur.

    BAŞLIK KONTROLÜ:
    - Varsayılan başlık 'Binanızın çatısında yapılacak işler:' metnidir.
    - Konuşmada başlık için özel cümle söylenirse (Örn: 'Binanızın çatısında keşif sonucu akan yerler tespit edilmiştir') 'baslik' alanına o cümleyi aktar.

    GARANTİ KONTROLÜ:
    - Konuşmada garanti verilmediği, 'garantisiz', 'garantisi yok' ifade edildiğinde 'garanti_var_mi' değerini False yap.

    TEKLİF VEREN / İMZA LİSTESİ MANİPÜLASYONU:
    1. 'teklif_veren_baslik_goster': Ses kaydında 'Teklif veren başlığını kaldır', 'Başlık olmasın', 'Sadece ismi yaz' gibi bir talep varsa bu değeri False yap.
    2. 'yetkililer':
       - Standart liste:
         ["YALÇIN AKSOY – 0532 411 48 38", "YAVUZ AKSOY – 0532 291 38 18", "Mim. OKAN AKSOY – oda no: 67763"]
       - Eğer ses kaydında 'Okan olmasın' denirse Okan satırını çıkar.
       - Eğer ses kaydında özel bir isim ve numara söylendiyse (Örn: 'Teklif veren kısmını kaldır, sadece Oğuz Çelik yaz, numarası 05322913818'), 'yetkililer' listesini tamamen temizle ve sadece ["Oğuz Çelik – 05322913818"] olarak ayarla.

    FORMATLAMA KURALLARI:
    1. 'yapilacak_isler' maddelerini Türkçe imla kurallarına uygun yaz (Baş harf büyük, sonu noktalı). Kelime hatalarını ve duyum kaymalarını düzelt.
    2. 'ana_tutar_yaziyla' ve 'alternatif_tutar_yaziyla' alanlarını kurumsal resmi Türkçe biçimde yaz. Rakam, 'lira' veya 'TL' ekleme! Sadece baş harfleri büyük kelimeler olsun. (Örn: 'Altmış Bin').
    3. 'alternatif_aciklama' içine fiyatı yazma, sadece yapılan teknik iş/malzeme farkını yaz.
    """

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=[audio_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=KarmaşıkTeklif,
        ),
    )

    veri_dict = json.loads(response.text)
    teklif_objesi = KarmaşıkTeklif(**veri_dict)

    print("2/2: Aksoy Çatı kurumsal PDF'i basılıyor...")
    aksoy_pdf_olustur(teklif_objesi)

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


if __name__ == "__main__":
    TEST_DOSYASI = "test2.m4a"
    if os.path.exists(TEST_DOSYASI):
        sesi_teklife_donustur(TEST_DOSYASI)
    else:
        print(f"Hata: {TEST_DOSYASI} bulunamadı!")