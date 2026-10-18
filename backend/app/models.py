import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Uuid, Integer, JSON, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    __table_args__ = (Index("ix_users_username_normalized", func.lower(username), unique=True),)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True) # nullable for backwards compatibility with sandbox DB
    profile_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    about_me: Mapped[str | None] = mapped_column(Text, nullable=True)
    writing_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms_version: Mapped[str | None] = mapped_column(String(30), nullable=True)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_admin: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    projects: Mapped[list["Project"]] = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    style_profiles: Mapped[list["StyleProfile"]] = relationship("StyleProfile", back_populates="user", cascade="all, delete-orphan")
    preferences: Mapped[list["Preference"]] = relationship("Preference", back_populates="user", cascade="all, delete-orphan")
    resume: Mapped["UserResume | None"] = relationship("UserResume", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    platform: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="projects")
    generations: Mapped[list["Generation"]] = relationship("Generation", back_populates="project", cascade="all, delete-orphan")


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    topic: Mapped[str] = mapped_column(String(255))
    raw_thoughts: Mapped[str] = mapped_column(Text)
    
    # Storing drafts directly in the generation for simplicity as requested
    draft_1: Mapped[str | None] = mapped_column(Text, nullable=True)
    draft_2: Mapped[str | None] = mapped_column(Text, nullable=True)
    draft_3: Mapped[str | None] = mapped_column(Text, nullable=True)
    active_draft_index: Mapped[int] = mapped_column(default=1) # 1, 2, or 3
    
    status: Mapped[str] = mapped_column(String(50), default="generating")
    context_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    original_drafts: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    research_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    quality_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="generations")
    chat_history: Mapped[list["ChatHistory"]] = relationship("ChatHistory", back_populates="generation", cascade="all, delete-orphan")


class StyleProfile(Base):
    __tablename__ = "style_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    platform: Mapped[str] = mapped_column(String(50))
    
    # Extracted pattern attributes
    structure: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone: Mapped[str | None] = mapped_column(Text, nullable=True)
    pacing: Mapped[str | None] = mapped_column(Text, nullable=True)
    storytelling_technique: Mapped[str | None] = mapped_column(Text, nullable=True)
    formatting: Mapped[str | None] = mapped_column(Text, nullable=True)
    cta_style: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="style_profiles")


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    generation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("generations.id"))
    draft_index: Mapped[int | None] = mapped_column(Integer, nullable=True, default=1)
    role: Mapped[str] = mapped_column(String(50)) # 'user' or 'assistant'
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    generation: Mapped["Generation"] = relationship("Generation", back_populates="chat_history")


class Preference(Base):
    __tablename__ = "preferences"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    platform: Mapped[str] = mapped_column(String(50))
    preference_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="preferences")


class ResearchCache(Base):
    """Cache for the Research Tool (Phase 2) to avoid redundant searches."""
    __tablename__ = "research_cache"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(255), index=True)
    platform: Mapped[str] = mapped_column(String(50), index=True)
    results_json: Mapped[str] = mapped_column(Text)  # Storing JSON array of results
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class CostLog(Base):
    __tablename__ = "cost_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    generation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("generations.id"), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    operation: Mapped[str] = mapped_column(String(50)) # e.g., 'pattern_extraction', 'draft_generation', 'quality_check'
    prompt_tokens: Mapped[int] = mapped_column(default=0)
    completion_tokens: Mapped[int] = mapped_column(default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class UserResume(Base):
    """Stores user's uploaded resume (one row per user; re-upload overwrites)."""
    __tablename__ = "user_resumes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    raw_text: Mapped[str] = mapped_column(Text)
    structured_summary: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: {role, industry, expertise_areas[], experience_level}
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship("User", back_populates="resume")


class AdminAuditLog(Base):
    """Access/CLI history; deleted account references are nulled."""
    __tablename__ = "admin_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100))  # e.g. 'viewed_user_generations'
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class VectorDeletionJob(Base):
    """Durable erasure tombstone; deliberately has no FK to the deleted account."""
    __tablename__ = "vector_deletion_jobs"
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

