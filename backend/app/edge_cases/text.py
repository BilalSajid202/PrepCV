def reject_empty_text(value: str, field_name: str = "text") -> None:
    if not value.strip():
        raise ValueError(f"{field_name} cannot be empty")
