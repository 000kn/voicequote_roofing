import os
import sys
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

class KarmaşıkTeklif(BaseModel):
    tarih: str = Field(default="16.05.2026")
    yapilacak_isler: List[str] = Field(description="Sırasıyla yapılacak iş maddeleri")
    ana_tutar_rakam: float = Field(description="Ana tutar rakam")
    ana_tutar_yaziyla: str = Field(description="Ana tutar yazıyla")
    garanti_suresi: str = Field(default="10 yıl")
    
    alternatif_not_var_mi: bool = Field(default=False)
    alternatif_aciklama: Optional[str] = Field(None)
    alternatif_tutar_rakam: Optional[float] = Field(None)
    alternatif_tutar_yaziyla: Optional[str] = Field(None)

def ses_sablonunu_coz(ses_dosyasi_yolu: str):
    print("Ses Gemini'ye yükleniyor...")
    audio_file = client.files.upload(file=ses_dosyasi_yolu)
    
    prompt = """
    Bu ses kaydını dinle. Ustanın sırayla söylediği yapılacak iş maddelerini listeye çevir.
    Rakamları ve alternatif şartları (NOT kısmını) şemaya tam uyacak şekilde ayıkla.
    """
    
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=[audio_file, prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=KarmaşıkTeklif,
        ),
    )
    return response.text

if __name__ == "__main__":
    TEST_DOSYASI = "test.m4a"
    if os.path.exists(TEST_DOSYASI):
        res = ses_sablonunu_coz(TEST_DOSYASI)
        print("\n--- ŞABLONA UYARLANMIŞ JSON ÇIKTISI ---")
        print(res)