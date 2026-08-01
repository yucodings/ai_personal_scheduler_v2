from copy import deepcopy

from backend.project_service import ProjectService
from backend.schemas import TaskInput
from backend.task_service import TaskService


class FakeMutationDatabase:
    def __init__(self):
        self.table_calls = []
        self.rpc_calls = []

    def table(self, table, method="GET", params=None, data=None, **_kwargs):
        self.table_calls.append((table, method, deepcopy(params), deepcopy(data)))
        return [{"id": "record-1", **deepcopy(data or {})}]

    def rpc(self, name, payload):
        self.rpc_calls.append((name, deepcopy(payload)))
        return {}


def test_project_edit_supports_type_and_archiving_removes_active_context():
    database = FakeMutationDatabase()

    result = ProjectService(database).update("project-1", {
        "title": "Digital Entrepreneurship",
        "project_type": "subject",
        "status": "archived",
    })

    assert result["project_type"] == "subject"
    assert result["is_active_context"] is False
    assert database.table_calls[-1][3] == {
        "title": "Digital Entrepreneurship",
        "project_type": "subject",
        "status": "archived",
        "is_active_context": False,
    }


def test_manual_task_creation_recalculates_project_progress():
    database = FakeMutationDatabase()
    task = TaskInput.model_validate({
        "project_id": "11111111-1111-4111-8111-111111111111",
        "title": "Draft business model canvas",
        "description": "Complete the first canvas draft.",
        "priority": "high",
        "estimated_hours": 3,
        "effort_weight": 2,
        "planned_start": "2026-08-03",
        "due_date": "2026-08-05",
        "sequence": 1,
    })

    created = TaskService(database).create(task)

    assert created["title"] == "Draft business model canvas"
    assert database.rpc_calls == [(
        "recalculate_project_progress",
        {"p_project_id": "11111111-1111-4111-8111-111111111111"},
    )]
