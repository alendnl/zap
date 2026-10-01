from typing import List, Optional
from datetime import datetime, timezone
from app.questions.models import Question, QuestionCreate, QuestionUpdate


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
            doc = coll.find_one({"$or": [{"_id": question_id}, {"id": question_id}, {"slug": question_id}]})
            if doc:
                doc.pop("_id", None)
                return Question(**doc)
            return None
        doc = self._memory_store.get(question_id)
        if doc:
            clean = dict(doc)
            clean.pop("_id", None)
            return Question(**clean)
        # Search by slug in memory
        for item in self._memory_store.values():
            if item.get("slug") == question_id:
                clean = dict(item)
                clean.pop("_id", None)
                return Question(**clean)
        return None

    def list_questions(self, status: Optional[str] = None) -> List[Question]:
        coll = self._get_collection()
        questions = []
        if coll is not None:
            query = {}
            if status:
                query["status"] = status
            cursor = coll.find(query)
            for doc in cursor:
                doc.pop("_id", None)
                questions.append(Question(**doc))
            return questions
        
        for item in self._memory_store.values():
            if status and item.get("status") != status:
                continue
            clean = dict(item)
            clean.pop("_id", None)
            questions.append(Question(**clean))
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
            coll.update_one({"$or": [{"_id": existing.id}, {"id": existing.id}]}, {"$set": update_data})
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
            result = coll.delete_one({"$or": [{"_id": existing.id}, {"id": existing.id}]})
            return result.deleted_count > 0
        
        if existing.id in self._memory_store:
            del self._memory_store[existing.id]
            return True
        return False
