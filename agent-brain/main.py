import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("BRAIN_PORT", 8082)))
    print(f"⚡ Starting Chatbolt Agent-Brain service on http://0.0.0.0:{port}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)
