from __future__ import annotations
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from app.admin.models import (
    AdminUsersResponse,
    AdminUsersOverview,
    UserAdminStats,
    SolvedDifficultyBreakdown,
    CollegeMetric,
    SolvedQuestionBrief,
    UserDetailActivityResponse,
)


class AdminService:
    def __init__(self, db):
        self.db = db
        self._memory_admins: set[str] = set()

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

        # In-memory test fallback
        if clean_email in self._memory_admins:
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
    ) -> AdminUsersResponse:
        users_coll = self._get_collection("users")
        activities_coll = self._get_collection("user_activities")
        submissions_coll = self._get_collection("submissions")
        questions_coll = self._get_collection("questions")

        # 1. Fetch questions catalog for difficulty mappings
        questions_map: Dict[str, dict] = {}
        if questions_coll is not None:
            try:
                for q in questions_coll.find({}):
                    qid = str(q.get("id") or q.get("_id") or "")
                    qslug = str(q.get("slug") or "")
                    if qid:
                        questions_map[qid] = q
                    if qslug:
                        questions_map[qslug] = q
            except Exception:
                pass

        # 2. Fetch all users
        all_user_docs = []
        if users_coll is not None:
            try:
                all_user_docs = list(users_coll.find({}))
            except Exception:
                all_user_docs = []

        # Collect all unique colleges across the whole cohort
        all_colleges_set = set()
        for u in all_user_docs:
            c = (u.get("collegeName") or "").strip()
            if c:
                all_colleges_set.add(c)
        sorted_all_colleges = sorted(list(all_colleges_set), key=lambda s: s.lower())

        # 3. Fetch all user activities indexed by user identifiers
        activities_by_user: Dict[str, dict] = {}
        if activities_coll is not None:
            try:
                for act in activities_coll.find({}):
                    uid = str(act.get("userId") or act.get("id") or act.get("_id") or "")
                    if uid:
                        activities_by_user[uid] = act
            except Exception:
                pass

        # 4. Fetch submissions indexed by userId/userEmail for verification and metrics
        user_submissions_map: Dict[str, List[dict]] = {}
        if submissions_coll is not None:
            try:
                for sub in submissions_coll.find({}):
                    uid = str(sub.get("userId") or "")
                    uem = str(sub.get("userEmail") or "").strip().lower()
                    if uid:
                        user_submissions_map.setdefault(uid, []).append(sub)
                    if uem and uem != uid:
                        user_submissions_map.setdefault(uem, []).append(sub)
            except Exception:
                pass

        user_stats_list: List[UserAdminStats] = []
        total_questions_solved_sum = 0
        total_submissions_sum = 0
        college_solved_tracker: Dict[str, int] = {}
        college_student_tracker: Dict[str, int] = {}

        for u in all_user_docs:
            uid = str(u.get("id") or u.get("_id") or "")
            name = str(u.get("name") or "Unknown Student").strip()
            email = str(u.get("email") or "").strip()
            student_id = str(u.get("studentId") or "").strip()
            college_name = str(u.get("collegeName") or "Unassigned College").strip()
            created_at = str(u.get("createdAt") or "")

            # College stats
            college_student_tracker[college_name] = college_student_tracker.get(college_name, 0) + 1

            # Find matching activity doc
            activity_doc = None
            for key in [uid, email.lower(), student_id]:
                if key and key in activities_by_user:
                    activity_doc = activities_by_user[key]
                    break

            # Find submissions
            user_subs = []
            for key in [uid, email.lower(), student_id]:
                if key and key in user_submissions_map:
                    user_subs.extend(user_submissions_map[key])

            # Deduplicate submissions by id
            seen_sub_ids = set()
            unique_subs = []
            for s in user_subs:
                sid = str(s.get("id") or s.get("_id") or "")
                if sid and sid not in seen_sub_ids:
                    seen_sub_ids.add(sid)
                    unique_subs.append(s)

            # Determine solved question IDs
            solved_qids_set = set()
            if activity_doc and activity_doc.get("solvedQuestionIds"):
                for qid in activity_doc.get("solvedQuestionIds", []):
                    solved_qids_set.add(str(qid))

            for s in unique_subs:
                if str(s.get("verdict")).upper() == "ACCEPTED":
                    qid = str(s.get("questionId") or "")
                    if qid:
                        solved_qids_set.add(qid)

            # Determine attempted question IDs
            attempted_qids_set = set(solved_qids_set)
            if activity_doc and activity_doc.get("attemptedQuestionIds"):
                for qid in activity_doc.get("attemptedQuestionIds", []):
                    attempted_qids_set.add(str(qid))

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

            total_solved = len(solved_qids_set)
            total_attempted = len(attempted_qids_set)
            total_subs_count = len(unique_subs)

            # Accuracy rate calculation
            accepted_subs_count = sum(1 for s in unique_subs if str(s.get("verdict")).upper() == "ACCEPTED")
            if total_subs_count > 0:
                accuracy = round((accepted_subs_count / total_subs_count) * 100.0, 1)
            elif total_solved > 0:
                accuracy = 100.0
            else:
                accuracy = 0.0

            # Last active time
            timestamps = []
            if activity_doc and activity_doc.get("updatedAt"):
                timestamps.append(str(activity_doc["updatedAt"]))
            for s in unique_subs:
                if s.get("createdAt"):
                    timestamps.append(str(s["createdAt"]))
            if created_at:
                timestamps.append(created_at)

            last_active = max(timestamps) if timestamps else created_at or None

            total_questions_solved_sum += total_solved
            total_submissions_sum += total_subs_count
            college_solved_tracker[college_name] = college_solved_tracker.get(college_name, 0) + total_solved

            stats = UserAdminStats(
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
            user_stats_list.append(stats)

        # Overview calculation before applying user filters
        top_colleges: List[CollegeMetric] = []
        for cname, solved_count in sorted(college_solved_tracker.items(), key=lambda item: item[1], reverse=True)[:5]:
            top_colleges.append(
                CollegeMetric(
                    collegeName=cname,
                    studentCount=college_student_tracker.get(cname, 0),
                    totalSolved=solved_count,
                )
            )

        overview = AdminUsersOverview(
            totalStudents=len(all_user_docs),
            totalColleges=len(sorted_all_colleges),
            totalSolvedQuestions=total_questions_solved_sum,
            totalSubmissions=total_submissions_sum,
            topColleges=top_colleges,
        )

        # Filter by college
        filtered_users = user_stats_list
        if college and college.strip() and college.strip().lower() != "all":
            selected_college = college.strip().lower()
            filtered_users = [u for u in filtered_users if u.collegeName.lower() == selected_college]

        # Filter by search
        if search and search.strip():
            sq = search.strip().lower()
            filtered_users = [
                u
                for u in filtered_users
                if sq in u.name.lower()
                or sq in u.email.lower()
                or sq in u.studentId.lower()
                or sq in u.collegeName.lower()
            ]

        # Default sort: by total solved desc, then accuracy desc
        filtered_users.sort(key=lambda u: (u.totalSolved, u.accuracyRate, u.totalSubmissions), reverse=True)

        return AdminUsersResponse(
            overview=overview,
            users=filtered_users,
            colleges=sorted_all_colleges,
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

        # Questions map
        questions_map: Dict[str, dict] = {}
        if questions_coll is not None:
            try:
                for q in questions_coll.find({}):
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

        # Submissions
        subs = []
        if submissions_coll is not None:
            try:
                cursor = submissions_coll.find({
                    "$or": [
                        {"userId": uid},
                        {"userId": email.lower()},
                        {"userEmail": email.lower()},
                        {"userId": student_id},
                    ]
                }).sort("createdAt", -1).limit(50)
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
