import os
import hashlib
import secrets
from typing import Optional, Tuple
from datetime import datetime, timezone
import uuid

from app.auth.models import StudentSignUpRequest, StudentLoginRequest, StudentProfile


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000).hex()
    return f"{salt}:{key}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        parts = stored_hash.split(":")
        if len(parts) != 2:
            return False
        salt, key = parts
        calc_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000).hex()
        return secrets.compare_digest(calc_key, key)
    except Exception:
        return False


class AuthService:
    def __init__(self, db):
        self.db = db
        self._memory_users = {}

    def _get_collection(self):
        if self.db is not None and hasattr(self.db, "users"):
            return self.db.users
        return None

    def sign_up(self, req: StudentSignUpRequest) -> Tuple[StudentProfile, str]:
        email_clean = req.email.strip().lower()
        student_id_clean = req.studentId.strip()
        coll = self._get_collection()

        # Check existing email or studentId
        if coll is not None:
            existing = coll.find_one({
                "$or": [
                    {"email": email_clean},
                    {"studentId": student_id_clean}
                ]
            })
            if existing:
                if existing.get("email") == email_clean:
                    raise ValueError(f"An account with email '{req.email}' already exists.")
                raise ValueError(f"An account with Student ID '{req.studentId}' already exists.")
        else:
            for u in self._memory_users.values():
                if u.get("email") == email_clean:
                    raise ValueError(f"An account with email '{req.email}' already exists.")
                if u.get("studentId") == student_id_clean:
                    raise ValueError(f"An account with Student ID '{req.studentId}' already exists.")

        user_id = f"std-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        pwd_hash = hash_password(req.password)

        doc = {
            "_id": user_id,
            "id": user_id,
            "name": req.name.strip(),
            "studentId": student_id_clean,
            "collegeName": req.collegeName.strip(),
            "email": email_clean,
            "passwordHash": pwd_hash,
            "createdAt": now,
        }

        if coll is not None:
            coll.insert_one(doc)
        else:
            self._memory_users[user_id] = doc

        token = f"tok-{secrets.token_urlsafe(32)}"
        profile = StudentProfile(
            id=user_id,
            name=doc["name"],
            studentId=doc["studentId"],
            collegeName=doc["collegeName"],
            email=doc["email"],
            createdAt=doc["createdAt"],
        )
        return profile, token

    def login(self, req: StudentLoginRequest) -> Tuple[StudentProfile, str]:
        ident = req.email.strip()
        ident_lower = ident.lower()
        coll = self._get_collection()
        user_doc = None

        if coll is not None:
            user_doc = coll.find_one({
                "$or": [
                    {"email": ident_lower},
                    {"studentId": ident},
                ]
            })
        else:
            for u in self._memory_users.values():
                if u.get("email") == ident_lower or u.get("studentId") == ident:
                    user_doc = u
                    break

        if not user_doc:
            raise ValueError("Invalid email/ID or password.")

        if not verify_password(req.password, user_doc.get("passwordHash", "")):
            raise ValueError("Invalid email/ID or password.")

        token = f"tok-{secrets.token_urlsafe(32)}"
        profile = StudentProfile(
            id=user_doc.get("id", user_doc.get("_id")),
            name=user_doc["name"],
            studentId=user_doc["studentId"],
            collegeName=user_doc["collegeName"],
            email=user_doc["email"],
            createdAt=user_doc.get("createdAt", datetime.now(timezone.utc).isoformat()),
        )
        return profile, token

    def get_profile(self, identifier: str) -> Optional[StudentProfile]:
        coll = self._get_collection()
        user_doc = None

        if coll is not None:
            user_doc = coll.find_one({
                "$or": [{"id": identifier}, {"_id": identifier}, {"email": identifier.lower()}, {"studentId": identifier}]
            })
        else:
            for u in self._memory_users.values():
                if u.get("id") == identifier or u.get("email") == identifier.lower() or u.get("studentId") == identifier:
                    user_doc = u
                    break

        if not user_doc:
            return None

        return StudentProfile(
            id=user_doc.get("id", user_doc.get("_id")),
            name=user_doc["name"],
            studentId=user_doc["studentId"],
            collegeName=user_doc["collegeName"],
            email=user_doc["email"],
            createdAt=user_doc.get("createdAt", datetime.now(timezone.utc).isoformat()),
        )
