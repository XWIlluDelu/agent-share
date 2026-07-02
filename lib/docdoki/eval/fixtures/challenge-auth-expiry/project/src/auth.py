from datetime import datetime, timedelta, timezone

TOKEN_TTL_MINUTES = 30


def expires_at(issued_at: datetime) -> datetime:
    return issued_at + timedelta(minutes=TOKEN_TTL_MINUTES)


def is_expired(issued_at: datetime, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    return now >= expires_at(issued_at)


def require_valid_token(issued_at: datetime) -> None:
    if is_expired(issued_at):
        raise PermissionError("token expired")
