from __future__ import annotations

from fastapi import FastAPI, HTTPException

from backend.config import load_config
from backend.model_runtime import ModelRuntime
from backend.schemas import AssistRequest
from backend.service import run_assist


"""
Code KI V6 Backend API

Eine lokale Python-KI für VS Code Extension mit strukturierten Responses.
Unterstützt V6 (Produkt), V4 (kontrolliert), und V5 (Labor).

Endpoints:
  - GET /health: Service Health Check
  - POST /assist: Hauptendpoint für Code-Assistenz-Anfragen
"""

CONFIG = load_config()
RUNTIME = ModelRuntime(CONFIG)
app = FastAPI(title="Code KI", version="6.0.0")


@app.get("/health")
def health() -> dict:
    """
    Health Check Endpoint
    
    Returns:
        dict: Status des Backends mit Service-Info, Host und Port
        
    Example:
        {
            "status": "healthy",
            "service": "code-ki-backend",
            "host": "127.0.0.1",
            "port": 8000,
            "model_ready": true
        }
    """
    payload = RUNTIME.health_payload()
    payload["service"] = "code-ki-backend"
    payload["host"] = CONFIG.host
    payload["port"] = CONFIG.port
    return payload


@app.post("/assist")
def assist(request: AssistRequest) -> dict:
    """
    Hauptendpoint für Code-KI Assistenz
    
    Args:
        request (AssistRequest): Anfrage mit Prompt, Modus, und Kontext
        
    Returns:
        dict: Strukturierte Response mit Code, Tests, und Status
        
    Raises:
        HTTPException: Bei Modell-Fehlern oder Konfigurationsproblemen
        
    Mögliche Modi (request.mode):
        - "v6_product": Standardmodus mit strukturierter Output
        - "agent_v4": Kontrollierter Modus für kritische Aufgaben
        - "agent_v5_lab": Experimenteller Laborbereich
        - "project_agent": Auto-agiert innerhalb Workspace-Grenzen
    """
    try:
        return run_assist(request, config=CONFIG, runtime=RUNTIME)
    except RuntimeError as exc:
        blocker = str(exc)
        status_code = 503 if blocker == "model_path_missing" else 500
        raise HTTPException(
            status_code=status_code,
            detail={
                "status": "error",
                "blocker": blocker,
                "message": "Lokale Code-KI konnte den Auftrag nicht verarbeiten.",
            },
        ) from exc
