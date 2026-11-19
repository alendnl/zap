from typing import Optional, Dict, Any, List, Union
import re
from datetime import datetime, timezone
from app.questions.models import Question, QuestionCreate, QuestionUpdate, QuestionSummary


class QuestionService:
    def __init__(self, db):
        self.db = db
        # Internal memory store fallback if db is None or mongomock dict
        self._memory_store = {}

    def _get_collection(self):
        if self.db is not None and hasattr(self.db, "questions"):
            return self.db.questions
        return None

    def create_question(self, data: QuestionCreate) -> Question:
        question = Question(**data.model_dump())
        coll = self._get_collection()
        doc = question.model_dump()
        doc["_id"] = question.id
        if coll is not None:
            coll.insert_one(doc)
        else:
            self._memory_store[question.id] = doc
        return question

    def get_question(self, question_id: str) -> Optional[Question]:
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
                return Question(**doc)
            return None
        doc = self._memory_store.get(question_id)
        if doc:
            clean = dict(doc)
            if not clean.get("id") and "_id" in clean:
                clean["id"] = str(clean["_id"])
            clean.pop("_id", None)
            return Question(**clean)
        # Search by slug in memory
        for item in self._memory_store.values():
            if item.get("slug") == question_id:
                clean = dict(item)
                if not clean.get("id") and "_id" in clean:
                    clean["id"] = str(clean["_id"])
                clean.pop("_id", None)
                return Question(**clean)
        return None

    def list_questions(
        self,
        status: Optional[str] = None,
        difficulty: Optional[str] = None,
        search: Optional[str] = None,
        page: Optional[int] = None,
        limit: Optional[int] = None,
        summary: bool = True,
    ) -> Union[List[Union[QuestionSummary, Question]], Dict[str, Any]]:
        coll = self._get_collection()
        query: Dict[str, Any] = {}
        if status and status.upper() != "ALL":
            query["status"] = status
        if difficulty and difficulty.upper() != "ALL":
            query["difficulty"] = difficulty.upper()
        if search and search.strip():
            rgx = {"$regex": re.escape(search.strip()), "$options": "i"}
            query["$or"] = [{"title": rgx}, {"slug": rgx}, {"tags": rgx}]

        questions = []
        if coll is not None:
            if summary:
                projection = {
                    "_id": 1,
                    "id": 1,
                    "slug": 1,
                    "title": 1,
                    "difficulty": 1,
                    "tags": 1,
                    "status": 1,
                    "version": 1,
                    "supportedLanguages": 1,
                    "testCasesCount": 1,
                    "testCases": 1,
                }
                cursor = coll.find(query, projection).sort("createdAt", -1)
                total = coll.count_documents(query) if page is not None and limit is not None else 0

                if page is not None and limit is not None:
                    skip = (page - 1) * limit
                    cursor = cursor.skip(skip).limit(limit)

                for doc in cursor:
                    if not doc.get("id") and "_id" in doc:
                        doc["id"] = str(doc["_id"])
                    doc.pop("_id", None)
                    if doc.get("testCasesCount") is None:
                        doc["testCasesCount"] = len(doc.get("testCases", []))
                    doc.pop("testCases", None)
                    questions.append(QuestionSummary(**doc))

                if page is not None and limit is not None:
                    return {
                        "items": questions,
                        "total": total,
                        "page": page,
                        "limit": limit,
                        "totalPages": max(1, (total + limit - 1) // limit),
                    }
                return questions

            cursor = coll.find(query).sort("createdAt", -1)
            total = coll.count_documents(query) if page is not None and limit is not None else 0

            if page is not None and limit is not None:
                skip = (page - 1) * limit
                cursor = cursor.skip(skip).limit(limit)

            for doc in cursor:
                if not doc.get("id") and "_id" in doc:
                    doc["id"] = str(doc["_id"])
                doc.pop("_id", None)
                questions.append(Question(**doc))

            if page is not None and limit is not None:
                return {
                    "items": questions,
                    "total": total,
                    "page": page,
                    "limit": limit,
                    "totalPages": max(1, (total + limit - 1) // limit),
                }
            return questions

        # Memory store fallback
        for item in self._memory_store.values():
            if status and status.upper() != "ALL" and item.get("status") != status:
                continue
            if difficulty and difficulty.upper() != "ALL" and str(item.get("difficulty", "")).upper() != difficulty.upper():
                continue
            if search and search.strip():
                s = search.strip().lower()
                title_match = s in str(item.get("title", "")).lower()
                slug_match = s in str(item.get("slug", "")).lower()
                tags_match = any(s in str(t).lower() for t in item.get("tags", []))
                if not (title_match or slug_match or tags_match):
                    continue

            clean = dict(item)
            if not clean.get("id") and "_id" in clean:
                clean["id"] = str(clean["_id"])
            clean.pop("_id", None)
            if summary:
                if clean.get("testCasesCount") is None:
                    clean["testCasesCount"] = len(clean.get("testCases", []))
                clean.pop("testCases", None)
                questions.append(QuestionSummary(**clean))
            else:
                questions.append(Question(**clean))

        if page is not None and limit is not None:
            total = len(questions)
            skip = (page - 1) * limit
            sliced = questions[skip : skip + limit]
            return {
                "items": sliced,
                "total": total,
                "page": page,
                "limit": limit,
                "totalPages": max(1, (total + limit - 1) // limit),
            }
        return questions

    def update_question(self, question_id: str, data: QuestionUpdate) -> Optional[Question]:
        existing = self.get_question(question_id)
        if not existing:
            return None
        
        update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        update_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
        update_data["version"] = existing.version + 1

        coll = self._get_collection()
        if coll is not None:
            query_filter = [{"_id": existing.id}, {"id": existing.id}]
            try:
                from bson import ObjectId
                if ObjectId.is_valid(existing.id):
                    query_filter.append({"_id": ObjectId(existing.id)})
            except Exception:
                pass
            coll.update_one({"$or": query_filter}, {"$set": update_data})
        else:
            if existing.id in self._memory_store:
                self._memory_store[existing.id].update(update_data)

        return self.get_question(existing.id)

    def delete_question(self, question_id: str) -> bool:
        existing = self.get_question(question_id)
        if not existing:
            return False
        
        coll = self._get_collection()
        if coll is not None:
            query_filter = [{"_id": existing.id}, {"id": existing.id}]
            try:
                from bson import ObjectId
                if ObjectId.is_valid(existing.id):
                    query_filter.append({"_id": ObjectId(existing.id)})
            except Exception:
                pass
            result = coll.delete_one({"$or": query_filter})
            return result.deleted_count > 0
        
        if existing.id in self._memory_store:
            del self._memory_store[existing.id]
            return True
        return False
