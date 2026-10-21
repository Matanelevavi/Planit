import secrets
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Every value can be set with a PLANIT_* environment variable."""

    model_config = SettingsConfigDict(env_prefix="PLANIT_", env_file=".env", extra="ignore")

    env: Literal["dev", "test", "prod"] = "dev"
    database_url: str = "sqlite:///./planit.db"
    secret_key: str = ""
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    # JSON list in the environment, e.g. PLANIT_CORS_ORIGINS='["https://app.example.com"]'
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    cookie_secure: bool = False
    rate_limit_enabled: bool = True
    max_failed_logins: int = 5
    lockout_minutes: int = 15
    max_goals_per_user: int = 50

    @model_validator(mode="after")
    def _check_secrets(self) -> "Settings":
        if self.env == "prod":
            if len(self.secret_key) < 32:
                raise ValueError("PLANIT_SECRET_KEY must be set (32+ chars) when PLANIT_ENV=prod")
            if not self.cookie_secure:
                raise ValueError("PLANIT_COOKIE_SECURE must be true when PLANIT_ENV=prod")
        elif not self.secret_key:
            # Dev/test convenience: a random key per process (tokens die on restart).
            self.secret_key = secrets.token_urlsafe(48)
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
