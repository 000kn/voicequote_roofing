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
    odeme_plani: Optional[str] = Field(
        None,
        description="Ödeme planı (Örn: '%40 Peşin (154.000 TL) - %30 Ara Hakediş (115.500 TL) - %30 İş Tesliminde (115.500 TL)')"
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


def slugify_filename(text):
    tr_map = {
        'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'I',
        'Ç': 'C', 'Ğ': 'G', 'Ö': 'O', 'Ş': 'S', 'Ü': 'U'
    }
    for char, repl in tr_map.items():
        text = text.replace(char, repl)
    import re
    text = re.sub(r'\s+', '_', text)
    text = re.sub(r'[^a-zA-Z0-9_.]', '', text)
    return text

# ==========================================
# 2. AKSOY ÇATI PDF TEMA SINIFI (Minimalist)
# ==========================================
class AksoyTeklifPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="mm", format="A4")
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
        self.set_text_color(17, 24, 39) # #111827

        if os.path.exists(logo_yolu):
            box_x, box_y = 25.0, 20.0
            max_w, max_h = 40.0, 25.0
            with Image.open(logo_yolu) as img:
                img_rgba = img.convert("RGBA")
                alpha = img_rgba.split()[-1]
                bbox = alpha.getbbox()
                cropped_img = img.crop(bbox) if bbox else img
                orig_w, orig_h = cropped_img.size
                aspect = orig_w / orig_h
                box_aspect = max_w / max_h
                if aspect > box_aspect:
                    render_w, render_h = max_w, max_w / aspect
                else:
                    render_h, render_w = max_h, max_h * aspect
                self.image(cropped_img, x=box_x, y=box_y, w=render_w, h=render_h)
                # Firma bilgileri logonun sağında
                self.set_xy(box_x + render_w + 5, box_y)
                self.set_font("CalibriTR", "B", 12)
                self.cell(0, 5, "AKSOY ÇATI SİSTEMLERİ", new_x="LMARGIN", new_y="NEXT")
                self.set_x(box_x + render_w + 5)
                self.set_font("CalibriTR", size=9)
                self.multi_cell(90, 4, "Su ve Isı İzolasyon Uygulamaları\nTel: 0532 411 48 38", align="L")
                self.logo_bottom_y = max(box_y + render_h, self.get_y()) + 5
        
        # FİYAT TEKLİFİ Başlığı sağ üstte
        self.set_xy(135, 20)
        self.set_font("CalibriTR", "B", 14)
        self.cell(50, 6, "FİYAT TEKLİFİ", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_x(135)
        self.set_font("CalibriTR", size=10)
        self.cell(50, 5, f"Tarih: {datetime.now().strftime('%d.%m.%Y')}", align="R")
        
        # Ayırıcı çizgi
        self.set_draw_color(30, 41, 59) # #1E293B
        self.set_line_width(1.5)
        self.line(25, self.logo_bottom_y, 185, self.logo_bottom_y)
        self.ln(10)


def aksoy_pdf_olustur(veri: KarmaşıkTeklif, cikti_dosyasi="aksoy_teklif.pdf"):
    pdf = AksoyTeklifPDF()
    pdf.add_page()
    
    # Minimalist İçerik (Antrasit: #111827 / R:17, G:24, B:39)
    pdf.set_text_color(17, 24, 39)

    # 1. Başlık ve İş Listesi
    pdf.ln(5)
    pdf.set_font("CalibriTR", "B", 12)
    pdf.cell(0, 8, veri.baslik, new_x="LMARGIN", new_y="NEXT")
    
    # 2. İş Kalemleri Tablosu
    pdf.set_font("CalibriTR", "B", 10)
    pdf.set_fill_color(243, 244, 246) # #F3F4F6
    pdf.cell(10, 8, "No", border=0, fill=True, align="C")
    pdf.cell(150, 8, "İş ve Malzeme Detayı", border=0, fill=True, align="L")
    pdf.ln(8)
    
    pdf.set_font("CalibriTR", size=10)
    for i, madde in enumerate(veri.yapilacak_isler, 1):
        pdf.set_draw_color(209, 213, 219) # #D1D5DB
        pdf.set_line_width(0.2)
        pdf.line(25, pdf.get_y(), 185, pdf.get_y())
        pdf.ln(1)
        pdf.cell(10, 7, str(i), align="C")
        pdf.multi_cell(150, 7, madde.strip())
        pdf.ln(1)
    
    # Son çizgi
    pdf.line(25, pdf.get_y(), 185, pdf.get_y())
    pdf.ln(8)

    # 3. Toplam Tutar (Sağa hizalı, üstü-altı çizgili)
    pdf.set_x(95)
    pdf.set_font("CalibriTR", "B", 12)
    tutar_str = f"{veri.ana_tutar_rakam:,.0f}".replace(",", ".")
    
    pdf.set_draw_color(17, 24, 39)
    pdf.set_line_width(0.5)
    pdf.line(95, pdf.get_y(), 185, pdf.get_y())
    pdf.ln(2)
    
    pdf.set_x(95)
    pdf.cell(90, 7, f"TOPLAM: {tutar_str} TL", align="R", new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_x(95)
    pdf.line(95, pdf.get_y(), 185, pdf.get_y())
    pdf.ln(5)

    # 3.1 Ödeme Planı (Yeni)
    if veri.odeme_plani:
        pdf.set_font("CalibriTR", "B", 10)
        pdf.cell(0, 6, "Ödeme Planı:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("CalibriTR", size=10)
        pdf.multi_cell(0, 5, veri.odeme_plani)
        pdf.ln(5)

    # 4. Garanti & Diğer Notlar (İnce çerçeve)
    if veri.garanti_var_mi:
        pdf.set_draw_color(209, 213, 219)
        pdf.set_line_width(0.2)
        pdf.rect(25, pdf.get_y(), 160, 15)
        pdf.set_xy(27, pdf.get_y() + 2)
        pdf.set_font("CalibriTR", size=9)
        pdf.multi_cell(156, 5, f"Garanti: {veri.garanti_suresi} uygulama garantilidir.")
        pdf.ln(10)

    # 5. İmza Alanı
    pdf.ln(10)
    pdf.set_x(120)
    pdf.set_font("CalibriTR", "B", 10)
    pdf.cell(65, 5, "Aksoy Çatı Sistemleri", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(120)
    pdf.set_font("CalibriTR", size=9)
    pdf.cell(65, 5, "Yetkili İmza / Kaşe", align="C")

    pdf.output(cikti_dosyasi)
    print(f"\n[BAŞARILI] Minimalist PDF oluşturuldu: {cikti_dosyasi}")


# ==========================================
# 3. ANA SÜREÇ (Gemini 3.5-Flash-Lite)
# ==========================================
def sesi_teklife_donustur(ses_dosyasi_yolu: str):
    print("1/2: Ses yükleniyor ve Gemini verileri ayıklıyor...")
    audio_file = client.files.upload(file=ses_dosyasi_yolu)

    prompt = """
    Sen Aksoy ÇATI Sistemleri için teklif hazırlayan bir yapay zeka asistanısın.
    Bu ses kaydını dinle ve 'yapilacak_isler' listesini oluştur.

    TÜRKÇE İSİMLENDİRME VE NUMARALANDIRMA KURALLARI:
    - Su yalıtımı (membran) katmanlarını belirtirken sıra sayılarını MUTLAKA Türkçe kelimelerle yaz. 
      Örn: "birinci kat", "ikinci kat", "üçüncü kat" (Asla "1. kat", "2. kat" kullanma).
    - MİKTAR VE BİRİM KORUMA: Ses kaydında geçen TÜM sayıları, ölçüleri ve miktarları (m², metre, adet, cm, mm, saat, kat vb.) iş maddelerinin içinde KESİNLİKLE koru. Asla sayıları veya birimleri düşürme (Örn: "5 cm kalınlığında" ifadesini "kalınlığında" diye kısaltma, "5 cm" mutlaka yer almalı).

    3. ÖDEME PLANI: 
      - Kullanıcının belirttiği ödeme planını (örn: "%40 Peşin (154.000 TL) - %30 Ara Hakediş (115.500 TL) - %30 İş Tesliminde (115.500 TL)") tam olarak çıkar ve 'ana_tutar_rakam'a göre TL miktarlarını tam hesapla.
      - Kullanıcı ödeme planı hakkında HİÇBİR şey belirtmediyse KESİNLİKLE varsayılan olarak "%40 Peşin - %60 İş Tesliminde" ifadesini kullan.
      - ÇIKTI MANTIĞI: Eğer ses kaydında özel bir plan belirtilmişse, varsayılan planı ASLA kullanma; doğrudan kullanıcının söylediğini TL hesaplamalarıyla birlikte döndür.
    4. FONETİK DÜZELTME: Ses kaydından gelen metinlerdeki bariz fonetik hataları (örn: 'çeşit malı' -> 'şaşırtmalı', '350'linden' -> 'iç yüzeylerinin', tekrarlanan kelimeler) düzelt. Ancak ses kaydındaki tüm sayıları, ölçüleri, metrajları ve teknik yapı malzemesi isimlerini KESİNLİKLE olduğu gibi koru, silme veya değiştirme.
    5. BAŞLIK KONTROLÜ:
    - Varsayılan başlık 'Binanızın çatısında yapılacak işler:' metnidir.
    - Konuşmada başlık için özel cümle söylenirse (Örn: 'Binanızın çatısında keşif sonucu akan yerler tespit edilmiştir') 'baslik' alanına o cümleyi aktar.
    6. GARANTİ KONTROLÜ:
    - Konuşmada garanti verilmediği, 'garantisiz', 'garantisi yok' ifade edildiğinde 'garanti_var_mi' değerini False yap.
    7. TEKLİF VEREN / İMZA LİSTESİ MANİPÜLASYONU:
    1. 'teklif_veren_baslik_goster': Ses kaydında 'Teklif veren başlığını kaldır', 'Başlık olmasın', 'Sadece ismi yaz' gibi bir talep varsa bu değeri False yap.
    2. 'yetkililer':
       - Standart liste:
         ["YALÇIN AKSOY – 0532 411 48 38", "YAVUZ AKSOY – 0532 291 38 18", "Mim. OKAN AKSOY – oda no: 67763"]
       - Eğer ses kaydında 'Okan olmasın' denirse Okan satırını çıkar.
       - Eğer ses kaydında özel bir isim ve numara söylendiyse (Örn: 'Teklif veren kısmını kaldır, sadece Oğuz Çelik yaz, numarası 05322913818'), 'yetkililer' listesini tamamen temizle ve sadece ["Oğuz Çelik – 05322913818"] olarak ayarla.
    8. FORMATLAMA KURALLARI:
    1. 'yapilacak_isler' maddelerini Türkçe imla kurallarına uygun yaz (Baş harf büyük, sonu noktalı). Kelime hatalarını ve duyum kaymalarını düzelt.
    2. Yapılacak iş maddelerini yazarken ses kaydındaki metraj, alan ve adet bilgilerini (örneğin 185 m², 45 metre, 4 adet) maddelerin içine mutlaka yaz ve çatı izolasyon terimlerini doğru imlayla (bitümlü, şaloma, arduvazlı vb.) düzelt.
    3. 'ana_tutar_yaziyla' ve 'alternatif_tutar_yaziyla' alanlarını kurumsal resmi Türkçe biçimde yaz. Rakam, 'lira' veya 'TL' ekleme! Sadece baş harfleri büyük kelimeler olsun. (Örn: 'Altmış Bin').
    4. 'alternatif_aciklama' içine fiyatı yazma, sadece yapılan teknik iş/malzeme farkını yaz.
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
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from supabase import create_client

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

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[UYARI] Supabase client başlatılamadı: {e}")


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
    odeme_plani: Optional[str] = Field(
        None,
        description="Ödeme planı (Örn: '%40 Peşin (154.000 TL) - %30 Ara Hakediş (115.500 TL) - %30 İş Tesliminde (115.500 TL)')"
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
2. 'yapilacak_isler' maddelerini Türkçe imla kurallarına uygun yaz (Baş harf büyük, sonu noktalı).
   - ÖNEMLİ: Su yalıtımı (membran) katmanlarını belirtirken sıra sayılarını MUTLAKA Türkçe kelimelerle yaz (Örn: "birinci kat", "ikinci kat"). Rakamla "1. kat" yazma.
   - MİKTAR VE BİRİM KORUMA: Ses kaydında geçen TÜM sayıları, ölçüleri ve miktarları (m², metre, adet, cm, mm, saat, kat vb.) iş maddelerinin içinde KESİNLİKLE koru. Asla sayıları veya birimleri düşürme (Örn: "5 cm kalınlığında" ifadesini "kalınlığında" diye kısaltma, "5 cm" mutlaka yer almalı).
   - Sektör terimlerini (membran, kiremit aktarma, gizli dere, izocam, şap, PPRC boru vb.) doğru yaz.
3. ÖDEME PLANI: 
   - Kullanıcının belirttiği ödeme planını (örn: "%40 Peşin (154.000 TL) - %30 Ara Hakediş (115.500 TL) - %30 İş Tesliminde (115.500 TL)") tam olarak çıkar ve 'ana_tutar_rakam'a göre TL miktarlarını tam hesapla.
   - Kullanıcı ödeme planı hakkında HİÇBİR şey belirtmediyse KESİNLİKLE varsayılan olarak "%40 Peşin - %60 İş Tesliminde" ifadesini kullan.
   - ÇIKTI MANTIĞI: Eğer ses kaydında özel bir plan belirtilmişse, varsayılan planı ASLA kullanma; doğrudan kullanıcının söylediğini TL hesaplamalarıyla birlikte döndür.
4. FONETİK DÜZELTME: Ses kaydından gelen metinlerdeki bariz fonetik hataları (örn: 'çeşit malı' -> 'şaşırtmalı', '350'linden' -> 'iç yüzeylerinin', tekrarlanan kelimeler) düzelt. Ancak ses kaydındaki tüm sayıları, ölçüleri, metrajları ve teknik yapı malzemesi isimlerini KESİNLİKLE olduğu gibi koru, silme veya değiştirme.
5. BAŞLIK: Varsayılan 'Binanızda yapılacak işler:'. Konuşmada özel bir giriş cümlesi söylendiyse 'baslik' alanına onu yaz.
6. GARANTİ: Konuşmada 'garanti yok', 'garantisiz' denirse veya garantiden hiç bahsedilmezse 'garanti_var_mi' = False ve 'garanti_suresi' = None yap.
7. YAZIYLA TUTAR: 'ana_tutar_yaziyla' ve 'alternatif_tutar_yaziyla' alanlarına sadece baş harfleri büyük kelimeler yaz; rakam, 'lira' veya 'TL' ekleme (Örn: 'Altmış Beş Bin').
8. TELEFON VE İMZA AYRIMI: Konuşmada teklifi veren ustanın/firmanın kendi numarası veya imza değişikliği geçiyorsa bunu kesinlikle 'musteri_telefon' alanına YAZMA; özel imza talimatı varsa 'ozel_yetkililer' listesine ekle, yoksa None bırak.
9. DOĞRULAMA: Kalem fiyatları tek tek söylendiyse toplamlarını genel tutarla kıyasla ve 'amount_verified' alanını belirle. Söylenmeyen hiçbir bilgiyi uydurma.
"""


# ==========================================
# 2. SES -> JSON ENDPOINT
# ==========================================
@app.post("/api/parse-quote", response_model=DecodedQuoteResponse)
async def parse_quote(audio: UploadFile = File(...), authorization: Optional[str] = Header(None)):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Boş ses dosyası.")

    user_id = None
    is_pro = False
    usta_hafizasi_metni = ""

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        if supabase_client:
            try:
                user_res = supabase_client.auth.get_user(token)
                if user_res and user_res.user:
                    user_id = user_res.user.id
            except Exception as e:
                print(f"[UYARI] Token doğrulanamadı: {e}")

    if user_id and supabase_client:
        try:
            # Profil kontrolü (is_pro)
            profile_res = supabase_client.table("profiles").select("is_pro").eq("id", user_id).execute()
            if profile_res.data and len(profile_res.data) > 0:
                is_pro = profile_res.data[0].get("is_pro", False)

            # Ücretsiz kullanıcı limit kontrolü (Aylık max 3 teklif)
            if not is_pro:
                now = datetime.now()
                start_of_month = datetime(now.year, now.month, 1).isoformat()
                quotes_count_res = supabase_client.table("quotes").select("id", count="exact").eq("user_id", user_id).gte("created_at", start_of_month).execute()
                count = quotes_count_res.count if quotes_count_res.count is not None else len(quotes_count_res.data or [])
                if count >= 3:
                    raise HTTPException(
                        status_code=403,
                        detail="Ücretsiz aylık teklif limitiniz (3 teklif) doldu. Sınırsız teklif ve Usta Hafızası için Pro pakete geçin!"
                    )
            else:
                # Pro kullanıcılar için Usta Hafızası (Son 5-7 teklifin kompakt özeti)
                hafiza_res = supabase_client.table("quotes").select("quote_data").eq("user_id", user_id).order("created_at", desc=True).limit(7).execute()
                if hafiza_res.data:
                    hafiza_list = []
                    for q in hafiza_res.data:
                        qd = q.get("quote_data", {})
                        baslik = qd.get("baslik", "")
                        isler = [i.get("aciklama") if isinstance(i, dict) else str(i) for i in qd.get("yapilacak_isler", [])]
                        tutar = qd.get("ana_tutar_rakam", 0)
                        garanti = qd.get("garanti_suresi", "")
                        hafiza_list.append(f"- Başlık: {baslik} | İşler: {isler} | Tutar: {tutar} TL | Garanti: {garanti}")
                    if hafiza_list:
                        usta_hafizasi_metni = "\nUSTA HAFIZASI (Geçmiş Onaylı Teklifler):\n" + "\n".join(hafiza_list) + "\n"
        except HTTPException as he:
            raise he
        except Exception as e:
            print(f"[UYARI] Supabase veri sorgulama hatası: {e}")

    # Sistem promptunu Usta Hafızası ile zenginleştirme
    current_system_prompt = SYSTEM_PROMPT
    if is_pro and usta_hafizasi_metni:
        current_system_prompt += f"\n{usta_hafizasi_metni}\nUstanın geçmiş tekliflerindeki fiyatlandırma, ifade üslubu ve garanti alışkanlıklarını bu yeni teklife de yansıt."

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
                    system_instruction=current_system_prompt,
                    response_mime_type="application/json",
                    response_schema=GeminiQuoteOutput,
                    temperature=0.1,
                ),
            )
            parsed = GeminiQuoteOutput.model_validate_json(response.text)
            bugun = datetime.now().strftime("%d.%m.%Y")
            print("TRANSCRIPT:", response.text)
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