"""Student profile — persistent knowledge tracking across sessions."""
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from config import SESSION_STORAGE_DIR

PROFILE_PATH = SESSION_STORAGE_DIR / "student_profile.json"

MASTERY_LABELS = {"mastered": "✅ 掌握", "weak": "⚠️ 薄弱", "learning": "🔄 学习中", "unlearned": "❌ 未掌握"}
VALID_MASTERY = list(MASTERY_LABELS.keys())


class StudentService:
    def _load(self) -> dict:
        if not PROFILE_PATH.exists():
            return {"concepts": {}, "total_sessions": 0, "total_messages": 0, "updated_at": ""}
        return json.loads(PROFILE_PATH.read_text(encoding="utf-8"))

    def _save(self, profile: dict) -> None:
        profile["updated_at"] = datetime.now().isoformat()
        PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        PROFILE_PATH.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")

    def get_profile(self) -> dict:
        return self._load()

    def _normalize_name(self, n: str) -> str:
        """Normalize concept name for comparison."""
        import re
        n = n.lower().strip()
        n = re.sub(r'[（(][^)）]*[)）]', '', n)  # remove parentheticals
        n = re.sub(r'[^\w一-鿿]', '', n)  # keep only Chinese chars, letters, digits
        return n

    def _find_similar(self, name: str, concepts: dict) -> str | None:
        """Find existing concept that is likely the same as name."""
        name_norm = self._normalize_name(name)
        if len(name_norm) < 2:
            return None
        for key in concepts:
            key_norm = self._normalize_name(key)
            if len(key_norm) < 2:
                continue
            if name_norm == key_norm:
                return key
            # One contains the other (with length check to avoid false matches)
            min_len = min(len(name_norm), len(key_norm))
            if min_len >= 3:
                if name_norm in key_norm or key_norm in name_norm:
                    return key
        return None

    def update_concept(self, concept: str, mastery: str, note: str = "", session_id: str = "") -> dict:
        if mastery not in VALID_MASTERY:
            mastery = "learning"
        profile = self._load()
        # Merge with similar existing concept
        similar = self._find_similar(concept, profile["concepts"])
        if similar and similar != concept:
            existing = profile["concepts"][similar]
            # Keep the more specific name (longer usually)
            if len(concept) > len(similar):
                profile["concepts"][concept] = existing
                del profile["concepts"][similar]
                similar = concept
        else:
            similar = concept
        existing = profile["concepts"].get(similar, {})
        existing["mastery"] = mastery
        existing["last_discussed"] = datetime.now().isoformat()[:10]
        if note:
            existing["note"] = note
        history = existing.get("history", [])
        history.append({
            "mastery": mastery,
            "date": datetime.now().isoformat()[:10],
            "time": datetime.now().isoformat()[:16],
            "session_id": session_id,
        })
        if len(history) > 20:
            history = history[-20:]
        existing["history"] = history
        if session_id:
            existing["session_id"] = session_id
        profile["concepts"][similar] = existing
        self._save(profile)
        return profile

    def update_from_conversation(self, analysis: dict, session_id: str = "") -> dict:
        profile = self._load()
        profile["total_messages"] = profile.get("total_messages", 0) + 1
        for c in analysis.get("concepts", []):
            name = c["name"]
            m = c.get("mastery", "learning")
            if m not in VALID_MASTERY:
                m = "learning"
            # Merge with similar existing
            similar = self._find_similar(name, profile["concepts"])
            if similar and similar != name:
                existing = profile["concepts"][similar]
                if len(name) > len(similar):
                    profile["concepts"][name] = existing
                    del profile["concepts"][similar]
                    similar = name
            else:
                similar = name
            existing = profile["concepts"].get(similar, {})
            existing["mastery"] = m
            existing["last_discussed"] = datetime.now().isoformat()[:10]
            if c.get("note"):
                existing["note"] = c["note"]
            history = existing.get("history", [])
            history.append({
                "mastery": m,
                "date": datetime.now().isoformat()[:10],
                "time": datetime.now().isoformat()[:16],
                "session_id": session_id,
            })
            if len(history) > 20:
                history = history[-20:]
            existing["history"] = history
            if session_id:
                existing["session_id"] = session_id
            profile["concepts"][similar] = existing
        self._save(profile)
        return profile

    def get_timeline(self) -> list[dict]:
        """Return timeline of recent learning activity."""
        profile = self._load()
        events = []
        for name, info in profile.get("concepts", {}).items():
            for h in info.get("history", []):
                events.append({
                    "concept": name,
                    "mastery": h.get("mastery", "learning"),
                    "date": h.get("date", ""),
                    "time": h.get("time", ""),
                    "session_id": h.get("session_id", ""),
                })
        events.sort(key=lambda e: e.get("time", ""), reverse=True)
        return events[:30]

    def get_trends(self) -> list[dict]:
        """Return mastery trend data grouped by date."""
        profile = self._load()
        by_date: dict[str, dict] = {}
        for name, info in profile.get("concepts", {}).items():
            for h in info.get("history", []):
                d = h.get("date", "")
                if d not in by_date:
                    by_date[d] = {"date": d, "mastered": 0, "weak": 0, "learning": 0, "total": 0}
                by_date[d][h.get("mastery", "learning")] = by_date[d].get(h.get("mastery", "learning"), 0) + 1
                by_date[d]["total"] += 1
        return sorted(by_date.values(), key=lambda x: x["date"])

    def reset(self) -> dict:
        empty = {"concepts": {}, "total_sessions": 0, "total_messages": 0, "updated_at": datetime.now().isoformat()}
        self._save(empty)
        return empty

    def build_context(self) -> str:
        """Build a student profile summary to inject into the system prompt."""
        profile = self._load()
        concepts = profile.get("concepts", {})
        if not concepts:
            return ""
        mastered = [k for k, v in concepts.items() if v.get("mastery") == "mastered"]
        weak = [k for k, v in concepts.items() if v.get("mastery") == "weak"]
        learning = [k for k, v in concepts.items() if v.get("mastery") == "learning"]
        lines = ["[学生画像]"]
        if mastered:
            lines.append(f"已掌握: {', '.join(mastered)}")
        if weak:
            lines.append(f"薄弱点: {', '.join(weak)}")
            lines.append("→ 对这些概念多出练习题，重点引导")
        if learning:
            lines.append(f"正在学: {', '.join(learning)}")
        return "\n".join(lines)


student_service = StudentService()
