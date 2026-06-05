import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from app.database import get_db
from app.auth import get_current_user, log_activity
from app.executor import execute_code_with_input
from app.models import (
    ChallengeResponse,
    ChallengeSubmitRequest,
    ChallengeSubmitResponse,
    ChallengeRunResponse,
    ChallengeRunResult,
    TestCaseResult,
    ChallengeSubmissionResponse,
    LeaderboardResponse,
    LeaderboardEntry,
    ChallengeProgressResponse,
    AchievementResponse
)

router = APIRouter(prefix="/challenges", tags=["challenges"])

# --- Helper Utilities ---

def serialize_challenge(ch: dict) -> dict:
    ch["id"] = str(ch["_id"])
    ch.pop("_id", None)
    ch.pop("hidden_test_cases", None)
    return ch

def serialize_submission(sub: dict) -> dict:
    sub["id"] = str(sub["_id"])
    sub.pop("_id", None)
    return sub

def normalize_output(text: str) -> str:
    if not text:
        return ""
    # Strip carriage returns, collapse all whitespace/newlines into a single space, trim margins
    cleaned = text.replace('\r', '')
    return re.sub(r'\s+', ' ', cleaned).strip()

# --- Achievement Trigger Helper ---

async def unlock_achievement(db, user_id: str, badge: str):
    existing = await db.user_achievements.find_one({"user_id": user_id, "achievement_type": badge})
    if not existing:
        await db.user_achievements.insert_one({
            "user_id": user_id,
            "achievement_type": badge,
            "unlocked_at": datetime.utcnow()
        })
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        email = user.get("email") if user else None
        await log_activity(
            user_id=user_id,
            email=email,
            action="achievement_unlocked",
            details=f"Unlocked achievement: {badge}"
        )

async def check_and_trigger_achievements(db, user_id: str, language: str, difficulty: str):
    # 1. FIRST_SUBMISSION
    total_subs = await db.challenge_submissions.count_documents({"user_id": user_id})
    if total_subs == 1:
        await unlock_achievement(db, user_id, "FIRST_SUBMISSION")

    # 2. Unique Solves
    solved_challenges = await db.user_challenge_progress.distinct("challenge_id", {"user_id": user_id, "solved": True})
    solved_count = len(solved_challenges)

    if solved_count >= 1:
        await unlock_achievement(db, user_id, "FIRST_SOLVE")
    if solved_count >= 10:
        await unlock_achievement(db, user_id, "10_CHALLENGES_SOLVED")

    # 3. Hard Solve
    if difficulty == "Hard" and solved_count >= 1:
        # Verify they actually solved *this* Hard challenge or another Hard challenge
        user_hard_solved = await db.user_challenge_progress.count_documents({
            "user_id": user_id,
            "solved": True,
            "challenge_id": {"$in": [str(c["_id"]) for c in await db.coding_challenges.find({"difficulty": "Hard"}).to_list(100)]}
        })
        if user_hard_solved >= 1:
            await unlock_achievement(db, user_id, "FIRST_HARD_SOLVE")

    # 4. Points Check
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total_score": {"$sum": "$best_score"}}}
    ]
    res = await db.user_challenge_progress.aggregate(pipeline).to_list(1)
    total_score = res[0]["total_score"] if res else 0.0

    if total_score >= 100:
        await unlock_achievement(db, user_id, "POINTS_100")
    if total_score >= 500:
        await unlock_achievement(db, user_id, "POINTS_500")
    if total_score >= 1000:
        await unlock_achievement(db, user_id, "POINTS_1000")

    # 5. Language Master (5 solved challenges in Python/JS/etc)
    pipeline_lang = [
        {"$match": {"user_id": user_id, "language": language, "status": "PASSED"}},
        {"$group": {"_id": "$challenge_id"}},
        {"$count": "count"}
    ]
    res_lang = await db.challenge_submissions.aggregate(pipeline_lang).to_list(1)
    lang_count = res_lang[0]["count"] if res_lang else 0

    if lang_count >= 5:
        achievement_map = {
            "python": "PYTHON_MASTER",
            "javascript": "JAVASCRIPT_MASTER",
            "c": "C_MASTER",
            "cpp": "CPP_MASTER",
            "java": "JAVA_MASTER"
        }
        badge = achievement_map.get(language.lower())
        if badge:
            await unlock_achievement(db, user_id, badge)

