from datetime import date, datetime, timezone

import pytest

from backend.auth_service import LoginThrottle, create_session, hash_password, verify_password, verify_session
from backend.config import Settings
from backend.planning_engine import allocate_daily_plan, validate_dependencies
from backend.progress_engine import calculated_progress, expected_progress, snapshot
from backend.risk_engine import assess_risk


def test_password_hash_and_session_round_trip():
    encoded = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", encoded)
    assert not verify_password("wrong password", encoded)
    settings = Settings(jwt_secret="test-secret-at-least-32-characters", session_expiry_hours=2)
    now = datetime.now(timezone.utc)
    token, expires = create_session(settings, now)
    assert verify_session(token, settings)["sub"] == "single-user"
    assert (expires - now).total_seconds() == 7200


def test_login_throttle_applies_cooldown():
    throttle = LoginThrottle(max_attempts=2, window_seconds=100, cooldown_seconds=60)
    assert throttle.allowed("client", 100)[0]
    throttle.failure("client", 100); throttle.failure("client", 101)
    allowed, retry = throttle.allowed("client", 110)
    assert not allowed and retry == 51
    throttle.success("client")
    assert throttle.allowed("client", 111)[0]


def test_weighted_progress_manual_override_and_expected_progress():
    tasks = [
        {"status": "completed", "progress_percent": 100, "effort_weight": 1, "estimated_hours": 2, "planned_start": "2026-07-10", "due_date": "2026-07-12"},
        {"status": "in_progress", "progress_percent": 25, "effort_weight": 3, "estimated_hours": 6, "planned_start": "2026-07-10", "due_date": "2026-07-20"},
        {"status": "cancelled", "progress_percent": 0, "effort_weight": 99, "estimated_hours": 100},
    ]
    assert calculated_progress(tasks) == 43.75
    assert expected_progress(tasks, date(2026, 7, 15)) == 62.5
    value = snapshot(tasks, manual_progress=50, today=date(2026, 7, 15))
    assert value.calculated_progress == 43.75
    assert value.displayed_progress == 50
    assert value.manual_override_active
    assert value.remaining_hours == 4.5


def test_risk_rules_are_deterministic():
    tasks = [{"status": "blocked", "priority": "critical", "due_date": "2026-07-20"}]
    risk = assess_risk(project_status="active", final_deadline=date(2026, 8, 1), displayed_progress=40, expected_progress=45, remaining_hours=20, tasks=tasks, today=date(2026, 7, 19))
    assert risk.status == "blocked"
    delayed = assess_risk(project_status="active", final_deadline=date(2026, 8, 1), displayed_progress=30, expected_progress=52, remaining_hours=20, tasks=[], today=date(2026, 7, 19))
    assert delayed.status == "delayed"


def test_dependency_validation_and_daily_capacity():
    with pytest.raises(ValueError, match="cycle"):
        validate_dependencies([("a", "b"), ("b", "a")])
    tasks = [
        {"id": "a", "title": "Prerequisite", "status": "completed", "priority": "high", "estimated_hours": 1, "progress_percent": 100, "due_date": "2026-07-18", "dependencies": []},
        {"id": "b", "title": "Overdue task", "status": "not_started", "priority": "critical", "estimated_hours": 5, "progress_percent": 0, "due_date": "2026-07-18", "dependencies": ["a"]},
        {"id": "c", "title": "Blocked by b", "status": "not_started", "priority": "high", "estimated_hours": 4, "progress_percent": 0, "due_date": "2026-07-20", "dependencies": ["b"]},
    ]
    plan = allocate_daily_plan(tasks, 3, date(2026, 7, 19))
    assert [item.task_id for item in plan] == ["b"]
    assert sum(item.planned_hours for item in plan) <= 3
