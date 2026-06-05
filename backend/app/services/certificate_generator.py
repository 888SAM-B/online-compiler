import os
import hashlib
import random
from datetime import datetime
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.pdfgen import canvas

def draw_mock_qr(canv, x, y, size=50):
    # Draws an authentic-looking mock QR code using small random black and white grid cells
    canv.setFillColor(colors.black)
    canv.rect(x, y, size, size, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.rect(x + 2, y + 2, size - 4, size - 4, fill=1, stroke=0)
    
    # Grid details
    canv.setFillColor(colors.black)
    cell_size = size / 10
    
    # Draw three standard QR finder patterns in corners
    finder_size = int(cell_size * 3)
    # Bottom-left finder
    canv.rect(x + cell_size, y + cell_size, finder_size, finder_size, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.rect(x + cell_size * 1.5, y + cell_size * 1.5, finder_size - cell_size, finder_size - cell_size, fill=1, stroke=0)
    canv.setFillColor(colors.black)
    canv.rect(x + cell_size * 2, y + cell_size * 2, cell_size, cell_size, fill=1, stroke=0)
    
    # Top-left finder
    canv.rect(x + cell_size, y + size - finder_size - cell_size, finder_size, finder_size, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.rect(x + cell_size * 1.5, y + size - finder_size - cell_size + cell_size * 0.5, finder_size - cell_size, finder_size - cell_size, fill=1, stroke=0)
    canv.setFillColor(colors.black)
    canv.rect(x + cell_size * 2, y + size - finder_size - cell_size + cell_size, cell_size, cell_size, fill=1, stroke=0)

    # Top-right finder
    canv.rect(x + size - finder_size - cell_size, y + size - finder_size - cell_size, finder_size, finder_size, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.rect(x + size - finder_size - cell_size + cell_size * 0.5, y + size - finder_size - cell_size + cell_size * 0.5, finder_size - cell_size, finder_size - cell_size, fill=1, stroke=0)
    canv.setFillColor(colors.black)
    canv.rect(x + size - finder_size - cell_size + cell_size, y + size - finder_size - cell_size + cell_size, cell_size, cell_size, fill=1, stroke=0)

    # Draw random noise pixels in the remaining space
    random.seed(x + y)
    for col in range(10):
        for row in range(10):
            # Skip corner finder regions
            if (col < 4 and row < 4) or (col < 4 and row > 5) or (col > 5 and row > 5):
                continue
            if random.choice([True, False]):
                canv.rect(x + col * cell_size, y + row * cell_size, cell_size, cell_size, fill=1, stroke=0)

def generate_certificate_pdf(certificate_id: str, username: str, assessment_title: str, badge: str, percentage: float) -> str:
    # Set up output directory
    output_dir = os.path.join("uploads", "certificates")
    os.makedirs(output_dir, exist_ok=True)
    pdf_path = os.path.join(output_dir, f"{certificate_id}.pdf")
    
    # 792 x 612 pixels in landscape letter format
    c = canvas.Canvas(pdf_path, pagesize=landscape(letter))
    width, height = landscape(letter)

    # 1. Background Fill (Off-white / Soft parchment look)
    c.setFillColor(colors.HexColor("#fbfcfd"))
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # 2. Main Double Borders (Deep Purple + Gold)
    # Outer deep purple border
    c.setStrokeColor(colors.HexColor("#6d28d9"))
    c.setLineWidth(5)
    c.rect(20, 20, width - 40, height - 40)
    
    # Inner gold border
    c.setStrokeColor(colors.HexColor("#fbbf24"))
    c.setLineWidth(2)
    c.rect(30, 30, width - 60, height - 60)

    # Decorative Corner Accents (Gold triangles/lines)
    c.setFillColor(colors.HexColor("#fbbf24"))
    c.rect(30, 30, 15, 15, fill=1, stroke=0)
    c.rect(width - 45, 30, 15, 15, fill=1, stroke=0)
    c.rect(30, height - 45, 15, 15, fill=1, stroke=0)
    c.rect(width - 45, height - 45, 15, 15, fill=1, stroke=0)

    # 3. Branding Header
    c.setFillColor(colors.HexColor("#6d28d9"))
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(width / 2.0, height - 85, "DYC CODING CAMPUS")
    
    c.setFillColor(colors.HexColor("#4b5563"))
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2.0, height - 105, "LEARN  •  CODE  •  COMPILE")
    
    # Horizontal divider
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.setLineWidth(1)
    c.line(150, height - 120, width - 150, height - 120)

    # 4. Certificate Title
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica-Oblique", 18)
    c.drawCentredString(width / 2.0, height - 160, "Certificate of Completion")
    
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2.0, height - 195, "This is proudly presented to")

    # 5. User Name (Big and Bold)
    c.setFillColor(colors.HexColor("#7c3aed"))
    c.setFont("Helvetica-Bold", 34)
    c.drawCentredString(width / 2.0, height - 250, username)

    # Divider below name
    c.setStrokeColor(colors.HexColor("#7c3aed"))
    c.setLineWidth(1.5)
    c.line(250, height - 265, width - 250, height - 265)

    # 6. Description Text
    c.setFillColor(colors.HexColor("#4b5563"))
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2.0, height - 300, f"for successfully completing the online certification assessment")
    
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2.0, height - 335, assessment_title)

    # Score details
    c.setFillColor(colors.HexColor("#4b5563"))
    c.setFont("Helvetica", 13)
    c.drawCentredString(width / 2.0, height - 370, f"earning a score of {percentage}% with a distinction level of")

    # 7. Badge Emblem Drawing (Gold, Silver, Bronze color circle)
    badge_colors = {
        "gold": ("#fbbf24", "#d97706"),   # gold / orange-gold
        "silver": ("#cbd5e1", "#475569"), # slate-light / slate-dark
        "bronze": ("#d97706", "#7c2d12")  # bronze / rust-red
    }
    primary_badge, secondary_badge = badge_colors.get(badge.lower(), ("#a78bfa", "#5b21b6"))
    
    # Draw circle emblem
    c.setStrokeColor(colors.HexColor(secondary_badge))
    c.setFillColor(colors.HexColor(primary_badge))
    c.setLineWidth(2)
    c.circle(width / 2.0, height - 425, 25, fill=1, stroke=1)
    
    # Draw inner circle
    c.setFillColor(colors.white)
    c.circle(width / 2.0, height - 425, 21, fill=1, stroke=0)
    
    # Write badge text
    c.setFillColor(colors.HexColor(secondary_badge))
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(width / 2.0, height - 428, badge.upper())

    # 8. Left Footer Details (ID, Date, Hash)
    c.setFillColor(colors.HexColor("#6b7280"))
    c.setFont("Helvetica", 8)
    c.drawString(60, 95, f"CERTIFICATE ID: {certificate_id}")
    c.drawString(60, 80, f"ISSUE DATE: {datetime.utcnow().strftime('%B %d, %Y')}")
    
    # Verification Hash
    hash_str = hashlib.sha256(f"CERT:{certificate_id}:{username}:{percentage}".encode("utf-8")).hexdigest()[:24].upper()
    c.drawString(60, 65, f"VERIFICATION HASH: {hash_str}")
    c.drawString(60, 50, "VERIFY ONLINE AT: https://dyccodingcampus.com/verify-certificate")

    # 9. Center QR Code drawing
    draw_mock_qr(c, width / 2.0 - 25, 55, size=50)

    # 10. Right Footer Signatures
    c.setStrokeColor(colors.HexColor("#9ca3af"))
    c.setLineWidth(0.75)
    c.line(width - 240, 90, width - 60, 90)
    
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width - 150, 75, "DYC Certification Board")
    
    c.setFillColor(colors.HexColor("#9ca3af"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(width - 150, 60, "Authorized Signature")
    
    # Dynamic signature graphic
    c.setStrokeColor(colors.HexColor(secondary_badge))
    c.setLineWidth(1.5)
    c.line(width - 200, 105, width - 180, 110)
    c.line(width - 180, 110, width - 150, 98)
    c.line(width - 150, 98, width - 100, 108)

    # Save
    c.showPage()
    c.save()
    
    return pdf_path