# --- Routes Implementation ---

@router.get("", response_model=List[ChallengeResponse])
async def list_challenges(
    language: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db=Depends(get_db)
):
    query = {"status": "active"}
    if language:
        query["supported_languages"] = language.lower()
    if difficulty:
        query["difficulty"] = difficulty
    if category:
        query["category"] = category

    cursor = db.coding_challenges.find(query).sort("created_at", -1)
    challenges = await cursor.to_list(length=100)
    return [serialize_challenge(ch) for ch in challenges]

@router.get("/my-submissions", response_model=List[ChallengeSubmissionResponse])
async def get_my_submissions(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    cursor = db.challenge_submissions.find({"user_id": current_user["id"]}).sort("submitted_at", -1)
    submissions = await cursor.to_list(length=100)
    return [serialize_submission(sub) for sub in submissions]

@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(db=Depends(get_db)):
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "total_score": {"$sum": "$best_score"},
            "solved_challenges": {"$sum": {"$cond": ["$solved", 1, 0]}}
        }},
        {"$lookup": {
            "from": "users",
            "let": {"uid": "$_id"},
            "pipeline": [
                {"$match": {"$expr": {"$eq": ["$_id", {"$toObjectId": "$$uid"}]}}}
            ],
            "as": "user_info"
        }},
        {"$unwind": "$user_info"},
        {"$project": {
            "user_id": "$_id",
            "username": "$user_info.name",
            "email": "$user_info.email",
            "total_score": 1,
            "solved_challenges": 1
        }},
        {"$sort": {"total_score": -1, "solved_challenges": -1}},
        {"$limit": 100}
    ]
    rankings = await db.user_challenge_progress.aggregate(pipeline).to_list(100)
    
    leaderboard = [
        LeaderboardEntry(
            user_id=r["user_id"],
            username=r["username"],
            email=r["email"],
            total_score=float(r["total_score"]),
            solved_challenges=int(r["solved_challenges"])
        )
        for r in rankings
    ]
    return LeaderboardResponse(leaderboard=leaderboard)

