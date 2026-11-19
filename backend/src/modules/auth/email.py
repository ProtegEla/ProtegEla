import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlencode, urlsplit

from src.core.config import settings


def _send_password_reset_email(recipient: str, token: str) -> None:
    if not all(
        (settings.SMTP_HOST, settings.SMTP_FROM_EMAIL, settings.PASSWORD_RESET_URL)
    ):
        raise RuntimeError("Configuração do e-mail de recuperação incompleta.")

    url = urlsplit(settings.PASSWORD_RESET_URL)
    if url.scheme not in {"http", "https"} or not url.hostname:
        raise ValueError("URL de redefinição de senha inválida.")

    token_query = urlencode({"token": token})
    query = f"{url.query}&{token_query}" if url.query else token_query
    reset_url = url._replace(query=query).geturl()

    message = EmailMessage()
    message["Subject"] = "Redefinição de senha | ProtegEla"
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = recipient
    message.set_content(
        "Você solicitou a redefinição da sua senha no ProtegEla.\n\n"
        f"Abra este link para criar uma nova senha:\n{reset_url}\n\n"
        "O link expira em 15 minutos e pode ser usado uma vez.\n"
        "Se você não solicitou a redefinição, ignore este e-mail.\n"
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        if settings.SMTP_STARTTLS:
            smtp.starttls(context=ssl.create_default_context())
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


async def send_password_reset_email(recipient: str, token: str) -> None:
    await asyncio.to_thread(_send_password_reset_email, recipient, token)
