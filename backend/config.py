from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env into os.environ FIRST — the Google ADK/genai client
# reads GOOGLE_API_KEY and GOOGLE_GENAI_USE_VERTEXAI directly
# from the environment, not from pydantic settings.
load_dotenv()


class Settings(BaseSettings):
    google_api_key: str = ""
    google_genai_use_vertexai: bool = False
    port: int = 8000
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
