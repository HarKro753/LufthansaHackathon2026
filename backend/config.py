from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_api_key: str = ""
    google_genai_use_vertexai: bool = False
    port: int = 8000
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
