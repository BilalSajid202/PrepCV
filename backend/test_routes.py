import asyncio
import httpx
from app.main import app

async def main():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        r1 = await c.get("/api/profile")
        print("GET /api/profile ->", r1.status_code, r1.json())
        
        r2 = await c.get("/api/profile/")
        print("GET /api/profile/ ->", r2.status_code, r2.json())
        
        r3 = await c.get("/profile")
        print("GET /profile ->", r3.status_code, r3.json())
        
        r4 = await c.get("/api/auth/me")
        print("GET /api/auth/me ->", r4.status_code, r4.json())

if __name__ == "__main__":
    asyncio.run(main())
