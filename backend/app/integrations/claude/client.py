from anthropic import AsyncAnthropic

from app.core.config import Settings


class ClaudeClient:
    def __init__(self, settings: Settings) -> None:
        if not settings.claude_api_key:
            raise ValueError("CLAUDE_API_KEY is required")

        self._client = AsyncAnthropic(api_key=settings.claude_api_key)

    async def create_message(self, prompt: str) -> str:
        response = await self._client.messages.create(
            model="claude-3-5-sonnet-latest",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        first_block = response.content[0]
        return first_block.text if hasattr(first_block, "text") else ""
