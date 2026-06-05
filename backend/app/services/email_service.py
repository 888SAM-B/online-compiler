import logging
from datetime import datetime
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from pydantic import EmailStr
from app.config import settings

logger = logging.getLogger(__name__)

# Connection configuration for Brevo SMTP
conf = ConnectionConfig(
    MAIL_USERNAME=settings.BREVO_SMTP_USER,
    MAIL_PASSWORD=settings.BREVO_SMTP_PASSWORD,
    MAIL_FROM=settings.FROM_EMAIL,
    MAIL_PORT=settings.BREVO_SMTP_PORT,
    MAIL_SERVER=settings.BREVO_SMTP_HOST,
    MAIL_FROM_NAME="DYC CODING CAMPUS",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    SUPPRESS_SEND=1 if settings.SUPPRESS_SEND else 0
)

async def send_otp_email(email: EmailStr, otp: str) -> bool:
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Password Reset OTP</title>
        <style>
            body {{
                font-family: 'Inter', sans-serif;
                background-color: #0b0f19;
                color: #f3f4f6;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #111827;
                border: 1px solid #1f2937;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            }}
            .header {{
                background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                color: #ffffff;
                letter-spacing: 0.5px;
            }}
            .content {{
                padding: 40px 30px;
                line-height: 1.6;
            }}
            .content p {{
                font-size: 15px;
                color: #9ca3af;
                margin-top: 0;
                margin-bottom: 20px;
            }}
            .otp-box {{
                text-align: center;
                margin: 35px 0;
            }}
            .otp-code {{
                display: inline-block;
                font-size: 32px;
                font-family: 'Fira Code', monospace;
                font-weight: 700;
                color: #10b981;
                background-color: #030712;
                padding: 15px 30px;
                border: 1px dashed #10b981;
                border-radius: 12px;
                letter-spacing: 6px;
            }}
            .warning {{
                background-color: rgba(245, 158, 11, 0.05);
                border-left: 4px solid #f59e0b;
                padding: 15px;
                border-radius: 0 8px 8px 0;
                font-size: 13px;
                color: #d97706;
                margin-bottom: 25px;
            }}
            .footer {{
                background-color: #030712;
                padding: 24px 30px;
                text-align: center;
                border-top: 1px solid #1f2937;
            }}
            .footer p {{
                font-size: 12px;
                color: #4b5563;
                margin: 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>DYC CODING CAMPUS</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>We received a request to reset the password for your DYC CODING CAMPUS account. Use the verification code (OTP) below to proceed. This code is valid for <strong>10 minutes</strong> and is for single-use only.</p>
                
                <div class="otp-box">
                    <span class="otp-code">{otp}</span>
                </div>
                
                <div class="warning">
                    <strong>Security Warning:</strong> Never share this OTP with anyone, including members of our support team. If you did not initiate this request, you can safely ignore this email.
                </div>
                
                <p>Happy Coding,<br>The DYC CODING CAMPUS Team</p>
            </div>
            <div class="footer">
                <p>&copy; {datetime.utcnow().year} DYC CODING CAMPUS. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Password Reset OTP — DYC CODING CAMPUS",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    
    try:
        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {e}")
        return False

async def send_reset_success_email(email: EmailStr) -> bool:
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Password Reset Success</title>
        <style>
            body {{
                font-family: 'Inter', sans-serif;
                background-color: #0b0f19;
                color: #f3f4f6;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #111827;
                border: 1px solid #1f2937;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            }}
            .header {{
                background: linear-gradient(135deg, #10b981, #059669);
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                color: #ffffff;
                letter-spacing: 0.5px;
            }}
            .content {{
                padding: 40px 30px;
                line-height: 1.6;
            }}
            .content p {{
                font-size: 15px;
                color: #9ca3af;
                margin-top: 0;
                margin-bottom: 20px;
            }}
            .status-box {{
                text-align: center;
                background-color: rgba(16, 185, 129, 0.05);
                border: 1px solid rgba(16, 185, 129, 0.2);
                padding: 20px;
                border-radius: 12px;
                margin: 30px 0;
                color: #10b981;
                font-weight: 600;
            }}
            .warning {{
                background-color: rgba(239, 68, 68, 0.05);
                border-left: 4px solid #ef4444;
                padding: 15px;
                border-radius: 0 8px 8px 0;
                font-size: 13px;
                color: #ef4444;
                margin-bottom: 25px;
            }}
            .footer {{
                background-color: #030712;
                padding: 24px 30px;
                text-align: center;
                border-top: 1px solid #1f2937;
            }}
            .footer p {{
                font-size: 12px;
                color: #4b5563;
                margin: 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>DYC CODING CAMPUS</h1>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>This is a confirmation email that the password for your DYC CODING CAMPUS account has been successfully reset.</p>
                
                <div class="status-box">
                    Password Reset Complete
                </div>
                
                <div class="warning">
                    <strong>Warning:</strong> If you did NOT perform this password reset, please contact support or an administrator immediately to secure your account.
                </div>
                
                <p>Happy Coding,<br>The DYC CODING CAMPUS Team</p>
            </div>
            <div class="footer">
                <p>&copy; {datetime.utcnow().year} DYC CODING CAMPUS. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Password Reset Successful — DYC CODING CAMPUS",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    
    try:
        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        logger.error(f"Failed to send reset success email to {email}: {e}")
        return False


async def send_welcome_email(email: EmailStr, name: str) -> bool:
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Welcome to DYC CODING CAMPUS</title>
        <style>
            body {{
                font-family: 'Inter', sans-serif;
                background-color: #0b0f19;
                color: #f3f4f6;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #111827;
                border: 1px solid #1f2937;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            }}
            .header {{
                background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                padding: 40px 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 28px;
                font-weight: 800;
                color: #ffffff;
                letter-spacing: 0.5px;
            }}
            .header p {{
                margin: 10px 0 0 0;
                font-size: 14px;
                color: #c084fc;
                font-weight: 500;
            }}
            .content {{
                padding: 40px 30px;
                line-height: 1.6;
            }}
            .content h2 {{
                font-size: 20px;
                color: #ffffff;
                margin-top: 0;
                margin-bottom: 16px;
            }}
            .content p {{
                font-size: 15px;
                color: #9ca3af;
                margin-top: 0;
                margin-bottom: 24px;
            }}
            .features-list {{
                margin: 25px 0;
                padding: 0;
                list-style: none;
            }}
            .feature-item {{
                display: flex;
                align-items: flex-start;
                margin-bottom: 15px;
            }}
            .feature-icon {{
                color: #10b981;
                margin-right: 12px;
                font-weight: bold;
                font-size: 18px;
            }}
            .feature-text {{
                font-size: 14px;
                color: #d1d5db;
            }}
            .feature-text strong {{
                color: #ffffff;
            }}
            .cta-box {{
                text-align: center;
                margin: 35px 0 15px 0;
            }}
            .cta-button {{
                display: inline-block;
                background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                color: #ffffff !important;
                text-decoration: none;
                padding: 14px 30px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 15px;
                box-shadow: 0 4px 6px -1px rgba(139, 92, 246, 0.2);
                transition: transform 0.2s;
            }}
            .footer {{
                background-color: #030712;
                padding: 24px 30px;
                text-align: center;
                border-top: 1px solid #1f2937;
            }}
            .footer p {{
                font-size: 12px;
                color: #4b5563;
                margin: 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>DYC CODING CAMPUS</h1>
                <p>Learn • Code • Compile</p>
            </div>
            <div class="content">
                <h2>Welcome to the Campus, {name}!</h2>
                <p>We are thrilled to welcome you to <strong>DYC CODING CAMPUS</strong>. Your account has been successfully set up, and you are ready to write, run, and compile code directly from your browser.</p>
                
                <p>Here is what you can do with your new workspace:</p>
                
                <ul class="features-list">
                    <li class="feature-item">
                        <span class="feature-icon">✓</span>
                        <div class="feature-text">
                            <strong>Multi-Language Support:</strong> Code and execute scripts in Python, Node.js, C, C++, and Java.
                        </div>
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✓</span>
                        <div class="feature-text">
                            <strong>Secure Sandboxed Environment:</strong> Run code in isolated, resource-controlled Docker containers.
                        </div>
                    </li>
                    <li class="feature-item">
                        <span class="feature-icon">✓</span>
                        <div class="feature-text">
                            <strong>Personal Workspace Management:</strong> Save, download, and catalog your projects and code history.
                        </div>
                    </li>
                </ul>

                
                <p style="margin-top: 30px;">If you have any questions or need support, feel free to reply directly to this email.</p>
                <p>Happy Coding,<br>The DYC CODING CAMPUS Team</p>
            </div>
            <div class="footer">
                <p>&copy; {datetime.utcnow().year} DYC CODING CAMPUS. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Welcome to DYC CODING CAMPUS!",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )
    
    try:
        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        logger.error(f"Failed to send welcome email to {email}: {e}")
        return False


async def send_certificate_email(email: EmailStr, name: str, title: str, badge: str, score: float, pdf_path: str, verification_url: str) -> bool:
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Your DYC Coding Campus Certificate</title>
        <style>
            body {{
                font-family: 'Inter', sans-serif;
                background-color: #0b0f19;
                color: #f3f4f6;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background: #111827;
                border: 1px solid #1f2937;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            }}
            .header {{
                background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                padding: 30px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                color: #ffffff;
            }}
            .content {{
                padding: 40px 30px;
                line-height: 1.6;
            }}
            .badge-box {{
                text-align: center;
                margin: 25px 0;
                padding: 15px;
                background-color: #030712;
                border: 1px solid #1f2937;
                border-radius: 12px;
            }}
            .badge-title {{
                font-size: 20px;
                font-weight: 700;
                color: #10b981;
                text-transform: uppercase;
                letter-spacing: 1px;
            }}
            .cta-box {{
                text-align: center;
                margin: 35px 0;
            }}
            .cta-button {{
                display: inline-block;
                background: linear-gradient(135deg, #8b5cf6, #6d28d9);
                color: #ffffff !important;
                text-decoration: none;
                padding: 14px 30px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 15px;
            }}
            .footer {{
                background-color: #030712;
                padding: 24px 30px;
                text-align: center;
                border-top: 1px solid #1f2937;
            }}
            .footer p {{
                font-size: 12px;
                color: #4b5563;
                margin: 0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>CONGRATULATIONS, {name}!</h1>
                <p style="color: #cbd5e1; margin: 5px 0 0 0;">Assessment Completed Successfully</p>
            </div>
            <div class="content">
                <h2>You are Certified!</h2>
                <p>Outstanding job! You have successfully passed the certification assessment:</p>
                <p style="font-size: 18px; font-weight: 700; color: #ffffff; margin: 10px 0;">{title}</p>
                
                <div class="badge-box">
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase;">Earned Badge Distinction</p>
                    <span class="badge-title">{badge} ({score}%)</span>
                </div>

                <p>Your official PDF certificate has been generated and is attached to this email. You can also share and verify this certificate online at any time.</p>
                
                <div class="cta-box">
                    <a href="{verification_url}" class="cta-button">Verify Your Certificate</a>
                </div>

                <p>Keep coding and unlocking new milestones!</p>
                <p>Best Regards,<br>The DYC CODING CAMPUS Team</p>
            </div>
            <div class="footer">
                <p>&copy; {datetime.utcnow().year} DYC CODING CAMPUS. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="🎉 Your DYC Coding Campus Certificate",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html,
        attachments=[pdf_path]
    )

    try:
        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        logger.error(f"Failed to send certificate email to {email}: {e}")
        return False

