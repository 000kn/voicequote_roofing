import os
import sys
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Windows Türkçe karakter desteği
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 1. Çıktı Şemasını Tanımlıyoruz (Pydantic)
class Kalem(BaseModel):
    is_aciklamasi: str = Field(description="Malzeme veya iş tanımı (Örn: Alçıpan, Kiremit)")
    miktar: float = Field(description="Miktar sayısı")
    birim: str = Field(description="Birim (adet, gram, m2, metre, kg vb.)")

class TeklifVerisi(BaseModel):
    musteri_adi: str | None = Field(default=None, description="Varsa müşteri veya muhatap adı")
    kalemler: list[Kalem] = Field(description="Teklifteki iş/malzeme kalemleri")
    genel_not: str | None = Field(default=None, description="Konuşmadaki gereksiz muhabbetler hariç önemli notlar")

def sesi_anla_ve_ayıkla(ses_dosyasi_yolu: str):
    print("1/2: Ses dosyası yükleniyor...")
    audio_file = client.files.upload(file=ses_dosyasi_yolu)
    
    print("2/2: Gemini sesi dinliyor, şiveyi çözüyor ve JSON hazırlıyor...")
    
    prompt = """
    Sen bir şantiye/usta konuşması çözümleyicisisin.
    Bu ses kaydını dinle:
    1. 'Deneme', 'ses geliyor mu' gibi gereksiz giriş konuşmalarını elen.
    2. Geçen malzeme, miktar ve birimleri (gram, adet, m2 vb.) tespit et.
    3. Verilen JSON formatında çıktı üret.
    """
    
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite", # veya kullandığın çalışan model
        contents=[audio_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TeklifVerisi,
        ),
    )
    return response.text

if __name__ == "__main__":
    TEST_DOSYASI = "test.m4a"
    
    if not os.path.exists(TEST_DOSYASI):
        print(f"Hata: {TEST_DOSYASI} bulunamadı!")
    else:
        json_cikti = sesi_anla_ve_ayıkla(TEST_DOSYASI)
        print("\n--- DECODER'DAN ÇIKAN TEMİZ JSON ---")
        print(json_cikti)