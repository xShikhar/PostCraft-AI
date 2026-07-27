import pytest
import uuid
from fastapi.testclient import TestClient

@pytest.mark.asyncio
async def test_auth_isolation(client: TestClient):
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

    # 3. User A creates a generation
    res_gen = client.post("/api/generations", 
        json={"topic": "Test Isolation", "platform": "linkedin", "raw_thoughts": "Thoughts"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_gen.status_code == 200
    gen_id = res_gen.json()["generation_id"]
    
    # 4. User B attempts to edit User A's generation
    res_edit = client.post(f"/api/generations/{gen_id}/edit", 
        json={"instruction": "Change it", "draft_index": 1},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    # It should be 404 because User B does not own this generation
    assert res_edit.status_code == 404
    
    # 5. User B attempts to finalize User A's generation
    res_finalize = client.post(f"/api/generations/{gen_id}/finalize", 
        json={"final_draft_index": 1},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res_finalize.status_code == 404
