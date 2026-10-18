"""CLI utility to safely promote or revoke administrator privileges for an account.

Usage:
    python -m app.cli.make_admin <username>
    python -m app.cli.make_admin <username> --revoke

In Docker:
    docker exec postcraft-backend python -m app.cli.make_admin <username>
"""

import argparse
import asyncio
import sys

from sqlalchemy import select, func
from app.core.database import _session_maker, _engine
from app.models import User, AdminAuditLog


async def toggle_admin(username: str, revoke: bool = False) -> None:
    async with _session_maker() as session:
        stmt = select(User).where(func.lower(User.username) == username.strip().lower())
        result = await session.execute(stmt)
        user = result.scalars().first()

        if not user:
            print(f"ERROR: User '{username}' was not found in the database.", file=sys.stderr)
            sys.exit(1)

        new_status = not revoke
        if user.is_admin == new_status:
            status_str = "already an administrator" if new_status else "already a standard user"
            print(f"NOTICE: User '{username}' is {status_str}. No changes made.")
            return

        user.is_admin = new_status
        session.add(AdminAuditLog(admin_user_id=None, target_user_id=user.id, action="cli_revoked_admin" if revoke else "cli_granted_admin"))
        await session.commit()

        action = "Revoked administrator privileges from" if revoke else "Granted administrator privileges to"
        print(f"SUCCESS: {action} user '{username}' (ID: {user.id}).")

    await _engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Promote or revoke admin privileges for a PostCraft AI user.")
    parser.add_argument("username", help="The username of the account to update")
    parser.add_argument("--revoke", action="store_true", help="Revoke admin privileges instead of granting them")
    args = parser.parse_args()

    asyncio.run(toggle_admin(args.username, revoke=args.revoke))


if __name__ == "__main__":
    main()
