from backend.main import app

# Expose app for Vercel zero-config serverless function detection
handler = app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
