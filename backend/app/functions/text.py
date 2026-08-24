def normalize_text(value: str) -> str:
    """Normalize user-provided text before it enters business logic."""
    return " ".join(value.strip().split())
