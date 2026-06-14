"use client";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import type { Annotation } from "@/services/api";
import { saveAnnotation, deleteAnnotation } from "@/services/api";

type Props = {
  mode: "coach" | "student";
  coachId: string;
  playerUsername: string;
  filename: string;
  moveIndex: number;
  annotations: Annotation[];
  onSaved: (annotation: Annotation) => void;
  onDeleted: (id: string) => void;
};

function moveLabelFromPly(ply: number): string {
  if (ply === 0) return "Start position";
  const moveNum = Math.floor((ply - 1) / 2) + 1;
  const color = (ply - 1) % 2 === 0 ? "White" : "Black";
  return `Move ${moveNum} · ${color}`;
}

export default function AnnotationPanel({
  mode,
  coachId,
  playerUsername,
  filename,
  moveIndex,
  annotations,
  onSaved,
  onDeleted,
}: Props) {
  const current = annotations.find((a) => a.move_index === moveIndex);
  const [text, setText] = useState(current?.note ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMoveRef = useRef(moveIndex);

  useEffect(() => {
    if (prevMoveRef.current !== moveIndex) {
      prevMoveRef.current = moveIndex;
      setText(current?.note ?? "");
    }
  }, [moveIndex, current?.note]);

  const handleChange = (val: string) => {
    setText(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!val.trim()) return;
      setSaving(true);
      const saved = await saveAnnotation({
        coach_id: coachId,
        player_username: playerUsername,
        filename,
        move_index: moveIndex,
        note: val,
      });
      setSaving(false);
      if (saved) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1600);
        onSaved(saved);
      }
    }, 800);
  };

  const handleDelete = async () => {
    if (!current) return;
    await deleteAnnotation(current.id);
    setText("");
    onDeleted(current.id);
  };

  if (mode === "student") {
    if (!current) return null;
    return (
      <div
        style={{
          marginTop: "10px",
          padding: "12px 14px",
          background: "rgba(99,102,241,0.06)",
          border: "1px solid rgba(99,102,241,0.22)",
          borderRadius: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "6px",
          }}
        >
          <MessageSquare size={13} color="#6366f1" />
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#6366f1",
              textTransform: "uppercase",
            }}
          >
            Coach Note · {moveLabelFromPly(moveIndex)}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "var(--text-secondary)",
            lineHeight: "1.6",
          }}
        >
          {current.note}
        </p>
      </div>
    );
  }

  // Coach mode
  return (
    <div
      style={{
        marginTop: "10px",
        padding: "12px 14px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--glass-border)",
        borderRadius: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <MessageSquare size={13} color="#6366f1" />
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#6366f1",
              textTransform: "uppercase",
            }}
          >
            Coach Note · {moveLabelFromPly(moveIndex)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {savedFlash && (
            <span style={{ fontSize: "11px", color: "var(--success)" }}>
              Saved ✓
            </span>
          )}
          {saving && (
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Saving…
            </span>
          )}
          {current && (
            <button
              onClick={handleDelete}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                color: "var(--danger)",
                display: "flex",
              }}
              title="Delete note"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={`Add a coaching note for ${moveLabelFromPly(moveIndex)}…`}
        rows={2}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--glass-border)",
          borderRadius: "6px",
          color: "var(--text-primary)",
          fontSize: "13px",
          padding: "8px 10px",
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
          lineHeight: "1.5",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}
