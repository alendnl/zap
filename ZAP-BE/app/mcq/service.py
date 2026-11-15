import re
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from app.mcq.models import (
    MCQQuestion,
    MCQQuestionCreate,
    MCQQuestionUpdate,
    MCQQuestionSummary,
    MCQOption,
)
from app.mcq.seed_data import SEED_MCQ_QUESTIONS


def slugify(text: str) -> str:
    slug = text.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_-]+", "-", slug)
    return slug.strip("-")


class MCQService:
    def __init__(self, db):
        self.db = db
        self._memory_store: Dict[str, Dict[str, Any]] = {}

    def _get_collection(self):
        if self.db is not None:
            if hasattr(self.db, "mcq_questions"):
                return self.db.mcq_questions
            if hasattr(self.db, "__getitem__"):
                try:
                    return self.db["mcq_questions"]
                except Exception:
                    pass
        return None

    def seed_default_questions(self, force: bool = False) -> Dict[str, Any]:
        """Insert or upsert the 10 curated initial MCQ questions."""
        coll = self._get_collection()
        seeded_count = 0

        for raw in SEED_MCQ_QUESTIONS:
            q_data = dict(raw)
            qid = q_data.get("id") or str(uuid.uuid4())
            q_data["id"] = qid
            q_data["_id"] = qid
            q_data.setdefault("version", 1)
            q_data.setdefault("createdBy", "system-seed")
            q_data.setdefault("updatedBy", "system-seed")
            q_data.setdefault("createdAt", datetime.now(timezone.utc).isoformat())
            q_data.setdefault("updatedAt", datetime.now(timezone.utc).isoformat())

            if coll is not None:
                existing = coll.find_one({"$or": [{"_id": qid}, {"id": qid}, {"slug": q_data.get("slug")}]})
                if existing and not force:
                    continue
                coll.update_one(
                    {"$or": [{"_id": qid}, {"id": qid}]},
                    {"$set": q_data},
                    upsert=True
                )
                seeded_count += 1
            else:
                if qid in self._memory_store and not force:
                    continue
                self._memory_store[qid] = q_data
                seeded_count += 1

        total = coll.count_documents({}) if coll is not None else len(self._memory_store)
        return {"seeded": seeded_count, "total": total}

    def create_question(self, data: MCQQuestionCreate) -> MCQQuestion:
        payload = data.model_dump()
        qid = payload.get("id") or str(uuid.uuid4())
        payload["id"] = qid

        # Generate slug if empty
        if not payload.get("slug"):
            base_slug = slugify(payload["title"])
            payload["slug"] = f"{base_slug}-{qid[:8]}"

        # Ensure option IDs exist
        options = []
        for opt in payload.get("options", []):
            if isinstance(opt, dict):
                opt_copy = dict(opt)
                if not opt_copy.get("id"):
                    opt_copy["id"] = str(uuid.uuid4())
                options.append(opt_copy)
            else:
                options.append(opt)
        payload["options"] = options

        now = datetime.now(timezone.utc).isoformat()
        payload.setdefault("createdAt", now)
        payload.setdefault("updatedAt", now)
        payload.setdefault("version", 1)

        question = MCQQuestion(**payload)
        doc = question.model_dump()
        doc["_id"] = question.id

        coll = self._get_collection()
        if coll is not None:
            coll.insert_one(doc)
        else:
            self._memory_store[question.id] = doc

        return question

    def get_question(self, question_id: str) -> Optional[MCQQuestion]:
        coll = self._get_collection()
        if coll is not None:
            query_filter = [{"_id": question_id}, {"id": question_id}, {"slug": question_id}]
            try:
                from bson import ObjectId
                if ObjectId.is_valid(question_id):
                    query_filter.append({"_id": ObjectId(question_id)})
            except Exception:
                pass

            doc = coll.find_one({"$or": query_filter})
            if doc:
                if not doc.get("id") and "_id" in doc:
                    doc["id"] = str(doc["_id"])
                doc.pop("_id", None)
                return MCQQuestion(**doc)
            return None

        # Memory store fallback
        doc = self._memory_store.get(question_id)
        if doc:
            clean = dict(doc)
            if not clean.get("id") and "_id" in clean:
                clean["id"] = str(clean["_id"])
            clean.pop("_id", None)
            return MCQQuestion(**clean)

        for item in self._memory_store.values():
            if item.get("slug") == question_id:
                clean = dict(item)
                if not clean.get("id") and "_id" in clean:
                    clean["id"] = str(clean["_id"])
                clean.pop("_id", None)
                return MCQQuestion(**clean)

        return None

    def list_questions(
        self,
        category: Optional[str] = None,
        difficulty: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        summary: bool = True,
    ) -> List[Union[MCQQuestionSummary, MCQQuestion]]:
        coll = self._get_collection()

        # Auto-seed if collection is completely empty
        if coll is not None:
            try:
                if coll.count_documents({}) == 0:
                    self.seed_default_questions(force=False)
            except Exception:
                pass
        else:
            if len(self._memory_store) == 0:
                self.seed_default_questions(force=False)

        query: Dict[str, Any] = {}
        if category and category.upper() != "ALL":
            query["category"] = {"$regex": f"^{re.escape(category)}$", "$options": "i"}
        if difficulty and difficulty.upper() != "ALL":
            query["difficulty"] = difficulty.upper()
        if status and status.upper() != "ALL":
            query["status"] = status.upper()

        if search and search.strip():
            clean_search = search.strip()
            regex_query = {"$regex": re.escape(clean_search), "$options": "i"}
            query["$or"] = [
                {"title": regex_query},
                {"statement": regex_query},
                {"category": regex_query},
                {"tags": regex_query},
            ]

        results = []
        if coll is not None:
            cursor = coll.find(query).sort("createdAt", -1)
            for doc in cursor:
                if not doc.get("id") and "_id" in doc:
                    doc["id"] = str(doc["_id"])
                doc.pop("_id", None)
                if summary:
                    opts = doc.get("options", [])
                    correct_count = sum(1 for o in opts if o.get("isCorrect"))
                    summary_doc = {
                        "id": doc.get("id"),
                        "slug": doc.get("slug"),
                        "title": doc.get("title", ""),
                        "category": doc.get("category", "DSA"),
                        "difficulty": doc.get("difficulty", "EASY"),
                        "tags": doc.get("tags", []),
                        "questionType": doc.get("questionType", "text"),
                        "statement": doc.get("statement", ""),
                        "codeSnippet": doc.get("codeSnippet"),
                        "imageUrl": doc.get("imageUrl"),
                        "optionsCount": len(opts),
                        "correctOptionsCount": correct_count,
                        "points": doc.get("points", 1),
                        "status": doc.get("status", "PUBLISHED"),
                        "createdAt": doc.get("createdAt", ""),
                        "updatedAt": doc.get("updatedAt", ""),
                    }
                    results.append(MCQQuestionSummary(**summary_doc))
                else:
                    results.append(MCQQuestion(**doc))
            return results

        # Memory store fallback
        for doc in self._memory_store.values():
            # Apply filters
            if category and category.upper() != "ALL":
                if doc.get("category", "").upper() != category.upper():
                    continue
            if difficulty and difficulty.upper() != "ALL":
                if doc.get("difficulty", "").upper() != difficulty.upper():
                    continue
            if status and status.upper() != "ALL":
                if doc.get("status", "").upper() != status.upper():
                    continue
            if search and search.strip():
                term = search.strip().lower()
                title_match = term in doc.get("title", "").lower()
                stmt_match = term in doc.get("statement", "").lower()
                cat_match = term in doc.get("category", "").lower()
                tag_match = any(term in t.lower() for t in doc.get("tags", []))
                if not (title_match or stmt_match or cat_match or tag_match):
                    continue

            clean = dict(doc)
            if not clean.get("id") and "_id" in clean:
                clean["id"] = str(clean["_id"])
            clean.pop("_id", None)

            if summary:
                opts = clean.get("options", [])
                correct_count = sum(1 for o in opts if o.get("isCorrect"))
                summary_doc = {
                    "id": clean.get("id"),
                    "slug": clean.get("slug"),
                    "title": clean.get("title", ""),
                    "category": clean.get("category", "DSA"),
                    "difficulty": clean.get("difficulty", "EASY"),
                    "tags": clean.get("tags", []),
                    "questionType": clean.get("questionType", "text"),
                    "statement": clean.get("statement", ""),
                    "codeSnippet": clean.get("codeSnippet"),
                    "imageUrl": clean.get("imageUrl"),
                    "optionsCount": len(opts),
                    "correctOptionsCount": correct_count,
                    "points": clean.get("points", 1),
                    "status": clean.get("status", "PUBLISHED"),
                    "createdAt": clean.get("createdAt", ""),
                    "updatedAt": clean.get("updatedAt", ""),
                }
                results.append(MCQQuestionSummary(**summary_doc))
            else:
                results.append(MCQQuestion(**clean))

        return results

    def update_question(self, question_id: str, data: MCQQuestionUpdate) -> Optional[MCQQuestion]:
        coll = self._get_collection()
        existing = self.get_question(question_id)
        if not existing:
            return None

        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return existing

        update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        update_data["version"] = existing.version + 1

        if coll is not None:
            coll.update_one(
                {"$or": [{"_id": existing.id}, {"id": existing.id}]},
                {"$set": update_data}
            )
            return self.get_question(existing.id)

        doc = self._memory_store.get(existing.id)
        if doc:
            doc.update(update_data)
            return self.get_question(existing.id)

        return None

    def delete_question(self, question_id: str) -> bool:
        coll = self._get_collection()
        existing = self.get_question(question_id)
        if not existing:
            return False

        if coll is not None:
            res = coll.delete_one({"$or": [{"_id": existing.id}, {"id": existing.id}]})
            return res.deleted_count > 0

        if existing.id in self._memory_store:
            del self._memory_store[existing.id]
            return True

        return False

