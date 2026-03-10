import asyncio
import aiohttp
import time

BASE_URL = "http://localhost:5000/api"

async def attack_endpoint(session, url, method="GET", json=None):
    try:
        async with session.request(method, url, json=json) as response:
            status = response.status
            return status
    except Exception as e:
        return str(e)

async def simulate_brute_force(session):
    print("🚀 Starting Brute Force Attack on /auth/login...")
    tasks = []
    for _ in range(20): # authLimiter max is 10
        tasks.append(attack_endpoint(session, f"{BASE_URL}/auth/login", "POST", {"phone": "0123456789", "password": "wrong"}))
    
    results = await asyncio.gather(*tasks)
    denied = results.count(429)
    print(f"Outcome: {denied} requests blocked by Rate Limiter (429 Status).")

async def simulate_ddos(session):
    print("🌊 Starting High-Volume Burst (DDoS Simulation)...")
    tasks = []
    for _ in range(500): # publicLimiter max is 300/5min
        tasks.append(attack_endpoint(session, f"{BASE_URL}/health"))
    
    results = await asyncio.gather(*tasks)
    denied = results.count(429)
    print(f"Outcome: {denied} requests blocked by Public Rate Limiter.")

async def main():
    async with aiohttp.ClientSession() as session:
        # Note: This requires the server to be running locally.
        # I am providing this script for the user to run in their environment.
        await simulate_brute_force(session)
        print("-" * 30)
        await simulate_ddos(session)

if __name__ == "__main__":
    # asyncio.run(main()) # Uncomment to run
    print("Attack script ready.")
