import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT =
  `Tu es un assistant pédagogique. Analyse ce document et génère des questions de quiz pertinentes. Réponds UNIQUEMENT en JSON valide avec ce format exact : {"questions": [{"type": "mcq", "question": "...", "options": ["A", "B", "C", "D"], "answer_index": 0, "explanation": "...", "period": "Antiquité"}, {"type": "truefalse", "question": "...", "options": ["Vrai", "Faux"], "answer_index": 0, "explanation": "...", "period": "Moyen Âge"}]}. Génère entre 5 et 15 questions variées (mix QCM et Vrai/Faux). Les questions doivent être claires, pédagogiques et directement liées au contenu du document. Pour chaque question, détecte automatiquement la période historique parmi : Préhistoire, Antiquité, Moyen Âge, Renaissance, XVIe siècle, XVIIe siècle, XVIIIe siècle, XIXe siècle, XXe siècle, XXIe siècle, Autre.`;

type ExtractedQuestion = {
  type: "mcq" | "truefalse";
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  period: string;
};

export async function POST(req: NextRequest) {
  try {
    const { pdf } = (await req.json()) as { pdf?: string };

    if (!pdf) {
      return NextResponse.json({ error: "Champ pdf manquant" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf,
              },
            },
            {
              type: "text",
              text: "Génère les questions de quiz basées sur ce document.",
            },
          ],
        },
      ],
    });

    const rawText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Réponse invalide du modèle" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      questions: ExtractedQuestion[];
    };

    if (!Array.isArray(parsed.questions)) {
      return NextResponse.json(
        { error: "Format de réponse inattendu" },
        { status: 500 }
      );
    }

    return NextResponse.json({ questions: parsed.questions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
