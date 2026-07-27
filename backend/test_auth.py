from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.future import select
import uuid
import asyncio

from app.main import app
from app.database import get_db, Base
from app.models import User, Project, Generation
from app.config import get_settings

client = TestClient(app)

def test_auth_isolation():
    print("\n--- Starting Auth Isolation Test ---")
    
    # 1. Signup User A
    username_a = f"user_a_{uuid.uuid4().hex[:6]}"
    res_a = client.post("/api/auth/signup", json={"username": username_a, "password": "password123"})
    assert res_a.status_code == 200
    token_a = res_a.json()["access_token"]
    
    # 2. Signup User B
    username_b = f"user_b_{uuid.uuid4().hex[:6]}"
    res_b = client.post("/api/auth/signup", json={"username": username_b, "password": "password123"})
    assert res_b.status_code == 200
    token_b = res_b.json()["access_token"]
    
    print(f"User A ({username_a}) and User B ({username_b}) created.")

    # 3. User A creates a generation
    # Because Gemini is not mocked here and might fail, we just want to ensure we get a Generation ID, 
    # even if it returns 'needs_review' or 'failed' status because of a missing API key.
    # The generation record is still created in the DB before the pipeline runs.
    res_gen = client.post("/api/generations", 
        json={"topic": "Test", "platform": "linkedin", "raw_thoughts": "Thoughts"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_gen.status_code == 200
    gen_id = res_gen.json()["generation_id"]
    print(f"User A created generation {gen_id}.")
    
    # 4. User B attempts to edit User A's generation
    res_edit = client.post(f"/api/generations/{gen_id}/edit", 
        json={"instruction": "Change it", "draft_index": 1},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    
    # It should be 404 because User B does not own this generation
    assert res_edit.status_code == 404, f"Expected 404, got {res_edit.status_code}"
    print("SUCCESS: User B was blocked from editing User A's generation.")
    
    # 5. User B attempts to finalize User A's generation
    res_finalize = client.post(f"/api/generations/{gen_id}/finalize", 
        json={"final_draft_index": 1},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res_finalize.status_code == 404, f"Expected 404, got {res_finalize.status_code}"
    print("SUCCESS: User B was blocked from finalizing User A's generation.")
    
    print("--- Auth Isolation Test Passed ---")

if __name__ == "__main__":
    test_auth_isolation()
