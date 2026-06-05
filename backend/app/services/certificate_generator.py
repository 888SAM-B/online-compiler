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

    # 9. Center QR Code drawing removed by user request
    # draw_mock_qr(c, width / 2.0 - 25, 55, size=50)

    # 10. Right Footer Signatures (Two Co-Founders side-by-side)
    # --- Signature 1: GOWTHAM ---
    c.setStrokeColor(colors.HexColor("#9ca3af"))
    c.setLineWidth(0.75)
    c.line(width - 270, 90, width - 150, 90)
    
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width - 210, 75, "GOWTHAM")
    
    c.setFillColor(colors.HexColor("#6b7280"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(width - 210, 60, "Co-Founder & Director")
    
    # Cursive signature drawing matching Gowtham's signature style
    c.setStrokeColor(colors.HexColor("#1e3a8a"))  # Deep ink blue color
    c.setLineWidth(1.5)
    
    sig_x = width - 250
    sig_y = 105
    
    # Stylized G body
    p_g = c.beginPath()
    p_g.moveTo(sig_x + 20, sig_y + 20)
    p_g.curveTo(sig_x + 12, sig_y + 22, sig_x + 3, sig_y + 17, sig_x + 3, sig_y + 8)
    p_g.curveTo(sig_x + 3, sig_y - 1, sig_x + 9, sig_y - 7, sig_x + 16, sig_y - 7)
    p_g.curveTo(sig_x + 22, sig_y - 7, sig_x + 25, sig_y, sig_x + 22, sig_y + 5)
    p_g.curveTo(sig_x + 18, sig_y + 10, sig_x + 11, sig_y + 7, sig_x + 7, sig_y)
    c.drawPath(p_g, fill=0, stroke=1)
    
    # G stem looping left and straight right to underline the signature
    p_stem = c.beginPath()
    p_stem.moveTo(sig_x + 14, sig_y + 10)
    p_stem.lineTo(sig_x + 12, sig_y - 15)
    p_stem.curveTo(sig_x + 11, sig_y - 19, sig_x + 5, sig_y - 18, sig_x + 5, sig_y - 13)
    p_stem.curveTo(sig_x + 5, sig_y - 10, sig_x + 9, sig_y - 10, sig_x + 18, sig_y - 10)
    p_stem.lineTo(sig_x + 85, sig_y - 10)
    c.drawPath(p_stem, fill=0, stroke=1)
    
    # Letter 'o'
    p_o = c.beginPath()
    p_o.moveTo(sig_x + 23, sig_y - 7)
    p_o.curveTo(sig_x + 21, sig_y - 11, sig_x + 25, sig_y - 13, sig_x + 27, sig_y - 9)
    p_o.curveTo(sig_x + 29, sig_y - 5, sig_x + 25, sig_y - 5, sig_x + 23, sig_y - 7)
    c.drawPath(p_o, fill=0, stroke=1)
    
    # Connection to 'w' and 'w'
    p_w = c.beginPath()
    p_w.moveTo(sig_x + 27, sig_y - 7)
    p_w.lineTo(sig_x + 29, sig_y - 8)
    p_w.curveTo(sig_x + 31, sig_y - 12, sig_x + 33, sig_y - 12, sig_x + 34, sig_y - 8)
    p_w.curveTo(sig_x + 36, sig_y - 12, sig_x + 38, sig_y - 12, sig_x + 40, sig_y - 7)
    c.drawPath(p_w, fill=0, stroke=1)
    
    # Letter 't'
    p_t = c.beginPath()
    p_t.moveTo(sig_x + 43, sig_y + 9)
    p_t.lineTo(sig_x + 42, sig_y - 11)
    p_t.curveTo(sig_x + 42, sig_y - 12, sig_x + 44, sig_y - 12, sig_x + 46, sig_y - 9)
    c.drawPath(p_t, fill=0, stroke=1)
    # crossbar
    c.line(sig_x + 38, sig_y, sig_x + 47, sig_y - 1)
    
    # Letter 'h'
    p_h = c.beginPath()
    p_h.moveTo(sig_x + 46, sig_y - 9)
    p_h.curveTo(sig_x + 49, sig_y + 9, sig_x + 53, sig_y + 11, sig_x + 51, sig_y + 5)
    p_h.lineTo(sig_x + 49, sig_y - 11)
    c.drawPath(p_h, fill=0, stroke=1)
    p_h2 = c.beginPath()
    p_h2.moveTo(sig_x + 49, sig_y - 7)
    p_h2.curveTo(sig_x + 51, sig_y - 5, sig_x + 53, sig_y - 5, sig_x + 54, sig_y - 11)
    c.drawPath(p_h2, fill=0, stroke=1)
    
    # Letter 'a'
    p_a = c.beginPath()
    p_a.moveTo(sig_x + 59, sig_y - 8)
    p_a.circle(sig_x + 59, sig_y - 9, 2.5)
    p_a.moveTo(sig_x + 61.5, sig_y - 6.5)
    p_a.lineTo(sig_x + 61, sig_y - 11)
    c.drawPath(p_a, fill=0, stroke=1)
    
    # Letter 'm'
    p_m = c.beginPath()
    p_m.moveTo(sig_x + 61, sig_y - 11)
    p_m.curveTo(sig_x + 63, sig_y - 7, sig_x + 65, sig_y - 7, sig_x + 66, sig_y - 11)
    p_m.curveTo(sig_x + 68, sig_y - 7, sig_x + 70, sig_y - 7, sig_x + 71, sig_y - 11)
    p_m.curveTo(sig_x + 73, sig_y - 7, sig_x + 75, sig_y - 7, sig_x + 76, sig_y - 11)
    c.drawPath(p_m, fill=0, stroke=1)

    # --- Signature 2: SAM ---
    c.setStrokeColor(colors.HexColor("#9ca3af"))
    c.setLineWidth(0.75)
    c.line(width - 130, 90, width - 40, 90)
    
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width - 85, 75, "SAM")
    
    c.setFillColor(colors.HexColor("#6b7280"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(width - 85, 60, "Co-Founder & Director")
    
    # Cursive signature drawing matching Sam's signature style
    c.setStrokeColor(colors.HexColor("#1e3a8a"))  # Deep ink blue color
    c.setLineWidth(1.5)
    
    sam_x = width - 115
    sam_y = 105
    
    # Stylized S
    p_s = c.beginPath()
    p_s.moveTo(sam_x + 5, sam_y - 5)
    p_s.curveTo(sam_x + 10, sam_y + 18, sam_x + 18, sam_y + 18, sam_x + 15, sam_y + 10)
    p_s.curveTo(sam_x + 12, sam_y + 2, sam_x + 3, sam_y + 5, sam_x + 5, sam_y - 2)
    p_s.curveTo(sam_x + 7, sam_y - 7, sam_x + 15, sam_y - 7, sam_x + 18, sam_y - 4)
    c.drawPath(p_s, fill=0, stroke=1)
    
    # Connection to 'a'
    p_sa = c.beginPath()
    p_sa.moveTo(sam_x + 15, sam_y - 5)
    p_sa.curveTo(sam_x + 17, sam_y - 9, sam_x + 20, sam_y - 9, sam_x + 22, sam_y - 7)
    c.drawPath(p_sa, fill=0, stroke=1)
    
    # Letter 'a'
    p_sa_a = c.beginPath()
    p_sa_a.moveTo(sam_x + 24, sam_y - 8)
    p_sa_a.circle(sam_x + 24, sam_y - 9, 2.5)
    p_sa_a.moveTo(sam_x + 26.5, sam_y - 6.5)
    p_sa_a.lineTo(sam_x + 26, sam_y - 11)
    c.drawPath(p_sa_a, fill=0, stroke=1)
    
    # Letter 'm'
    p_sam_m = c.beginPath()
    p_sam_m.moveTo(sam_x + 26, sam_y - 11)
    p_sam_m.curveTo(sam_x + 28, sam_y - 7, sam_x + 30, sam_y - 7, sam_x + 31, sam_y - 11)
    p_sam_m.curveTo(sam_x + 33, sam_y - 7, sam_x + 35, sam_y - 7, sam_x + 36, sam_y - 11)
    p_sam_m.curveTo(sam_x + 38, sam_y - 7, sam_x + 40, sam_y - 7, sam_x + 41, sam_y - 11)
    c.drawPath(p_sam_m, fill=0, stroke=1)
    
    # Sam's underline wave
    p_sam_under = c.beginPath()
    p_sam_under.moveTo(sam_x + 3, sam_y - 10)
    p_sam_under.curveTo(sam_x + 15, sam_y - 12, sam_x + 30, sam_y - 12, sam_x + 44, sam_y - 10)
    c.drawPath(p_sam_under, fill=0, stroke=1)

    # Save
    c.showPage()
    c.save()
    
    return pdf_path
