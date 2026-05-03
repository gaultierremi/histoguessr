"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeacherQuestion = {
  id: string;
  teacher_id: string;
  type: "mcq" | "truefalse";
  question: string;
  options: string[];
  answer_index: number;
  explanation: string | null;
  subject: string | null;
  period: string | null;
  is_public: boolean;
  created_at: string;
};

type PublicQuestion = {
  id: string;
  type: "mcq" | "truefalse";
  question: string;
  options: string[];
  answer_index: number;
  explanation: string | null;
  period: string | null;
  difficulty: number | null;
};

type DraftQuestion = {
  key: number;
  type: "mcq" | "truefalse";
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  period: string;
  kept: boolean;
};

type ProposeState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "proposed" }
  | { kind: "duplicate"; similarText: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERIODS = [
  "Préhistoire",
  "Antiquité",
  "Moyen Âge",
  "Renaissance",
  "XVIe siècle",
  "XVIIe siècle",
  "XVIIIe siècle",
  "XIXe siècle",
  "XXe siècle",
  "XXIe siècle",
  "Autre",
] as const;

const BLANK_FORM = {
  type: "mcq" as "mcq" | "truefalse",
  question: "",
  options: ["", "", "", ""],
  answer_index: 0,
  explanation: "",
  subject: "",
  period: "",
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: "mcq" | "truefalse" }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-black uppercase ${
        type === "mcq"
          ? "bg-blue-500/20 text-blue-300"
          : "bg-purple-500/20 text-purple-300"
      }`}
    >
      {type === "mcq" ? "QCM" : "V/F"}
    </span>
  );
}

function FilterBar({
  filterType,
  setFilterType,
  filterPeriod,
  setFilterPeriod,
  filterText,
  setFilterText,
  showText = false,
}: {
  filterType: string;
  setFilterType: (v: string) => void;
  filterPeriod: string;
  setFilterPeriod: (v: string) => void;
  filterText?: string;
  setFilterText?: (v: string) => void;
  showText?: boolean;
}) {
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {showText && setFilterText !== undefined && (
        <input
          type="text"
          value={filterText ?? ""}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Rechercher..."
          className="flex-1 min-w-[160px] rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-amber-500"
        />
      )}
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
      >
        <option value="">Tous les types</option>
        <option value="mcq">QCM</option>
        <option value="truefalse">Vrai / Faux</option>
      </select>
      <select
        value={filterPeriod}
        onChange={(e) => setFilterPeriod(e.target.value)}
        className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
      >
        <option value="">Toutes les périodes</option>
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestionForm
// ---------------------------------------------------------------------------

function QuestionForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  isEdit,
}: {
  form: typeof BLANK_FORM;
  setForm: (f: typeof BLANK_FORM) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  const isTrueFalse = form.type === "truefalse";
  const displayOptions = isTrueFalse ? ["Vrai", "Faux"] : form.options;

  return (
    <div className="mb-6 rounded-3xl border border-amber-500/30 bg-gray-900 p-5">
      <h2 className="text-lg font-black text-white">
        {isEdit ? "Modifier la question" : "Nouvelle question"}
      </h2>

      {/* Row 1: type + period */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-black uppercase tracking-widest text-gray-500">
            Type
          </label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm({
                ...form,
                type: e.target.value as "mcq" | "truefalse",
                answer_index: 0,
              })
            }
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-amber-500"
          >
            <option value="mcq">QCM — Carré (4 options)</option>
            <option value="truefalse">Vrai / Faux — Duo (2 options)</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-black uppercase tracking-widest text-gray-500">
            Période historique
          </label>
          <select
            value={form.period}
            onChange={(e) => setForm({ ...form, period: e.target.value })}
            className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none focus:border-amber-500"
          >
            <option value="">Sélectionner une période</option>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: subject */}
      <div className="mt-4">
        <label className="text-xs font-black uppercase tracking-widest text-gray-500">
          Matière (optionnel)
        </label>
        <input
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Ex : Histoire, SVT, Géographie..."
          className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none placeholder:text-gray-600 focus:border-amber-500"
        />
      </div>

      {/* Question text */}
      <div className="mt-4">
        <label className="text-xs font-black uppercase tracking-widest text-gray-500">
          Question
        </label>
        <textarea
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          rows={2}
          placeholder="Énonce ta question..."
          className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none placeholder:text-gray-600 focus:border-amber-500"
        />
      </div>

      {/* Options */}
      <div className="mt-4">
        <label className="text-xs font-black uppercase tracking-widest text-gray-500">
          {isTrueFalse
            ? "Réponse correcte"
            : "Options — clique sur le cercle pour marquer la bonne réponse"}
        </label>
        <div
          className={`mt-2 grid gap-2 ${
            isTrueFalse ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
          }`}
        >
          {displayOptions.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, answer_index: i })}
                className={`shrink-0 h-6 w-6 rounded-full border-2 transition ${
                  form.answer_index === i
                    ? "border-green-500 bg-green-500"
                    : "border-gray-600 hover:border-gray-400"
                }`}
                aria-label={`Marquer option ${i + 1} comme correcte`}
              />
              {isTrueFalse ? (
                <span
                  className={`font-bold ${
                    form.answer_index === i ? "text-green-300" : "text-white"
                  }`}
                >
                  {opt}
                </span>
              ) : (
                <input
                  value={form.options[i] ?? ""}
                  onChange={(e) => {
                    const next = [...form.options];
                    next[i] = e.target.value;
                    setForm({ ...form, options: next });
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  className={`w-full rounded-xl border px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-amber-500 ${
                    form.answer_index === i
                      ? "border-green-500/50 bg-green-500/10"
                      : "border-gray-700 bg-gray-950"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-4">
        <label className="text-xs font-black uppercase tracking-widest text-gray-500">
          Explication (optionnel)
        </label>
        <input
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          placeholder="Explication affichée après la réponse..."
          className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-white outline-none placeholder:text-gray-600 focus:border-amber-500"
        />
      </div>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !form.question.trim()}
          className="rounded-2xl bg-amber-500 px-5 py-3 font-black text-gray-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {saving ? "Sauvegarde..." : isEdit ? "Enregistrer" : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-gray-700 px-5 py-3 font-bold text-gray-300 hover:text-white"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestionCard
// ---------------------------------------------------------------------------

function QuestionCard({
  q,
  onEdit,
  onDelete,
  onTogglePublic,
  proposeState,
  onPropose,
  onForcePropose,
}: {
  q: TeacherQuestion;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublic: () => void;
  proposeState: ProposeState;
  onPropose: () => void;
  onForcePropose: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={q.type} />
            {q.period && (
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                {q.period}
              </span>
            )}
            {q.subject && (
              <span className="text-xs text-gray-500">{q.subject}</span>
            )}
          </div>
          <p className="mt-2 font-bold text-white">{q.question}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {q.options.map((opt, i) => (
              <span
                key={i}
                className={`rounded-lg px-2 py-0.5 text-xs ${
                  i === q.answer_index
                    ? "bg-green-500/20 font-black text-green-300"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {opt}
              </span>
            ))}
          </div>
          {q.explanation && (
            <p className="mt-2 text-xs italic text-gray-500">{q.explanation}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            onClick={onTogglePublic}
            className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
              q.is_public
                ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                : "border border-gray-700 text-gray-500 hover:text-white"
            }`}
          >
            {q.is_public ? "Publique" : "Privée"}
          </button>
          <button
            onClick={onEdit}
            className="rounded-xl border border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-300 hover:border-amber-500/50 hover:text-amber-300"
          >
            Éditer
          </button>
          <button
            onClick={onDelete}
            className="rounded-xl border border-red-500/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Propose section */}
      <div className="mt-3 border-t border-gray-800 pt-3">
        {proposeState.kind === "idle" && (
          <button
            onClick={onPropose}
            className="rounded-xl bg-indigo-500/20 px-3 py-1.5 text-xs font-black text-indigo-300 transition hover:bg-indigo-500/30"
          >
            📤 Proposer au site HistoGuess
          </button>
        )}

        {proposeState.kind === "loading" && (
          <span className="text-xs text-gray-500">Vérification en cours...</span>
        )}

        {proposeState.kind === "proposed" && (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-500/20 px-3 py-1.5 text-xs font-black text-green-300">
            ✓ Proposée au site
          </span>
        )}

        {proposeState.kind === "duplicate" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs font-black text-amber-300">
              ⚠️ Question similaire déjà existante :
            </p>
            <p className="mt-1 text-xs italic text-gray-400">
              &ldquo;{proposeState.similarText}&rdquo;
            </p>
            <button
              onClick={onForcePropose}
              className="mt-2 rounded-lg bg-amber-500/30 px-3 py-1.5 text-xs font-black text-amber-200 hover:bg-amber-500/50"
            >
              Proposer quand même
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PdfUploadZone
// ---------------------------------------------------------------------------

function PdfUploadZone({
  loading,
  error,
  onFile,
}: {
  loading: boolean;
  error: string | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onFile(file);
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-400">
        Dépose un PDF de cours et l&apos;IA génère des questions avec détection
        automatique de la période historique.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-12 transition ${
          dragging
            ? "border-amber-500 bg-amber-500/5"
            : "border-gray-700 bg-gray-900 hover:border-amber-500/50"
        }`}
      >
        {loading ? (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-700 border-t-amber-500" />
            <p className="mt-4 font-bold text-amber-400">Analyse en cours...</p>
            <p className="mt-1 text-sm text-gray-500">
              Cela peut prendre quelques secondes
            </p>
          </>
        ) : (
          <>
            <span className="text-5xl">📄</span>
            <p className="mt-4 font-black text-white">Dépose ton PDF ici</p>
            <p className="mt-1 text-sm text-gray-500">
              ou clique pour parcourir
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DraftCard
// ---------------------------------------------------------------------------

function DraftCard({
  draft,
  onChange,
}: {
  draft: DraftQuestion;
  onChange: (d: DraftQuestion) => void;
}) {
  const isTrueFalse = draft.type === "truefalse";

  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        draft.kept
          ? "border-gray-700 bg-gray-900"
          : "border-gray-800 bg-gray-950 opacity-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={draft.type} />
          {draft.period && (
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
              {draft.period}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {draft.kept ? "À conserver" : "Ignorée"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onChange({ ...draft, kept: true })}
            className={`rounded-xl px-3 py-1.5 text-xs font-black ${
              draft.kept
                ? "bg-green-500 text-gray-950"
                : "border border-gray-700 text-gray-500"
            }`}
          >
            ✓ Garder
          </button>
          <button
            onClick={() => onChange({ ...draft, kept: false })}
            className={`rounded-xl px-3 py-1.5 text-xs font-black ${
              !draft.kept
                ? "bg-red-500 text-white"
                : "border border-gray-700 text-gray-500"
            }`}
          >
            ✗ Ignorer
          </button>
        </div>
      </div>

      <textarea
        value={draft.question}
        onChange={(e) => onChange({ ...draft, question: e.target.value })}
        rows={2}
        className="mt-3 w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-500"
      />

      <div className={`mt-3 grid gap-2 ${isTrueFalse ? "grid-cols-2" : "grid-cols-2"}`}>
        {draft.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...draft, answer_index: i })}
              className={`shrink-0 h-5 w-5 rounded-full border-2 transition ${
                draft.answer_index === i
                  ? "border-green-500 bg-green-500"
                  : "border-gray-600"
              }`}
            />
            {isTrueFalse ? (
              <span className="text-sm text-white">{opt}</span>
            ) : (
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...draft.options];
                  next[i] = e.target.value;
                  onChange({ ...draft, options: next });
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={draft.period}
          onChange={(e) => onChange({ ...draft, period: e.target.value })}
          className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
        >
          <option value="">Période (optionnel)</option>
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <input
          value={draft.explanation}
          onChange={(e) => onChange({ ...draft, explanation: e.target.value })}
          placeholder="Explication..."
          className="rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-300 outline-none placeholder:text-gray-600 focus:border-amber-500"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SchoolQuestionsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [isTeacher, setIsTeacher] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [tab, setTab] = useState<"my" | "pdf" | "public">("my");

  // My questions
  const [myQuestions, setMyQuestions] = useState<TeacherQuestion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);

  // My questions filters
  const [myFilterType, setMyFilterType] = useState("");
  const [myFilterPeriod, setMyFilterPeriod] = useState("");

  // Propose
  const [proposeStatuses, setProposeStatuses] = useState<
    Record<string, ProposeState>
  >({});

  // PDF
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [savingDrafts, setSavingDrafts] = useState(false);

  // Public library
  const [publicQuestions, setPublicQuestions] = useState<PublicQuestion[]>([]);
  const [pubFilterType, setPubFilterType] = useState("");
  const [pubFilterPeriod, setPubFilterPeriod] = useState("");
  const [pubFilterText, setPubFilterText] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  // Teacher access check
  useEffect(() => {
    async function checkAccess() {
      const { data } = await supabase.rpc("is_current_user_school_teacher");
      setIsTeacher(data === true);
      setPageLoading(false);
    }
    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMyQuestions() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("teacher_questions")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    setMyQuestions((data ?? []) as TeacherQuestion[]);
  }

  async function loadPublicQuestions() {
    const { data } = await supabase
      .from("quiz_questions")
      .select(
        "id, type, question, options, answer_index, explanation, period, difficulty"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(200);

    setPublicQuestions((data ?? []) as PublicQuestion[]);
  }

  useEffect(() => {
    if (!isTeacher) return;
    loadMyQuestions();
    loadPublicQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  // ── Form helpers ──

  function resetForm() {
    setForm({ ...BLANK_FORM });
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(q: TeacherQuestion) {
    setForm({
      type: q.type,
      question: q.question,
      options:
        q.type === "truefalse"
          ? ["Vrai", "Faux", "", ""]
          : [...q.options, "", "", "", ""].slice(0, 4),
      answer_index: q.answer_index,
      explanation: q.explanation ?? "",
      subject: q.subject ?? "",
      period: q.period ?? "",
    });
    setEditingId(q.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveQuestion() {
    if (!form.question.trim()) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const options =
      form.type === "truefalse"
        ? ["Vrai", "Faux"]
        : form.options.map((o) => o.trim()).filter(Boolean);

    if (form.type === "mcq" && options.length < 2) {
      alert("Ajoute au moins 2 options.");
      setSaving(false);
      return;
    }

    const payload = {
      teacher_id: user.id,
      type: form.type,
      question: form.question.trim(),
      options,
      answer_index: Math.min(form.answer_index, options.length - 1),
      explanation: form.explanation.trim() || null,
      subject: form.subject.trim() || null,
      period: form.period || null,
    };

    if (editingId) {
      await supabase
        .from("teacher_questions")
        .update(payload)
        .eq("id", editingId);
    } else {
      await supabase.from("teacher_questions").insert(payload);
    }

    await loadMyQuestions();
    resetForm();
    setSaving(false);
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Supprimer cette question définitivement ?")) return;
    await supabase.from("teacher_questions").delete().eq("id", id);
    setMyQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function togglePublic(q: TeacherQuestion) {
    await supabase
      .from("teacher_questions")
      .update({ is_public: !q.is_public })
      .eq("id", q.id);
    setMyQuestions((prev) =>
      prev.map((x) => (x.id === q.id ? { ...x, is_public: !x.is_public } : x))
    );
  }

  // ── Propose ──

  async function proposeQuestion(id: string, force = false) {
    setProposeStatuses((prev) => ({ ...prev, [id]: { kind: "loading" } }));

    try {
      const res = await fetch("/api/propose-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: id, forcePropose: force }),
      });

      const json = await res.json();

      if (!res.ok) {
        setProposeStatuses((prev) => ({ ...prev, [id]: { kind: "idle" } }));
        alert(json.error ?? "Erreur lors de la proposition.");
        return;
      }

      if (json.duplicate) {
        setProposeStatuses((prev) => ({
          ...prev,
          [id]: { kind: "duplicate", similarText: json.similar },
        }));
        return;
      }

      setProposeStatuses((prev) => ({ ...prev, [id]: { kind: "proposed" } }));
    } catch {
      setProposeStatuses((prev) => ({ ...prev, [id]: { kind: "idle" } }));
      alert("Erreur réseau.");
    }
  }

  // ── PDF ──

  async function handlePdfUpload(file: File) {
    setPdfError(null);
    setPdfLoading(true);
    setDrafts([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];

      try {
        const res = await fetch("/api/extract-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdf: base64 }),
        });

        const json = await res.json();

        if (!res.ok || json.error) {
          setPdfError(json.error ?? "Erreur lors de l'analyse");
          setPdfLoading(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setDrafts((json.questions as any[]).map((q, i) => ({
          key: i,
          type: q.type ?? "mcq",
          question: q.question ?? "",
          options: Array.isArray(q.options) ? q.options : [],
          answer_index: q.answer_index ?? 0,
          explanation: q.explanation ?? "",
          period: q.period ?? "",
          kept: true,
        })));
      } catch {
        setPdfError("Erreur réseau, réessaie.");
      }

      setPdfLoading(false);
    };

    reader.readAsDataURL(file);
  }

  async function saveDrafts() {
    const toSave = drafts.filter((d) => d.kept);
    if (!toSave.length) return;

    setSavingDrafts(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingDrafts(false);
      return;
    }

    await supabase.from("teacher_questions").insert(
      toSave.map((d) => ({
        teacher_id: user.id,
        type: d.type,
        question: d.question,
        options: d.options,
        answer_index: d.answer_index,
        explanation: d.explanation || null,
        period: d.period || null,
        subject: null,
      }))
    );

    await loadMyQuestions();
    setDrafts([]);
    setTab("my");
    setSavingDrafts(false);
  }

  // ── Public → my ──

  async function addPublicQuestion(q: PublicQuestion) {
    setAddingId(q.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAddingId(null);
      return;
    }

    await supabase.from("teacher_questions").insert({
      teacher_id: user.id,
      type: q.type,
      question: q.question,
      options: q.options,
      answer_index: q.answer_index,
      explanation: q.explanation ?? null,
      period: q.period ?? null,
      subject: null,
    });

    await loadMyQuestions();
    setAddingId(null);
  }

  // ── Filtered lists ──

  const filteredMyQuestions = myQuestions.filter((q) => {
    if (myFilterType && q.type !== myFilterType) return false;
    if (myFilterPeriod && q.period !== myFilterPeriod) return false;
    return true;
  });

  const filteredPublic = publicQuestions.filter((q) => {
    if (pubFilterType && q.type !== pubFilterType) return false;
    if (pubFilterPeriod && q.period !== pubFilterPeriod) return false;
    if (
      pubFilterText &&
      !q.question.toLowerCase().includes(pubFilterText.toLowerCase())
    )
      return false;
    return true;
  });

  // ── Guards ──

  if (pageLoading) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        Chargement...
      </main>
    );
  }

  if (!isTeacher) {
    return (
      <main className="min-h-screen bg-gray-950 p-8 text-white">
        <div className="mx-auto max-w-xl rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-2xl font-black text-red-300">Accès refusé</h1>
          <p className="mt-2 text-gray-300">
            Cet espace est réservé aux professeurs autorisés.
          </p>
        </div>
      </main>
    );
  }

  // ── Render ──

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-white">
      <div className="mx-auto w-full max-w-4xl">
        <a
          href="/school"
          className="text-sm font-bold text-gray-500 transition hover:text-amber-400"
        >
          ← Espace professeur
        </a>

        <h1 className="mt-4 text-4xl font-black">Mes questions</h1>
        <p className="mt-2 text-gray-400">
          Crée, importe depuis un PDF et gère tes questions de quiz.
        </p>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-gray-800">
          {(
            [
              {
                key: "my",
                label: `Mes questions (${myQuestions.length})`,
              },
              { key: "pdf", label: "Importer PDF" },
              { key: "public", label: "Bibliothèque HistoGuess" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-t-xl px-4 py-3 text-sm font-black transition ${
                tab === key
                  ? "bg-gray-900 text-amber-400"
                  : "text-gray-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {/* ── My questions ── */}
          {tab === "my" && (
            <div>
              {showForm ? (
                <QuestionForm
                  form={form}
                  setForm={setForm}
                  onSave={saveQuestion}
                  onCancel={resetForm}
                  saving={saving}
                  isEdit={!!editingId}
                />
              ) : (
                <button
                  onClick={() => {
                    setForm({ ...BLANK_FORM });
                    setEditingId(null);
                    setShowForm(true);
                  }}
                  className="mb-6 rounded-2xl bg-amber-500 px-5 py-3 font-black text-gray-950 transition hover:bg-amber-400"
                >
                  + Nouvelle question
                </button>
              )}

              <FilterBar
                filterType={myFilterType}
                setFilterType={setMyFilterType}
                filterPeriod={myFilterPeriod}
                setFilterPeriod={setMyFilterPeriod}
              />

              {filteredMyQuestions.length === 0 && !showForm ? (
                <div className="rounded-2xl border border-dashed border-gray-800 p-10 text-center text-gray-500">
                  {myQuestions.length === 0
                    ? "Aucune question. Crée-en une ou importe depuis un PDF."
                    : "Aucun résultat pour ces filtres."}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMyQuestions.map((q) =>
                    editingId === q.id && showForm ? null : (
                      <QuestionCard
                        key={q.id}
                        q={q}
                        onEdit={() => startEdit(q)}
                        onDelete={() => deleteQuestion(q.id)}
                        onTogglePublic={() => togglePublic(q)}
                        proposeState={
                          proposeStatuses[q.id] ?? { kind: "idle" }
                        }
                        onPropose={() => proposeQuestion(q.id)}
                        onForcePropose={() => proposeQuestion(q.id, true)}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── PDF import ── */}
          {tab === "pdf" && (
            <div>
              {drafts.length === 0 ? (
                <PdfUploadZone
                  loading={pdfLoading}
                  error={pdfError}
                  onFile={handlePdfUpload}
                />
              ) : (
                <div>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-black text-white">
                      {drafts.filter((d) => d.kept).length} /{" "}
                      {drafts.length} question(s) sélectionnée(s)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDrafts([])}
                        className="rounded-xl border border-gray-700 px-4 py-2 text-sm font-bold text-gray-300 hover:text-white"
                      >
                        Recommencer
                      </button>
                      <button
                        onClick={saveDrafts}
                        disabled={
                          savingDrafts ||
                          drafts.filter((d) => d.kept).length === 0
                        }
                        className="rounded-xl bg-green-500 px-5 py-2 text-sm font-black text-gray-950 hover:bg-green-400 disabled:opacity-40"
                      >
                        {savingDrafts ? "Sauvegarde..." : "Tout valider →"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {drafts.map((draft, idx) => (
                      <DraftCard
                        key={draft.key}
                        draft={draft}
                        onChange={(updated) =>
                          setDrafts((prev) =>
                            prev.map((d, i) => (i === idx ? updated : d))
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Public library ── */}
          {tab === "public" && (
            <div>
              <FilterBar
                filterType={pubFilterType}
                setFilterType={setPubFilterType}
                filterPeriod={pubFilterPeriod}
                setFilterPeriod={setPubFilterPeriod}
                filterText={pubFilterText}
                setFilterText={setPubFilterText}
                showText
              />

              <p className="mb-4 text-sm text-gray-500">
                {filteredPublic.length} question(s) approuvée(s) HistoGuess
              </p>

              <div className="space-y-2">
                {filteredPublic.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <TypeBadge type={q.type} />
                        {q.period && (
                          <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                            {q.period}
                          </span>
                        )}
                        {q.difficulty && (
                          <span className="text-xs text-gray-600">
                            Difficulté {q.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-bold text-white">
                        {q.question}
                      </p>
                    </div>
                    <button
                      onClick={() => addPublicQuestion(q)}
                      disabled={addingId === q.id}
                      className="shrink-0 rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-black text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-40"
                    >
                      {addingId === q.id ? "..." : "+ Ajouter"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
