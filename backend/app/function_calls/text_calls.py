from app.functions.text import normalize_text


def normalize_user_text(value: str) -> str:
    """Application-facing call point for text utility functions."""
    return normalize_text(value)
