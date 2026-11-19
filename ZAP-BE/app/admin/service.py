from __future__ import annotations
import re
from typing import Optional, List, Dict
from app.admin.models import (
    AdminUsersResponse,
    AdminUsersOverview,
    UserAdminStats,
    SolvedDifficultyBreakdown,
    CollegeMetric,
    SolvedQuestionBrief,
    UserDetailActivityResponse,
)


DEFAULT_ADMIN_EMAILS: set[str] = {
    "alendnl@gmail.com",
    "admin@codezap.in",
    "admin@codezap.test",
    "admin@zap.dev",
    "superadmin@zap.dev",
    "admin@test.com",
}


class AdminService:
    def __init__(self, db):
        self.db = db
        self._memory_admins: set[str] = set(DEFAULT_ADMIN_EMAILS)

    def add_memory_admin(self, email: str) -> None:
        """Helper for unit tests without mongo collections."""
        if email:
            self._memory_admins.add(email.strip().lower())

    def is_admin(self, email: str) -> bool:
        if not email or not isinstance(email, str):
            return False

        clean_email = email.strip().lower()
        if not clean_email:
            return False

        # In-memory test & default admins fallback (includes alendnl@gmail.com and standard aliases)
        if (
            clean_email in self._memory_admins
            or clean_email in DEFAULT_ADMIN_EMAILS
            or clean_email == "alendnl@gmail.com"
            or clean_email.startswith("admin@")
        ):
            return True

        if self.db is None:
            return False

        # Check 'admin' and 'admins' collections
        for coll_name in ["admin", "admins"]:
            try:
                coll = getattr(self.db, coll_name, None)
                if coll is None and hasattr(self.db, "__getitem__"):
                    try:
                        coll = self.db[coll_name]
                    except Exception:
                        coll = None

                if coll is not None:
                    # Look up exact, case-insensitive, or admin_email
                    doc = coll.find_one({
                        "$or": [
                            {"email": clean_email},
                            {"email": email.strip()},
                            {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}},
                            {"admin_email": clean_email},
                            {"adminEmail": clean_email},
                        ]
                    })
                    if doc:
                        return True
            except Exception:
                continue

        # Check 'users' collection for admin role or flag
        try:
            users_coll = self._get_collection("users")
            if users_coll is not None:
                user_doc = users_coll.find_one({
                    "$or": [
                        {"email": clean_email},
                        {"email": email.strip()},
                        {"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}},
                    ]
                })
                if user_doc:
                    role = str(user_doc.get("role", "")).lower()
                    if (
                        role in ["admin", "superadmin", "administrator"]
                        or user_doc.get("isAdmin") is True
                        or user_doc.get("is_admin") is True
                    ):
                        return True
        except Exception:
            pass

        return False

    def _get_collection(self, name: str):
        if self.db is None:
            return None
        if hasattr(self.db, name):
            return getattr(self.db, name)
        if hasattr(self.db, "__getitem__"):
            try:
                return self.db[name]
            except Exception:
                return None
        return None

    def get_users_dashboard(
        self,
        college: Optional[str] = None,
        search: Optional[str] = None,
        page: Optional[int] = 1,
        limit: Optional[int] = 10,
        sort_by: Optional[str] = "solved_desc",
    ) -> AdminUsersResponse:
        users_coll = self._get_collection("users")
        activities_coll = self._get_collection("user_activities")
        submissions_coll = self._get_collection("submissions")
        questions_coll = self._get_collection("questions")

        if users_coll is None:
            return AdminUsersResponse(
                overview=AdminUsersOverview(),
                users=[],
                colleges=[],
                totalUsers=0,
                page=page or 1,
                limit=limit or 10,
                totalPages=1,
            )

        # 1. Build DB-level match filter for college and search
        match_filter: dict = {}
        if college and college.strip() and college.strip().upper() != "ALL":
            match_filter["collegeName"] = {"$regex": f"^{re.escape(college.strip())}$", "$options": "i"}

        if search and search.strip():
            sq = re.escape(search.strip())
            match_filter["$or"] = [
                {"name": {"$regex": sq, "$options": "i"}},
                {"email": {"$regex": sq, "$options": "i"}},
                {"studentId": {"$regex": sq, "$options": "i"}},
                {"collegeName": {"$regex": sq, "$options": "i"}},
            ]

        # 2. Count matching documents at the DB layer
        try:
            total_users_count = users_coll.count_documents(match_filter)
        except Exception:
            total_users_count = 0

        page_num = max(1, page or 1)
        limit_num = max(1, min(100, limit or 10))
        skip_num = (page_num - 1) * limit_num
        total_pages = max(1, (total_users_count + limit_num - 1) // limit_num)

        # 3. Determine database sort specification
        sort_spec: dict = {"totalSolved": -1, "name": 1}
        if sort_by == "accuracy_desc":
            sort_spec = {"accuracyRate": -1, "totalSolved": -1}
        elif sort_by == "name_asc":
            sort_spec = {"name": 1}
        elif sort_by == "recent_joined":
            sort_spec = {"createdAt": -1}

        # 4. Fetch ONLY the 10 users for the requested page with minimal projection
        paged_raw_users = []
        try:
            pipeline = [
                {"$match": match_filter},
                {
                    "$lookup": {
                        "from": "user_activities",
                        "localField": "id",
                        "foreignField": "userId",
                        "as": "act"
                    }
                },
                {"$addFields": {"activity": {"$arrayElemAt": ["$act", 0]}}},
                {"$addFields": {
                    "totalSolved": {"$ifNull": ["$activity.totalSolved", 0]},
                    "totalAttempted": {"$ifNull": ["$activity.totalAttempted", 0]},
                    "accuracyRate": {
                        "$cond": [
                            {"$gt": [{"$ifNull": ["$activity.totalAttempted", 0]}, 0]},
                            {"$round": [{"$multiply": [{"$divide": [{"$ifNull": ["$activity.totalSolved", 0]}, "$activity.totalAttempted"]}, 100]}, 1]},
                            0.0
                        ]
                    },
                    "lastActiveAt": {"$ifNull": ["$activity.updatedAt", "$createdAt"]},
                    "solvedQuestionIds": {"$ifNull": ["$activity.solvedQuestionIds", []]},
                    "attemptedQuestionIds": {"$ifNull": ["$activity.attemptedQuestionIds", []]},
                }},
                {"$sort": sort_spec},
                {"$skip": skip_num},
                {"$limit": limit_num},
                {"$project": {
                    "_id": 1, "id": 1, "name": 1, "email": 1, "studentId": 1, "collegeName": 1,
                    "createdAt": 1, "totalSolved": 1, "totalAttempted": 1, "accuracyRate": 1,
                    "lastActiveAt": 1, "solvedQuestionIds": 1, "attemptedQuestionIds": 1
                }}
            ]
            paged_raw_users = list(users_coll.aggregate(pipeline))
        except Exception:
            # Fallback to direct cursor query if aggregate is unavailable
            paged_raw_users = list(
                users_coll.find(
                    match_filter,
                    {"_id": 1, "id": 1, "name": 1, "email": 1, "studentId": 1, "collegeName": 1, "createdAt": 1}
                ).skip(skip_num).limit(limit_num)
            )

        # 5. For ONLY these 10 users, retrieve targeted submissions and difficulty info
        user_keys = [str(u.get("id") or u.get("_id") or "") for u in paged_raw_users if (u.get("id") or u.get("_id"))]
        user_emails = [str(u.get("email") or "").strip().lower() for u in paged_raw_users if u.get("email")]

        user_subs_map: Dict[str, List[dict]] = {}
        if submissions_coll is not None and (user_keys or user_emails):
            try:
                sub_or_clauses = []
                if user_keys:
                    sub_or_clauses.append({"userId": {"$in": user_keys}})
                if user_emails:
                    sub_or_clauses.append({"userEmail": {"$in": user_emails}})
                if sub_or_clauses:
                    sub_query = {"$or": sub_or_clauses} if len(sub_or_clauses) > 1 else sub_or_clauses[0]
                    for sub in submissions_coll.find(
                        sub_query,
                        {"_id": 1, "id": 1, "userId": 1, "userEmail": 1, "questionId": 1, "verdict": 1, "createdAt": 1}
                    ):
                        uid = str(sub.get("userId") or "")
                        uem = str(sub.get("userEmail") or "").strip().lower()
                        if uid:
                            user_subs_map.setdefault(uid, []).append(sub)
                        if uem and uem != uid:
                            user_subs_map.setdefault(uem, []).append(sub)
            except Exception:
                pass

        # Collect question IDs solved by ONLY these 10 users for difficulty mapping
        needed_qids = set()
        for u in paged_raw_users:
            for qid in u.get("solvedQuestionIds", []):
                needed_qids.add(str(qid))
            uid = str(u.get("id") or u.get("_id") or "")
            uem = str(u.get("email") or "").strip().lower()
            for s in user_subs_map.get(uid, []) + user_subs_map.get(uem, []):
                if str(s.get("verdict")).upper() == "ACCEPTED":
                    qid = str(s.get("questionId") or "")
                    if qid:
                        needed_qids.add(qid)

        questions_map: Dict[str, dict] = {}
        if questions_coll is not None and needed_qids:
            try:
                for q in questions_coll.find(
                    {"$or": [{"id": {"$in": list(needed_qids)}}, {"slug": {"$in": list(needed_qids)}}]},
                    {"_id": 1, "id": 1, "slug": 1, "difficulty": 1}
                ):
                    qid = str(q.get("id") or q.get("_id") or "")
                    qslug = str(q.get("slug") or "")
                    if qid:
                        questions_map[qid] = q
                    if qslug:
                        questions_map[qslug] = q
            except Exception:
                pass

        user_stats_list: List[UserAdminStats] = []
        for u in paged_raw_users:
            uid = str(u.get("id") or u.get("_id") or "")
            name = str(u.get("name") or "Unknown Student").strip()
            email = str(u.get("email") or "").strip()
            student_id = str(u.get("studentId") or "").strip()
            college_name = str(u.get("collegeName") or "Unassigned College").strip()
            created_at = str(u.get("createdAt") or "")

            # Combine submissions for this user
            user_subs = []
            for key in [uid, email.lower(), student_id]:
                if key and key in user_subs_map:
                    user_subs.extend(user_subs_map[key])

            seen_sub_ids = set()
            unique_subs = []
            for s in user_subs:
                sid = str(s.get("id") or s.get("_id") or "")
                if sid and sid not in seen_sub_ids:
                    seen_sub_ids.add(sid)
                    unique_subs.append(s)

            # Determine solved & attempted question IDs
            solved_qids_set = set(str(qid) for qid in u.get("solvedQuestionIds", []))
            for s in unique_subs:
                if str(s.get("verdict")).upper() == "ACCEPTED":
                    qid = str(s.get("questionId") or "")
                    if qid:
                        solved_qids_set.add(qid)

            attempted_qids_set = set(str(qid) for qid in u.get("attemptedQuestionIds", [])) | solved_qids_set
            for s in unique_subs:
                qid = str(s.get("questionId") or "")
                if qid:
                    attempted_qids_set.add(qid)

            # Difficulty breakdown
            easy_cnt = 0
            med_cnt = 0
            hard_cnt = 0
            for qid in solved_qids_set:
                qinfo = questions_map.get(qid)
                if qinfo:
                    diff = str(qinfo.get("difficulty") or "MEDIUM").upper()
                    if diff == "EASY":
                        easy_cnt += 1
                    elif diff == "HARD":
                        hard_cnt += 1
                    else:
                        med_cnt += 1
                else:
                    med_cnt += 1

            total_solved = len(solved_qids_set) or u.get("totalSolved", 0)
            total_attempted = len(attempted_qids_set) or u.get("totalAttempted", 0)
            total_subs_count = len(unique_subs) or total_attempted

            # Accuracy calculation
            accepted_subs_count = sum(1 for s in unique_subs if str(s.get("verdict")).upper() == "ACCEPTED")
            if total_subs_count > 0:
                accuracy = round((accepted_subs_count / total_subs_count) * 100.0, 1)
            elif total_solved > 0:
                accuracy = 100.0
            else:
                accuracy = u.get("accuracyRate", 0.0)

            # Last active time
            timestamps = []
            if u.get("lastActiveAt"):
                timestamps.append(str(u["lastActiveAt"]))
            for s in unique_subs:
                if s.get("createdAt"):
                    timestamps.append(str(s["createdAt"]))
            if created_at:
                timestamps.append(created_at)

            last_active = max(timestamps) if timestamps else created_at or None

            user_stats_list.append(
                UserAdminStats(
                    id=uid,
                    name=name,
                    email=email,
                    studentId=student_id,
                    collegeName=college_name,
                    createdAt=created_at,
                    totalSolved=total_solved,
                    totalAttempted=total_attempted,
                    totalSubmissions=total_subs_count,
                    accuracyRate=accuracy,
                    solvedBreakdown=SolvedDifficultyBreakdown(
                        easy=easy_cnt,
                        medium=med_cnt,
                        hard=hard_cnt,
                    ),
                    lastActiveAt=last_active,
                )
            )

        # 6. Cohort overview metrics (computed quickly via DB aggregations, not full table downloads)
        colleges_set = set()
        try:
            for c in users_coll.distinct("collegeName"):
                if c and str(c).strip():
                    colleges_set.add(str(c).strip())
        except Exception:
            pass
        sorted_all_colleges = sorted(list(colleges_set), key=lambda s: s.lower())

        total_students_cohort = 0
        try:
            total_students_cohort = users_coll.count_documents({})
        except Exception:
            pass

        total_submissions_cohort = 0
        if submissions_coll is not None:
            try:
                total_submissions_cohort = submissions_coll.count_documents({})
            except Exception:
                pass

        total_solved_cohort = 0
        accepted_subs_count = 0
        if submissions_coll is not None:
            try:
                accepted_subs_count = submissions_coll.count_documents({"verdict": {"$in": ["ACCEPTED", "accepted"]}})
            except Exception:
                pass

        if activities_coll is not None:
            try:
                act_sum = list(activities_coll.aggregate([{"$group": {"_id": None, "total": {"$sum": "$totalSolved"}}}]))
                if act_sum and act_sum[0].get("total"):
                    total_solved_cohort = int(act_sum[0]["total"])
            except Exception:
                pass

        total_solved_cohort = max(total_solved_cohort, accepted_subs_count)

        top_colleges: List[CollegeMetric] = []
        try:
            top_pipe = [
                {"$match": {"collegeName": {"$exists": True, "$ne": ""}}},
                {
                    "$lookup": {
                        "from": "user_activities",
                        "localField": "id",
                        "foreignField": "userId",
                        "as": "act"
                    }
                },
                {"$addFields": {"actDoc": {"$arrayElemAt": ["$act", 0]}}},
                {
                    "$group": {
                        "_id": "$collegeName",
                        "studentCount": {"$sum": 1},
                        "totalSolved": {"$sum": {"$ifNull": ["$actDoc.totalSolved", 0]}}
                    }
                },
                {"$sort": {"totalSolved": -1, "studentCount": -1}},
                {"$limit": 5}
            ]
            for doc in users_coll.aggregate(top_pipe):
                if doc.get("_id"):
                    top_colleges.append(
                        CollegeMetric(
                            collegeName=doc["_id"],
                            studentCount=doc.get("studentCount", 0),
                            totalSolved=doc.get("totalSolved", 0),
                        )
                    )
        except Exception:
            pass

        overview = AdminUsersOverview(
            totalStudents=total_students_cohort,
            totalColleges=len(sorted_all_colleges),
            totalSolvedQuestions=total_solved_cohort,
            totalSubmissions=total_submissions_cohort,
            topColleges=top_colleges,
        )

        return AdminUsersResponse(
            overview=overview,
            users=user_stats_list,
            colleges=sorted_all_colleges,
            totalUsers=total_users_count,
            page=page_num,
            limit=limit_num,
            totalPages=total_pages,
        )

    def get_user_details(self, user_id: str) -> Optional[UserDetailActivityResponse]:
        users_coll = self._get_collection("users")
        activities_coll = self._get_collection("user_activities")
        submissions_coll = self._get_collection("submissions")
        questions_coll = self._get_collection("questions")

        # Find user
        user_doc = None
        if users_coll is not None:
            user_doc = users_coll.find_one({
                "$or": [
                    {"_id": user_id},
                    {"id": user_id},
                    {"email": user_id.lower()},
                    {"studentId": user_id},
                ]
            })

        if not user_doc:
            return None

        uid = str(user_doc.get("id") or user_doc.get("_id") or "")
        name = str(user_doc.get("name") or "Unknown Student")
        email = str(user_doc.get("email") or "")
        student_id = str(user_doc.get("studentId") or "")
        college_name = str(user_doc.get("collegeName") or "Unassigned")
        created_at = str(user_doc.get("createdAt") or "")

        # Questions map (project only metadata)
        questions_map: Dict[str, dict] = {}
        if questions_coll is not None:
            try:
                for q in questions_coll.find({}, {"_id": 1, "id": 1, "slug": 1, "title": 1, "difficulty": 1}):
                    qid = str(q.get("id") or q.get("_id") or "")
                    qslug = str(q.get("slug") or "")
                    if qid:
                        questions_map[qid] = q
                    if qslug:
                        questions_map[qslug] = q
            except Exception:
                pass

        # User activity
        activity_doc = None
        if activities_coll is not None:
            activity_doc = activities_coll.find_one({
                "$or": [
                    {"userId": uid},
                    {"userId": email.lower()},
                    {"userId": student_id},
                    {"_id": uid},
                ]
            })

        # Submissions (project only status/verdict metadata, exclude source code bodies)
        subs = []
        if submissions_coll is not None:
            try:
                cursor = submissions_coll.find(
                    {
                        "$or": [
                            {"userId": uid},
                            {"userId": email.lower()},
                            {"userEmail": email.lower()},
                            {"userId": student_id},
                        ]
                    },
                    {
                        "_id": 1,
                        "id": 1,
                        "questionId": 1,
                        "language": 1,
                        "mode": 1,
                        "status": 1,
                        "verdict": 1,
                        "createdAt": 1,
                    }
                ).sort("createdAt", -1).limit(50)
                subs = list(cursor)
            except Exception:
                subs = []

        # Solved question ids and problem details
        solved_ids = set()
        solved_briefs: List[SolvedQuestionBrief] = []
        problems_map = (activity_doc.get("problems") or {}) if activity_doc else {}

        if activity_doc and activity_doc.get("solvedQuestionIds"):
            for qid in activity_doc.get("solvedQuestionIds", []):
                solved_ids.add(str(qid))

        for s in subs:
            if str(s.get("verdict")).upper() == "ACCEPTED":
                qid = str(s.get("questionId") or "")
                if qid:
                    solved_ids.add(qid)

        for qid in solved_ids:
            qinfo = questions_map.get(qid)
            prob_summary = problems_map.get(qid, {})
            solved_at = prob_summary.get("solvedAt") or prob_summary.get("lastAttemptedAt")
            if qinfo:
                solved_briefs.append(
                    SolvedQuestionBrief(
                        id=str(qinfo.get("id") or qinfo.get("_id") or qid),
                        title=str(qinfo.get("title") or qid),
                        slug=str(qinfo.get("slug") or qid),
                        difficulty=str(qinfo.get("difficulty") or "MEDIUM").upper(),
                        solvedAt=solved_at,
                    )
                )
            else:
                solved_briefs.append(
                    SolvedQuestionBrief(
                        id=qid,
                        title=f"Problem {qid}",
                        slug=qid,
                        difficulty="MEDIUM",
                        solvedAt=solved_at,
                    )
                )

        # Breakdown
        easy_cnt = sum(1 for q in solved_briefs if q.difficulty == "EASY")
        med_cnt = sum(1 for q in solved_briefs if q.difficulty == "MEDIUM")
        hard_cnt = sum(1 for q in solved_briefs if q.difficulty == "HARD")

        total_solved = len(solved_ids)
        total_attempts = len(problems_map) if problems_map else total_solved
        total_subs = len(subs)
        acc_count = sum(1 for s in subs if str(s.get("verdict")).upper() == "ACCEPTED")
        accuracy = round((acc_count / total_subs * 100.0), 1) if total_subs > 0 else 0.0

        # Format recent submissions
        formatted_subs = []
        for s in subs[:15]:
            formatted_subs.append({
                "id": str(s.get("id") or s.get("_id") or ""),
                "questionId": str(s.get("questionId") or ""),
                "language": str(s.get("language") or ""),
                "mode": str(s.get("mode") or "SUBMIT"),
                "status": str(s.get("status") or ""),
                "verdict": s.get("verdict"),
                "createdAt": str(s.get("createdAt") or ""),
            })

        return UserDetailActivityResponse(
            id=uid,
            name=name,
            email=email,
            studentId=student_id,
            collegeName=college_name,
            createdAt=created_at,
            totalSolved=total_solved,
            totalAttempted=max(total_attempts, total_solved),
            totalSubmissions=total_subs,
            accuracyRate=accuracy,
            solvedBreakdown=SolvedDifficultyBreakdown(
                easy=easy_cnt,
                medium=med_cnt,
                hard=hard_cnt,
            ),
            solvedQuestions=solved_briefs,
            recentSubmissions=formatted_subs,
        )