@router.get("/progress", response_model=ChallengeProgressResponse)
async def get_my_progress(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_id = current_user["id"]
    
    total_challenges = await db.coding_challenges.count_documents({"status": "active"})
    total_solved = await db.user_challenge_progress.count_documents({"user_id": user_id, "solved": True})
    
    # Break down counts by difficulty
    easy_solved = await db.user_challenge_progress.count_documents({
        "user_id": user_id,
        "solved": True,
        "challenge_id": {"$in": [str(c["_id"]) for c in await db.coding_challenges.find({"difficulty": "Easy", "status": "active"}).to_list(100)]}
    })
    medium_solved = await db.user_challenge_progress.count_documents({
        "user_id": user_id,
        "solved": True,
        "challenge_id": {"$in": [str(c["_id"]) for c in await db.coding_challenges.find({"difficulty": "Medium", "status": "active"}).to_list(100)]}
    })
    hard_solved = await db.user_challenge_progress.count_documents({
        "user_id": user_id,
        "solved": True,
        "challenge_id": {"$in": [str(c["_id"]) for c in await db.coding_challenges.find({"difficulty": "Hard", "status": "active"}).to_list(100)]}
    })

    # Total Score
    pipeline_score = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total_score": {"$sum": "$best_score"}}}
    ]
    res_score = await db.user_challenge_progress.aggregate(pipeline_score).to_list(1)
    total_score = float(res_score[0]["total_score"]) if res_score else 0.0

    # Submission success rate
    total_subs = await db.challenge_submissions.count_documents({"user_id": user_id})
    passed_subs = await db.challenge_submissions.count_documents({"user_id": user_id, "status": "PASSED"})
    success_rate = (passed_subs / total_subs * 100) if total_subs > 0 else 0.0

    # Best Language
    pipeline_lang = [
        {"$match": {"user_id": user_id, "status": "PASSED"}},
        {"$group": {"_id": {"language": "$language", "challenge_id": "$challenge_id"}}},
        {"$group": {"_id": "$_id.language", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]
    res_lang = await db.challenge_submissions.aggregate(pipeline_lang).to_list(1)
    best_language = res_lang[0]["_id"].capitalize() if res_lang else "None"

    # Global Rank
    pipeline_leaderboard = [
        {"$group": {
            "_id": "$user_id",
            "total_score": {"$sum": "$best_score"},
            "solved_challenges": {"$sum": {"$cond": ["$solved", 1, 0]}}
        }},
        {"$sort": {"total_score": -1, "solved_challenges": -1}}
    ]
    rankings = await db.user_challenge_progress.aggregate(pipeline_leaderboard).to_list(100000)
    global_rank = 0
    for idx, r in enumerate(rankings):
        if r["_id"] == user_id:
            global_rank = idx + 1
            break
    if global_rank == 0:
        global_rank = len(rankings) + 1

    # Achievements List
    cursor_ach = db.user_achievements.find({"user_id": user_id}).sort("unlocked_at", -1)
    achievements = await cursor_ach.to_list(length=100)
    ach_list = [
        AchievementResponse(
            achievement_type=a["achievement_type"],
            unlocked_at=a["unlocked_at"]
        )
        for a in achievements
    ]

    return ChallengeProgressResponse(
        total_challenges=total_challenges,
        total_solved=total_solved,
        easy_solved=easy_solved,
        medium_solved=medium_solved,
        hard_solved=hard_solved,
        total_score=total_score,
        success_rate=success_rate,
        best_language=best_language,
        global_rank=global_rank,
        achievements=ach_list
    )

@router.get("/{id}", response_model=ChallengeResponse)
async def get_challenge(id: str, db=Depends(get_db)):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid challenge ID format")
    ch = await db.coding_challenges.find_one({"_id": ObjectId(id), "status": "active"})
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found or inactive")
    return serialize_challenge(ch)

@router.post("/{id}/run", response_model=ChallengeRunResponse)
async def run_challenge_solution(
    id: str,
    payload: ChallengeSubmitRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid challenge ID format")
    
    ch = await db.coding_challenges.find_one({"_id": ObjectId(id), "status": "active"})
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found or inactive")

    if payload.language.lower() not in [l.lower() for l in ch.get("supported_languages", [])]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{payload.language}' is not supported for this challenge."
        )

    lang_info = await db.supported_languages.find_one({"name": payload.language.lower()})
    if not lang_info or not lang_info.get("enabled", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Language disabled or unsupported by environment.")

    results = []
    success = True

    for test_case in ch.get("sample_test_cases", []):
        exec_res = await execute_code_with_input(lang_info, payload.source_code, test_case["input"])
        
        normalized_actual = normalize_output(exec_res.get("output", ""))
        normalized_expected = normalize_output(test_case["expected_output"])
        
        passed = exec_res.get("success", False) and (normalized_actual == normalized_expected)
        if not passed:
            success = False

        results.append(
            ChallengeRunResult(
                passed=passed,
                input=test_case["input"],
                expected_output=test_case["expected_output"],
                actual_output=exec_res.get("output", "") if exec_res.get("success") else "",
                execution_time_ms=exec_res.get("execution_time", 0.0) * 1000,
                error=exec_res.get("error") if not exec_res.get("success") else None
            )
        )

    return ChallengeRunResponse(success=success, results=results)

@router.post("/{id}/submit", response_model=ChallengeSubmitResponse)
async def submit_challenge_solution(
    id: str,
    payload: ChallengeSubmitRequest,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid challenge ID format")

    user_id = current_user["id"]

    # 1. Anti-Cheat: Max 10 submissions per user per minute
    one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
    recent_submissions_count = await db.challenge_submissions.count_documents({
        "user_id": user_id,
        "submitted_at": {"$gte": one_minute_ago}
    })
    if recent_submissions_count >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. You can submit up to 10 solutions per minute."
        )

    ch = await db.coding_challenges.find_one({"_id": ObjectId(id), "status": "active"})
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found or inactive")

    if payload.language.lower() not in [l.lower() for l in ch.get("supported_languages", [])]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{payload.language}' is not supported for this challenge."
        )

    lang_info = await db.supported_languages.find_one({"name": payload.language.lower()})
    if not lang_info or not lang_info.get("enabled", False):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Language disabled or unsupported by environment.")

    # 2. Validate code size
    code_bytes = len(payload.source_code.encode("utf-8"))
    if code_bytes > 100000:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source code size exceeds limit of 100KB.")

    passed_test_cases = 0
    test_case_results = []
    total_execution_time = 0.0

    hidden_test_cases = ch.get("hidden_test_cases", [])
    total_test_cases = len(hidden_test_cases)

    for tc in hidden_test_cases:
        exec_res = await execute_code_with_input(lang_info, payload.source_code, tc["input"])
        
        normalized_actual = normalize_output(exec_res.get("output", ""))
        normalized_expected = normalize_output(tc["expected_output"])
        
        passed = exec_res.get("success", False) and (normalized_actual == normalized_expected)
        if passed:
            passed_test_cases += 1

        exec_time_ms = exec_res.get("execution_time", 0.0) * 1000
        total_execution_time += exec_time_ms

        test_case_results.append(
            TestCaseResult(
                passed=passed,
                execution_time_ms=exec_time_ms,
                error=exec_res.get("error") if not exec_res.get("success") else None
            )
        )

    score = (passed_test_cases / total_test_cases * ch.get("points", 100)) if total_test_cases > 0 else 0.0
    status_str = "PASSED" if passed_test_cases == total_test_cases else "FAILED"

    # Save to challenge_submissions
    submission_doc = {
        "user_id": user_id,
        "challenge_id": id,
        "challenge_version": ch.get("version", 1),
        "language": payload.language.lower(),
        "source_code": payload.source_code,
        "code_size": code_bytes,
        "passed_test_cases": passed_test_cases,
        "total_test_cases": total_test_cases,
        "test_case_results": [t.dict() for t in test_case_results],
        "status": status_str,
        "score": score,
        "execution_time_ms": total_execution_time,
        "submitted_at": datetime.utcnow()
    }
    await db.challenge_submissions.insert_one(submission_doc)

    # Update challenge global success rate statistics
    total_challenges_subs = ch.get("total_submissions", 0) + 1
    total_challenges_solves = ch.get("total_solves", 0) + (1 if status_str == "PASSED" else 0)
    success_rate = (total_challenges_solves / total_challenges_subs * 100)

    await db.coding_challenges.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "total_submissions": total_challenges_subs,
            "total_solves": total_challenges_solves,
            "success_rate": success_rate
        }}
    )

    # Update user progress
    progress_query = {"user_id": user_id, "challenge_id": id}
    progress = await db.user_challenge_progress.find_one(progress_query)
    
    if not progress:
        await db.user_challenge_progress.insert_one({
            "user_id": user_id,
            "challenge_id": id,
            "solved": status_str == "PASSED",
            "best_score": score,
            "attempts": 1,
            "first_solved_at": datetime.utcnow() if status_str == "PASSED" else None
        })
    else:
        update_fields = {
            "attempts": progress.get("attempts", 0) + 1
        }
        if score > progress.get("best_score", 0):
            update_fields["best_score"] = score
        if status_str == "PASSED" and not progress.get("solved", False):
            update_fields["solved"] = True
            update_fields["first_solved_at"] = datetime.utcnow()
            
        await db.user_challenge_progress.update_one(progress_query, {"$set": update_fields})

    # Trigger achievements update
    await check_and_trigger_achievements(db, user_id, payload.language, ch.get("difficulty", "Easy"))

    # Log activities
    await log_activity(
        user_id=user_id,
        email=current_user["email"],
        action="challenge_submitted",
        details=f"Submitted {payload.language} code for challenge: {ch.get('title')} (Passed: {passed_test_cases}/{total_test_cases})"
    )
    if status_str == "PASSED":
        await log_activity(
            user_id=user_id,
            email=current_user["email"],
            action="challenge_completed",
            details=f"Successfully solved challenge: {ch.get('title')} using {payload.language}"
        )

    return ChallengeSubmitResponse(
        passed=(status_str == "PASSED"),
        passed_test_cases=passed_test_cases,
        total_test_cases=total_test_cases,
        score=score,
        test_case_results=test_case_results
    )
