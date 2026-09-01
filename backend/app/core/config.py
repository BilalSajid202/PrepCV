import os
import re
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PrepCV API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:bilal202sajid@localhost:5432/prepcv"
    
    # Hugging Face Configuration (Model and API Keys)
    hf_model: str = "Qwen/Qwen2.5-Coder-32B-Instruct"
    hf_api_url: str = "https://router.huggingface.co/v1/chat/completions"
    hf_api_keys_raw: str = ""
    hf_api_key: str = ""
    hf_api_key_1: str = ""
    hf_api_key_2: str = ""
    hf_api_key_3: str = ""
    hf_api_key_4: str = ""
    hf_api_key_5: str = ""
    
    # Integrations
    tavily_api_key: str = ""
    
    secret_key: str = "prepcv-secret-key-change-in-production-super-secure-32chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        env_nested_delimiter="__",
    )

    def get_hf_api_keys(self) -> List[str]:
        """
        Collect and deduplicate all configured Hugging Face API keys.
        Supports comma-separated HF_API_KEYS, HF_API_KEY, HF_API_KEY_1..5,
        and directly parsing multiple HF_API_KEY lines from .env.
        """
        keys: List[str] = []

        # 1. Comma-separated or whitespace-separated HF_API_KEYS
        if self.hf_api_keys_raw:
            for k in re.split(r"[,;\s]+", self.hf_api_keys_raw.strip()):
                if k.strip().startswith("hf_"):
                    keys.append(k.strip())

        # 2. Numbered keys HF_API_KEY_1 through HF_API_KEY_10
        for attr in [
            self.hf_api_key_1,
            self.hf_api_key_2,
            self.hf_api_key_3,
            self.hf_api_key_4,
            self.hf_api_key_5,
            self.hf_api_key,
        ]:
            if attr and attr.strip().startswith("hf_"):
                keys.append(attr.strip())

        # 3. Also check direct environment variables
        for env_k, env_v in os.environ.items():
            if env_k.startswith("HF_API_KEY") and env_v.strip().startswith("hf_"):
                keys.append(env_v.strip())

        # 4. Fallback parser: read .env file directly to catch multiple HF_API_KEY lines
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("HF_API_KEY") and "=" in line:
                            val = line.split("=", 1)[1].strip().strip("\"'")
                            if val.startswith("hf_"):
                                keys.append(val)
            except Exception:
                pass

        # Deduplicate while preserving insertion order
        seen = set()
        unique_keys = []
        for k in keys:
            if k not in seen:
                seen.add(k)
                unique_keys.append(k)

        return unique_keys


@lru_cache
def get_settings() -> Settings:
    return Settings()
