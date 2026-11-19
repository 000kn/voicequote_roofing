import sys
from fpdf import FPDF

# Windows konsol desteği
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

class TeklifPDF(FPDF):
    def header(self):
        # Başlık Bölümü
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 10, "MUSTERI TEKLIF FORMU", border=False, new_x="LMARGIN", new_y="NEXT", align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, "Bu teklif otomatik otomasyon sistemi ile uretilmistir.", align="C")

def pdf_olustur(json_veri: dict, cikti_dosyasi="teklif.pdf"):
    pdf = TeklifPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=12)

    # Müşteri / Genel Bilgiler
    musteri = json_veri.get("musteri_adi") or "Belirtilmedi"
    pdf.cell(0, 10, f"Musteri: {musteri}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    # Tablo Başlığı
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(100, 10, "Is / Malzeme Aciklamasi", border=1)
    pdf.cell(40, 10, "Miktar", border=1)
    pdf.cell(40, 10, "Birim", border=1, new_x="LMARGIN", new_y="NEXT")

    # Tablo Satırları
    pdf.set_font("Helvetica", size=10)
    for kalem in json_veri.get("kalemler", []):
        pdf.cell(100, 10, str(kalem.get("is_aciklamasi", "")), border=1)
        pdf.cell(40, 10, str(kalem.get("miktar", 0)), border=1)
        pdf.cell(40, 10, str(kalem.get("birim", "")), border=1, new_x="LMARGIN", new_y="NEXT")

    pdf.output(cikti_dosyasi)
    print(f"PDF basariyla olusturuldu: {cikti_dosyasi}")

if __name__ == "__main__":
    # Test verisi (Gemini'den gelen verinin aynısı)
    ornek_json = {
        "musteri_adi": "Ahmet Bey",
        "kalemler": [
            {"is_aciklamasi": "Alcipan", "miktar": 350.0, "birim": "gram"},
            {"is_aciklamasi": "Kiremit", "miktar": 150.0, "birim": "adet"}
        ]
    }
    pdf_olustur(ornek_json)