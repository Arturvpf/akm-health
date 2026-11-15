"""Read-only ordering of the persisted pending agenda; never invokes rules."""

from datetime import datetime, timezone

from sqlmodel import Session, select

from .investigations import stored_document
from .models import Followup, Investigation


def pending_followups(session: Session, astronaut_id: str | None = None) -> list[Followup]:
    statement = select(Followup).where(Followup.status == "pending")
    if astronaut_id is not None:
        statement = statement.where(Followup.astronaut_id == astronaut_id)
    rows = session.exec(statement).all()
    # Existing unclassified checks keep their immediate/dated semantics.
    ranks = {row.id: 1 if row.due_at is None else 2 for row in rows}
    for analysis in session.exec(select(Investigation)):
        try:
            result, audit = stored_document(analysis)
        except (ValueError, KeyError, TypeError):
            continue
        if result.followup_id in ranks:
            protocol = audit.get("settings", {}).get("protocol")
            rank = 0 if protocol and protocol.get("validated") is True else 1
            ranks[result.followup_id] = min(ranks[result.followup_id], rank)
    maximum = datetime.max.replace(tzinfo=timezone.utc)
    return sorted(rows, key=lambda row: (ranks[row.id], row.due_at or maximum, row.created_at, row.id))
