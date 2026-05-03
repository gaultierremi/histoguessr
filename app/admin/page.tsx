"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";
import Header from "@/components/Header";
import { ADMIN_EMAILS, VALIDATOR_EMAILS, ALL_ADMIN_EMAILS } from "@/lib/admin-config";
import type { Question, QuizQuestion, QuizQuestionStatus, TimelineEvent } from "@/lib/types";

// ─── Shared helpers ───────────────────────────────────────────────────────────

type FormState = {
  answer: string;
  period: string;
  hint: string;
  difficulty: string;
  imageFile: File | null;
  imagePreview: string | null;
};

const EMPTY_FORM: FormState = {
  answer: "",
  period: "",
  hint: "",
  difficulty: "1",
  imageFile: null,
  imagePreview: null,
};

type TimelineFormState = {
  title: string;
  description: string;
  year: string;
  category: string;
  image_url: string;
};

const EMPTY_TIMELINE_FORM: TimelineFormState = {
  title: "",
  description: "",
  year: "",
  category: "",
  image_url: "",
};

// QuizQuestionStatus is a superset of QuestionStatus — one map covers both
const STATUS_STYLES: Record<QuizQuestionStatus, string> = {
  pending:  "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
  to_check: "bg-blue-500/10   text-blue-400   border border-blue-500/20",
  approved: "bg-green-500/10  text-green-400  border border-green-500/20",
  rejected: "bg-red-500/10    text-red-400    border border-red-500/20",
};

const STATUS_LABELS: Record<QuizQuestionStatus, string> = {
  pending:  "En attente",
  to_check: "À vérifier",
  approved: "Approuvé",
  rejected: "Refusé",
};

function StatusBadge({ status }: { status: QuizQuestionStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  );
}

// ─── Gate screens ─────────────────────────────────────────────────────────────

function NotLoggedIn() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-4 text-center">
      <p className="text-gray-400">Connecte-toi pour accéder à l&apos;admin.</p>
      <Link href="/" className="rounded-full bg-amber-500 px-6 py-2 text-sm font-bold text-gray-950 hover:bg-amber-400">
        ← Retour à l&apos;accueil
      </Link>
    </div>
  );
}

function AccessDenied({ email }: { email: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-950 px-4 text-center">
      <p className="text-lg font-semibold text-red-400">Accès refusé</p>
      <p className="text-sm text-gray-500">{email} n&apos;est pas autorisé.</p>
      <Link href="/" className="mt-2 rounded-full border border-gray-700 px-6 py-2 text-sm text-gray-300 hover:text-white">
        ← Retour à l&apos;accueil
      </Link>
    </div>
  );
}

// ─── Creator view ─────────────────────────────────────────────────────────────

type CreatorTab = "anachronisme" | "timeline";

