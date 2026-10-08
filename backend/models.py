from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


SkillName = Annotated[str, Field(min_length=1, max_length=100)]
PlanStep = Annotated[str, Field(min_length=1, max_length=300)]


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class SkillEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    skill: str = Field(min_length=1, max_length=100)
    level: int = Field(ge=1, le=5)
    years: float = Field(ge=0, le=60)


class PlanEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    skill: str = Field(min_length=1, max_length=100)
    done: bool
    targetDate: str | None = Field(default=None, max_length=10)

    @field_validator("targetDate")
    @classmethod
    def validate_target_date(cls, value: str | None) -> str | None:
        if value:
            date.fromisoformat(value)
        return value


class ExtractedSkill(BaseModel):
    model_config = ConfigDict(extra="ignore")

    skill: str = Field(min_length=1, max_length=100)
    category: str = Field(max_length=100)
    mentions: float = Field(ge=0)
    inRequiredSection: bool = False
    inOptionalSection: bool = False
    inTitle: bool = False
    weight: float = Field(ge=0)
    yearsRequired: float = Field(ge=0)
    learningHours: float = Field(ge=0)
    related: list[str] = Field(default_factory=list, max_length=100)
    resources: list[str] = Field(default_factory=list, max_length=100)


class AnalysisEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=100)
    date: str = Field(min_length=1, max_length=50)
    jobTitle: str = Field(default="", max_length=200)
    company: str = Field(default="", max_length=200)
    score: int | None = Field(default=None, ge=0, le=100)
    matched: list[str] = Field(default_factory=list, max_length=100)
    partial: list[str] = Field(default_factory=list, max_length=100)
    gaps: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    jdText: str = Field(max_length=50_000)
    extracted: list[ExtractedSkill] = Field(default_factory=list, max_length=100)
    profileSnapshot: list[SkillEntry] | None = None

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: str) -> str:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value

    @field_validator("gaps")
    @classmethod
    def validate_gaps(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for gap in value:
            if not isinstance(gap.get("skill"), str) or len(gap["skill"]) > 100:
                raise ValueError("Each gap must include a valid skill name.")
            weight = gap.get("weight", 0)
            if not isinstance(weight, (int, float)) or not 0 <= weight <= 10_000:
                raise ValueError("Gap weights must be between 0 and 10000.")
        return value


class AppSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    theme: str = "dark"

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str) -> str:
        if value not in {"dark", "light"}:
            raise ValueError("Theme must be dark or light.")
        return value


class DraftEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    jdText: str = Field(default="", max_length=50_000)
    jobTitle: str = Field(default="", max_length=200)
    company: str = Field(default="", max_length=200)


class AppData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profile: list[SkillEntry] = Field(default_factory=list, max_length=200)
    analyses: list[AnalysisEntry] = Field(default_factory=list, max_length=500)
    plan: list[PlanEntry] = Field(default_factory=list, max_length=200)
    settings: AppSettings = Field(default_factory=AppSettings)
    draft: DraftEntry | None = None

    @model_validator(mode="after")
    def enforce_unique_skills(self) -> "AppData":
        for entries, label in ((self.profile, "profile"), (self.plan, "plan")):
            skills = [entry.skill.casefold() for entry in entries]
            if len(skills) != len(set(skills)):
                raise ValueError(f"Skills in {label} must be unique.")
        return self


class AppDataPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    data: AppData


class AccountResponse(BaseModel):
    id: str
    email: str
    name: str | None = None
    provider: str


class InsightsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    jobTitle: str = Field(default="", max_length=200)
    score: int | None = Field(default=None, ge=0, le=100)
    matched: list[SkillName] = Field(default_factory=list, max_length=100)
    partial: list[SkillName] = Field(default_factory=list, max_length=100)
    gaps: list[SkillName] = Field(default_factory=list, max_length=100)
    profile: list[SkillEntry] = Field(default_factory=list, max_length=200)


class InsightRecommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skill: str = Field(min_length=1, max_length=100)
    action: str = Field(min_length=1, max_length=500)


class AIInsights(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=1200)
    recommendations: list[InsightRecommendation] = Field(default_factory=list, max_length=5)
    first_week_plan: list[PlanStep] = Field(default_factory=list, max_length=5)
