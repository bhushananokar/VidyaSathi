import logging
import asyncio
from groq import Groq
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GroqService:
    def __init__(self):
        self.client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else None

    async def transcribe(self, audio_bytes: bytes, language: str | None = None) -> tuple[str, str]:
        """Transcribe audio using Groq Whisper. Returns (transcript, detected_language)."""
        if not self.client:
            return "Groq API key not configured", "en"
        try:
            kwargs = {
                "file": ("audio.webm", audio_bytes, "audio/webm"),
                "model": "whisper-large-v3",
                "response_format": "verbose_json",
            }
            if language:
                kwargs["language"] = language

            result = await asyncio.to_thread(
                lambda: self.client.audio.transcriptions.create(**kwargs)
            )
            transcript = result.text or ""
            detected_lang = getattr(result, "language", "en") or "en"
            return transcript.strip(), detected_lang
        except Exception as e:
            logger.error(f"Groq transcription error: {e}")
            return "", "en"

    async def text_to_speech(self, text: str, voice: str = "Zephyr-PlayAI") -> bytes:
        """Convert text to speech using Groq TTS. Returns audio bytes."""
        if not self.client:
            return b""
        try:
            # Truncate long text to avoid TTS limits
            text = text[:2000]
            response = await asyncio.to_thread(
                lambda: self.client.audio.speech.create(
                    model="playai-tts",
                    voice=voice,
                    input=text,
                    response_format="mp3",
                )
            )
            return response.content
        except Exception as e:
            logger.error(f"Groq TTS error: {e}")
            return b""

    async def detect_language(self, text: str) -> str:
        """Simple heuristic language detection."""
        hindi_chars = sum(1 for c in text if "\u0900" <= c <= "\u097F")
        if hindi_chars > len(text) * 0.1:
            return "hi"
        marathi_keywords = ["आहे", "आहेत", "मला", "तुम्ही", "काय"]
        if any(kw in text for kw in marathi_keywords):
            return "mr"
        return "en"