function CreatorView({ supabase }: { supabase: SupabaseClient }) {
  const [creatorTab, setCreatorTab] = useState<CreatorTab>("anachronisme");

  // ── Anachronisme state ──
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Timeline state ──
  const [timelineForm, setTimelineForm] = useState<TimelineFormState>(EMPTY_TIMELINE_FORM);
  const [timelineSubmitting, setTimelineSubmitting] = useState(false);
  const [timelineMessage, setTimelineMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchQuestions = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setQuestions(data as Question[]);
  }, [supabase]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  }

  function clearImage() {
    setForm((f) => ({ ...f, imageFile: null, imagePreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.imageFile) { setMessage({ ok: false, text: "Sélectionne une image." }); return; }
    setSubmitting(true);
    setMessage(null);

    const ext = form.imageFile.name.split(".").pop() ?? "jpg";
    const path = `${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("question-images")
      .upload(path, form.imageFile, { cacheControl: "3600" });

    if (uploadError) {
      setMessage({ ok: false, text: `Upload échoué : ${uploadError.message}` });
      setSubmitting(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("question-images").getPublicUrl(path);

    const { error: insertError } = await supabase.from("questions").insert({
      image_url: publicUrl,
      answer: form.answer,
      period: form.period || null,
      hint: form.hint || null,
      difficulty: Number(form.difficulty),
      status: "pending",
    });

    if (insertError) {
      setMessage({ ok: false, text: `Erreur DB : ${insertError.message}` });
    } else {
      setMessage({ ok: true, text: "Question soumise — en attente de validation." });
      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchQuestions();
    }
    setSubmitting(false);
  }

  async function handleDelete(q: Question) {
    if (!confirm(`Supprimer "${q.answer}" ? Cette action est irréversible.`)) return;
    await supabase.from("questions").delete().eq("id", q.id);
    const marker = "/question-images/";
    const idx = q.image_url.indexOf(marker);
    if (idx !== -1) {
      await supabase.storage.from("question-images").remove([q.image_url.slice(idx + marker.length)]);
    }
    fetchQuestions();
  }

  async function handleTimelineSubmit(e: React.FormEvent) {
    e.preventDefault();
    const yearNum = parseInt(timelineForm.year, 10);
    if (isNaN(yearNum)) { setTimelineMessage({ ok: false, text: "L\'année doit être un nombre." }); return; }
    setTimelineSubmitting(true);
    setTimelineMessage(null);

    const { error } = await supabase.from("timeline_events").insert({
      title: timelineForm.title.trim(),
      description: timelineForm.description.trim() || null,
      year: yearNum,
      category: timelineForm.category.trim() || null,
      image_url: timelineForm.image_url.trim() || null,
      status: "pending",
      difficulty: 1,
    });

    if (error) {
      setTimelineMessage({ ok: false, text: `Erreur DB : ${error.message}` });
    } else {
      setTimelineMessage({ ok: true, text: "Événement soumis — en attente de validation." });
      setTimelineForm(EMPTY_TIMELINE_FORM);
    }
    setTimelineSubmitting(false);
  }

  const creatorTabs: { id: CreatorTab; label: string }[] = [
    { id: "anachronisme", label: "Anachronisme" },
    { id: "timeline",     label: "Ligne du temps" },
  ];

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
        {creatorTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCreatorTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              creatorTab === tab.id
                ? "bg-amber-500 text-gray-950"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {creatorTab === "anachronisme" ? (
        <div className="space-y-10">
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-5 text-base font-bold text-white">Soumettre une question</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Image <span className="text-amber-400">*</span>
                </label>
                {form.imagePreview ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={form.imagePreview} alt="Aperçu" className="h-full w-full object-cover" />
                    <button type="button" onClick={clearImage}
                      className="absolute right-2 top-2 rounded-full bg-gray-950/80 px-3 py-1 text-xs text-gray-300 backdrop-blur-sm hover:text-white">
                      ✕ Changer
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-700 bg-gray-950 text-gray-500 transition-colors hover:border-amber-500/40 hover:text-gray-400">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="text-sm">Cliquer pour choisir une image</span>
                    <span className="text-xs text-gray-600">JPG, PNG, WEBP</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Anachronisme <span className="text-amber-400">*</span>
                </label>
                <input type="text" value={form.answer} required
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  placeholder="ex : montre connectée, panneau solaire…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Période <span className="text-amber-400">*</span>
                </label>
                <input type="text" value={form.period} required
                  onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                  placeholder="ex : Moyen Âge, XVIIe siècle…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Indice <span className="text-xs font-normal text-gray-500">(optionnel)</span>
                </label>
                <input type="text" value={form.hint}
                  onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
                  placeholder="ex : Regarde attentivement son poignet"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">Difficulté</label>
                <select value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none">
                  <option value="1">1 — Facile</option>
                  <option value="2">2 — Moyen</option>
                  <option value="3">3 — Expert</option>
                </select>
              </div>

              {message && (
                <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>
                  {message.ok ? "✓" : "✕"} {message.text}
                </p>
              )}

              <button type="submit" disabled={submitting}
                className="w-full rounded-full bg-amber-500 py-3 text-sm font-bold text-gray-950 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "Envoi en cours…" : "Soumettre pour validation"}
              </button>
            </form>
          </section>

          <section className="pb-12">
            <h2 className="mb-4 text-base font-bold text-white">
              Mes questions <span className="text-sm font-normal text-gray-500">({questions.length})</span>
            </h2>
            {questions.length === 0 ? (
              <p className="text-sm text-gray-600">Aucune question soumise.</p>
            ) : (
              <ul className="space-y-3">
                {questions.map((q) => (
                  <li key={q.id} className="rounded-xl border border-gray-800 bg-gray-900 p-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.image_url} alt={q.answer} className="h-14 w-20 flex-shrink-0 rounded-lg object-cover sm:h-16 sm:w-24" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{q.answer}</p>
                        <p className="truncate text-xs text-gray-500">{q.period ?? "—"}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <StatusBadge status={q.status as QuizQuestionStatus} />
                          <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                            Diff. {q.difficulty ?? "?"}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => handleDelete(q)}
                        className="flex-shrink-0 rounded-lg border border-red-900/40 px-3 py-1.5 text-xs text-red-500 transition-colors hover:border-red-500/60 hover:text-red-400">
                        Supprimer
                      </button>
                    </div>
                    {q.status === "rejected" && q.rejection_reason && (
                      <div className="mt-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                        <p className="text-xs text-red-400">
                          <span className="font-semibold">Motif de refus : </span>{q.rejection_reason}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="pb-12">
          <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 sm:p-6">
            <h2 className="mb-5 text-base font-bold text-white">Soumettre un événement</h2>
            <form onSubmit={handleTimelineSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Titre <span className="text-amber-400">*</span>
                </label>
                <input type="text" value={timelineForm.title} required
                  onChange={(e) => setTimelineForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="ex : Prise de la Bastille"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Description <span className="text-xs font-normal text-gray-500">(optionnel)</span>
                </label>
                <textarea value={timelineForm.description} rows={3}
                  onChange={(e) => setTimelineForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Courte description de l'événement…"
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Année <span className="text-amber-400">*</span>{" "}
                  <span className="text-xs font-normal text-gray-500">(négatif pour av. J.-C.)</span>
                </label>
                <input type="number" value={timelineForm.year} required
                  onChange={(e) => setTimelineForm((f) => ({ ...f, year: e.target.value }))}
                  placeholder="ex : 1789 ou -52"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  Catégorie <span className="text-xs font-normal text-gray-500">(optionnel)</span>
                </label>
                <input type="text" value={timelineForm.category}
                  onChange={(e) => setTimelineForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="ex : Révolutions, Guerre, Science…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-300">
                  URL de l&apos;image <span className="text-xs font-normal text-gray-500">(optionnel)</span>
                </label>
                <input type="url" value={timelineForm.image_url}
                  onChange={(e) => setTimelineForm((f) => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none" />
                {timelineForm.image_url && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-gray-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/image-proxy?url=${encodeURIComponent(timelineForm.image_url)}`}
                      alt="Aperçu"
                      className="h-32 w-full object-cover"
                    />
                  </div>
                )}
              </div>

              {timelineMessage && (
                <p className={`text-sm ${timelineMessage.ok ? "text-green-400" : "text-red-400"}`}>
                  {timelineMessage.ok ? "✓" : "✕"} {timelineMessage.text}
                </p>
              )}

              <button type="submit" disabled={timelineSubmitting}
                className="w-full rounded-full bg-amber-500 py-3 text-sm font-bold text-gray-950 transition-all hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50">
                {timelineSubmitting ? "Envoi en cours…" : "Soumettre pour validation"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

// ─── Anachronisme validator ───────────────────────────────────────────────────

function AnachronismeValidator({ supabase }: { supabase: SupabaseClient }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (data) setQuestions(data as Question[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  async function handleApprove(id: string) {
    await supabase.from("questions").update({ status: "approved" }).eq("id", id);
    fetchPending();
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    await supabase.from("questions").update({
      status: "rejected",
      rejection_reason: rejectReason.trim(),
    }).eq("id", id);
    setRejectingId(null);
    setRejectReason("");
    fetchPending();
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  );

  if (questions.length === 0) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
      <p className="text-sm text-gray-500">Aucune question en attente de validation.</p>
    </div>
  );

  return (
    <ul className="space-y-4">
      {questions.map((q) => (
        <li key={q.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.image_url} alt={q.answer} className="h-20 w-28 flex-shrink-0 rounded-lg object-cover sm:h-24 sm:w-36" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{q.answer}</p>
              <p className="mt-0.5 text-sm text-gray-400">{q.period ?? "—"}</p>
              {q.hint && (
                <p className="mt-1 text-xs text-gray-500">
                  <span className="font-medium text-gray-400">Indice : </span>{q.hint}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">Difficulté : {q.difficulty ?? "?"}</p>
            </div>
          </div>

          {rejectingId === q.id ? (
            <div className="mt-4 space-y-2">
              <textarea autoFocus value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motif du refus…" rows={2}
                className="w-full resize-none rounded-lg border border-red-900/50 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => handleReject(q.id)} disabled={!rejectReason.trim()}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40">
                  Confirmer le refus
                </button>
                <button onClick={() => setRejectingId(null)}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button onClick={() => handleApprove(q.id)}
                className="flex-1 rounded-lg bg-green-600/20 py-2 text-sm font-semibold text-green-400 ring-1 ring-green-500/30 transition-colors hover:bg-green-600/30">
                ✓ Approuver
              </button>
              <button onClick={() => { setRejectingId(q.id); setRejectReason(""); }}
                className="flex-1 rounded-lg bg-red-600/10 py-2 text-sm font-semibold text-red-400 ring-1 ring-red-500/20 transition-colors hover:bg-red-600/20">
                ✕ Refuser
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Quiz validator ───────────────────────────────────────────────────────────

type QuizEditForm = {
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  period: string;
  difficulty: string;
};

function QuizValidator({ supabase }: { supabase: SupabaseClient }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QuizEditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchReviewable = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("quiz_questions")
      .select("*")
      .in("status", ["pending", "to_check"])
      .order("created_at", { ascending: true });
    if (data) setQuestions(data as QuizQuestion[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchReviewable(); }, [fetchReviewable]);

  async function handleApprove(id: string) {
    await supabase.from("quiz_questions").update({ status: "approved" }).eq("id", id);
    fetchReviewable();
  }

  async function handleToCheck(id: string) {
    await supabase.from("quiz_questions").update({ status: "to_check" }).eq("id", id);
    fetchReviewable();
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    await supabase.from("quiz_questions").update({
      status: "rejected",
      rejection_reason: rejectReason.trim(),
    }).eq("id", id);
    setRejectingId(null);
    setRejectReason("");
    fetchReviewable();
  }

  function startEdit(q: QuizQuestion) {
    setRejectingId(null);
    setEditingId(q.id);
    setEditForm({
      question: q.question,
      options: [...q.options],
      answer_index: q.answer_index,
      explanation: q.explanation ?? "",
      period: q.period ?? "",
      difficulty: String(q.difficulty),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setSavingEdit(true);

    const patch = {
      question: editForm.question.trim(),
      options: editForm.options.map((o) => o.trim()),
      answer_index: editForm.answer_index,
      explanation: editForm.explanation.trim() || null,
      period: editForm.period.trim() || null,
      difficulty: Number(editForm.difficulty) as 1 | 2 | 3,
    };

    await supabase.from("quiz_questions").update(patch).eq("id", id);

    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );

    setEditingId(null);
    setEditForm(null);
    setSavingEdit(false);
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  );

  if (questions.length === 0) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
      <p className="text-sm text-gray-500">Aucune question quiz en attente de validation.</p>
    </div>
  );

  return (
    <ul className="space-y-4">
      {questions.map((q) => (
        <li key={q.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          {editingId === q.id && editForm ? (
            /* ── Edit mode ── */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-amber-400">Modifier la question</p>
                <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-white">
                  Annuler
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Question</label>
                <textarea
                  autoFocus
                  value={editForm.question}
                  onChange={(e) => setEditForm((f) => f ? { ...f, question: e.target.value } : f)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  Options — clique sur le cercle pour marquer la bonne réponse
                </label>
                <div className="space-y-1.5">
                  {editForm.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditForm((f) => f ? { ...f, answer_index: i } : f)}
                        className={`h-5 w-5 shrink-0 rounded-full border-2 transition ${
                          editForm.answer_index === i
                            ? "border-green-500 bg-green-500"
                            : "border-gray-600 hover:border-gray-400"
                        }`}
                      />
                      {q.type === "truefalse" ? (
                        <span className={`text-sm ${editForm.answer_index === i ? "text-green-400" : "text-white"}`}>
                          {opt}
                        </span>
                      ) : (
                        <input
                          value={opt}
                          onChange={(e) => {
                            const next = [...editForm.options];
                            next[i] = e.target.value;
                            setEditForm((f) => f ? { ...f, options: next } : f);
                          }}
                          className={`w-full rounded-lg border px-3 py-1.5 text-sm text-white outline-none focus:border-amber-500 ${
                            editForm.answer_index === i
                              ? "border-green-500/50 bg-green-500/10"
                              : "border-gray-700 bg-gray-950"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Explication</label>
                  <input
                    value={editForm.explanation}
                    onChange={(e) => setEditForm((f) => f ? { ...f, explanation: e.target.value } : f)}
                    placeholder="Optionnel…"
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Période</label>
                  <input
                    value={editForm.period}
                    onChange={(e) => setEditForm((f) => f ? { ...f, period: e.target.value } : f)}
                    placeholder="ex : Moyen Âge…"
                    className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Difficulté</label>
                <select
                  value={editForm.difficulty}
                  onChange={(e) => setEditForm((f) => f ? { ...f, difficulty: e.target.value } : f)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="1">1 — Facile</option>
                  <option value="2">2 — Moyen</option>
                  <option value="3">3 — Expert</option>
                </select>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => saveEdit(q.id)}
                  disabled={savingEdit || !editForm.question.trim()}
                  className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
                >
                  {savingEdit ? "Sauvegarde…" : "💾 Sauvegarder"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            /* ── Read mode ── */
            <>
              {/* Header */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={q.status} />
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                  {q.type === "mcq" ? "QCM" : "Vrai/Faux"}
                </span>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-400">
                  {"★".repeat(q.difficulty)}<span className="text-gray-700">{"★".repeat(3 - q.difficulty)}</span>
                </span>
                {q.period && (
                  <span className="text-xs text-gray-500">{q.period}</span>
                )}
                <button
                  onClick={() => startEdit(q)}
                  className="ml-auto rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-400 transition-colors hover:border-amber-500/40 hover:text-amber-300"
                >
                  ✏️ Modifier
                </button>
              </div>

              {/* Question text */}
              <p className="font-medium text-white">{q.question}</p>

              {/* Options */}
              <ul className="mt-2 space-y-1">
                {q.options.map((opt, i) => (
                  <li key={i} className={`flex items-center gap-1.5 text-sm ${
                    i === q.answer_index ? "text-green-400" : "text-gray-500"
                  }`}>
                    <span className="font-mono text-xs">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                    {i === q.answer_index && <span className="text-xs text-green-600">✓</span>}
                  </li>
                ))}
              </ul>

              {/* Explanation */}
              {q.explanation && (
                <p className="mt-2 text-xs italic text-gray-500">
                  <span className="not-italic font-medium text-gray-400">Explication : </span>
                  {q.explanation}
                </p>
              )}

              {/* Actions */}
              {rejectingId === q.id ? (
                <div className="mt-4 space-y-2">
                  <textarea autoFocus value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Motif du refus…" rows={2}
                    className="w-full resize-none rounded-lg border border-red-900/50 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => handleReject(q.id)} disabled={!rejectReason.trim()}
                      className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40">
                      Confirmer le refus
                    </button>
                    <button onClick={() => setRejectingId(null)}
                      className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => handleApprove(q.id)}
                    className="flex-1 rounded-lg bg-green-600/20 py-2 text-sm font-semibold text-green-400 ring-1 ring-green-500/30 transition-colors hover:bg-green-600/30">
                    ✓ Valider
                  </button>
                  <button onClick={() => handleToCheck(q.id)} disabled={q.status === "to_check"}
                    className="flex-1 rounded-lg bg-blue-600/10 py-2 text-sm font-semibold text-blue-400 ring-1 ring-blue-500/20 transition-colors hover:bg-blue-600/20 disabled:cursor-default disabled:opacity-40">
                    ⚠ À vérifier
                  </button>
                  <button onClick={() => { setRejectingId(q.id); setRejectReason(""); }}
                    className="flex-1 rounded-lg bg-red-600/10 py-2 text-sm font-semibold text-red-400 ring-1 ring-red-500/20 transition-colors hover:bg-red-600/20">
                    ✕ Refuser
                  </button>
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Timeline validator ───────────────────────────────────────────────────────

function TimelineValidator({ supabase }: { supabase: SupabaseClient }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("timeline_events")
      .select("*")
      .eq("status", "pending")
      .order("year", { ascending: true });
    if (data) setEvents(data as TimelineEvent[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  async function handleApprove(id: string, difficulty: 1 | 2 | 3) {
    await supabase.from("timeline_events").update({ status: "approved", difficulty }).eq("id", id);
    fetchPending();
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) return;
    await supabase.from("timeline_events").update({
      status: "rejected",
      rejection_reason: rejectReason.trim(),
    }).eq("id", id);
    setRejectingId(null);
    setRejectReason("");
    fetchPending();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer définitivement cet événement ? Cette action est irréversible.")) return;
    await supabase.from("timeline_events").delete().eq("id", id);
    fetchPending();
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    </div>
  );

  if (events.length === 0) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
      <p className="text-sm text-gray-500">Aucun événement en attente de validation.</p>
    </div>
  );

  const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
    1: "⭐ Débutant",
    2: "⭐⭐ Pro",
    3: "⭐⭐⭐ Expert",
  };

  return (
    <ul className="space-y-4">
      {events.map((ev) => (
        <li key={ev.id} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-start gap-4">
            {ev.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/image-proxy?url=${encodeURIComponent(ev.image_url)}`}
                alt={ev.title}
                className="h-20 w-28 flex-shrink-0 rounded-lg object-cover sm:h-24 sm:w-36"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{ev.title}</p>
              <p className="mt-0.5 font-mono text-sm text-amber-400">
                {ev.year < 0 ? `${Math.abs(ev.year)} av. J.-C.` : ev.year}
              </p>
              {ev.description && (
                <p className="mt-1 line-clamp-3 text-xs text-gray-400">{ev.description}</p>
              )}
              {ev.category && (
                <p className="mt-1 text-xs text-gray-600">{ev.category}</p>
              )}
            </div>
          </div>

          {rejectingId === ev.id ? (
            <div className="mt-4 space-y-2">
              <textarea autoFocus value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motif du refus…" rows={2}
                className="w-full resize-none rounded-lg border border-red-900/50 bg-gray-950 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-red-500 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => handleReject(ev.id)} disabled={!rejectReason.trim()}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-40">
                  Confirmer le refus
                </button>
                <button onClick={() => setRejectingId(null)}
                  className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-400 hover:text-white">
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                {([1, 2, 3] as const).map((d) => (
                  <button key={d} onClick={() => handleApprove(ev.id, d)}
                    className="flex-1 rounded-lg bg-green-600/20 py-2 text-xs font-semibold text-green-400 ring-1 ring-green-500/30 transition-colors hover:bg-green-600/30">
                    {DIFFICULTY_LABELS[d]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setRejectingId(ev.id); setRejectReason(""); }}
                  className="flex-1 rounded-lg bg-red-600/10 py-2 text-sm font-semibold text-red-400 ring-1 ring-red-500/20 transition-colors hover:bg-red-600/20">
                  ✕ Refuser
                </button>
                <button onClick={() => handleDelete(ev.id)}
                  className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-500 transition-colors hover:border-red-500/40 hover:text-red-400">
                  🗑 Supprimer
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Validator view (with tabs) ───────────────────────────────────────────────

type ValidatorTab = "anachronismes" | "quiz" | "timeline";

function ValidatorView({ supabase }: { supabase: SupabaseClient }) {
  const [activeTab, setActiveTab] = useState<ValidatorTab>("anachronismes");

  const tabs: { id: ValidatorTab; label: string }[] = [
    { id: "anachronismes", label: "Anachronismes" },
    { id: "quiz",          label: "Quiz" },
    { id: "timeline",      label: "Ligne du temps" },
  ];

  return (
    <div className="pb-12 space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-amber-500 text-gray-950"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "anachronismes" && <AnachronismeValidator supabase={supabase} />}
      {activeTab === "quiz" && <QuizValidator supabase={supabase} />}
      {activeTab === "timeline" && <TimelineValidator supabase={supabase} />}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoadingAuth(false);
    });
  }, [supabase]);

  if (loadingAuth) return <Spinner />;
  if (!user) return <NotLoggedIn />;

  const email = user.email ?? "";
  const isAllowed = ALL_ADMIN_EMAILS.includes(email as (typeof ALL_ADMIN_EMAILS)[number]);
  if (!isAllowed) return <AccessDenied email={email} />;

  const isValidator = VALIDATOR_EMAILS.includes(email as (typeof VALIDATOR_EMAILS)[number]);
  const role = isValidator ? "Validateur" : "Créateur";

  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />
      <div className="flex-1 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">
              Admin <span className="text-amber-400">Panel</span>
            </h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Connecté en tant que{" "}
              <span className="text-amber-400/80">{role}</span>
              {" — "}{email}
            </p>
          </div>
          <Link href="/" className="text-sm text-gray-500 transition-colors hover:text-gray-300">
            ← Accueil
          </Link>
        </div>

        {isValidator
          ? <ValidatorView supabase={supabase} />
          : <CreatorView supabase={supabase} />
        }
      </div>
      </div>
    </main>
  );
}
