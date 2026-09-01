"""
Admin Creation Script for PrepCV
================================
Run this script to create a new admin user or promote an existing user to admin.

Usage:
    cd backend
    python create_admin.py

The script will prompt for email and password interactively.
"""

import asyncio
import sys
import getpass

# Ensure the app package is importable
sys.path.insert(0, ".")

from sqlalchemy import select, text
from app.database.session import get_engine, get_session_factory
from app.database.models import Base, User
from app.core.security import hash_password


async def main():
    print("\n" + "=" * 50)
    print("  PrepCV — Admin User Creation")
    print("=" * 50 + "\n")

    email = input("Enter admin email: ").strip().lower()
    if not email or "@" not in email:
        print("❌ Invalid email address.")
        return

    engine = get_engine()

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;"))

    factory = get_session_factory()
    async with factory() as session:
        # Check if user already exists
        result = await session.execute(select(User).where(User.email == email))
        existing_user = result.scalars().first()

        if existing_user:
            if existing_user.role == "admin":
                print(f"\n✅ User '{email}' is already an admin.")
                return

            confirm = input(f"\nUser '{email}' already exists (role: {existing_user.role}). Promote to admin? [y/N]: ").strip().lower()
            if confirm != "y":
                print("Cancelled.")
                return

            existing_user.role = "admin"
            existing_user.is_active = True
            await session.commit()
            print(f"\n✅ User '{email}' has been promoted to admin!")
        else:
            full_name = input("Enter admin full name: ").strip()
            if not full_name or len(full_name) < 2:
                print("❌ Full name must be at least 2 characters.")
                return

            password = getpass.getpass("Enter admin password (min 8 chars): ")
            if len(password) < 8:
                print("❌ Password must be at least 8 characters.")
                return

            password_confirm = getpass.getpass("Confirm password: ")
            if password != password_confirm:
                print("❌ Passwords do not match.")
                return

            new_admin = User(
                full_name=full_name,
                email=email,
                hashed_password=hash_password(password),
                role="admin",
                is_active=True,
            )
            session.add(new_admin)
            await session.commit()
            print(f"\n✅ Admin user '{email}' created successfully!")

    print(f"\nYou can now log in at the regular login page.")
    print(f"Admin users are automatically redirected to the admin panel.\n")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
