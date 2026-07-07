"""
Phone number -> landId resolver.

The config map (PHONE_LAND_MAP) is the primary demo path — it guarantees the
whitelisted-tester demo works without a live DB. The read-only DB query is the
general path; its schema names have been confirmed against src/migrations/
(TypeORM: singular "land"/"user" tables, "ownerId" FK). The query never writes
and never raises.
"""
import os
import json

# {"923xxxxxxxxx": "land-uuid"} — primary, demo-safe path.
_MAP = json.loads(os.getenv("PHONE_LAND_MAP", "{}") or "{}")


def resolve_land_id(phone: str) -> str | None:
    """Return the landId for a phone number, or None if unmapped/unknown."""
    p = (phone or "").strip().lstrip("+")
    if p in _MAP:
        return _MAP[p]
    return _query_db(p)


def _query_db(phone: str) -> str | None:
    """Read-only DB lookup. Never raises, never writes; returns None on any issue."""
    if not os.getenv("DATABASE_URL"):
        return None
    try:
        import psycopg

        with psycopg.connect(os.getenv("DATABASE_URL")) as conn:
            with conn.cursor() as cur:
                # Schema confirmed from src/migrations/001_migration_core_Tables.ts:
                # tables are singular "land"/"user" ("user" is a reserved word ->
                # must stay double-quoted); FK column is land."ownerId"; phone is
                # user.phone_number.
                cur.execute(
                    'SELECT l.id::text FROM "land" l '
                    'JOIN "user" u ON u.id = l."ownerId" '
                    "WHERE u.phone_number = %s LIMIT 1",
                    (phone,),
                )
                row = cur.fetchone()
                return row[0] if row else None
    except Exception as exc:
        print(f"[resolver] db lookup failed (falling back to None): {exc}")
        return None
