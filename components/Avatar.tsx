import { getSkinById } from "@/lib/skins";

export type AvatarSize = "sm" | "md" | "lg";

const SIZE_PX: Record<AvatarSize, number> = { sm: 32, md: 48, lg: 80 };

export function getLevelInfo(totalGames: number): { color: string; label: string } {
  if (totalGames >= 100) return { color: "#67e8f9", label: "💎 Diamant" };
  if (totalGames >= 50)  return { color: "#f59e0b", label: "🥇 Or" };
  if (totalGames >= 10)  return { color: "#94a3b8", label: "🥈 Argent" };
  return { color: "#a16207", label: "🥉 Bronze" };
}

type AvatarProfile = {
  avatar_color: string;
  active_skin:  string;
  user_name:    string;
};

export default function Avatar({
  profile,
  totalGames = 0,
  size = "md",
}: {
  profile:     AvatarProfile;
  totalGames?: number;
  size?:       AvatarSize;
}) {
  const px          = SIZE_PX[size];
  const { color: borderColor } = getLevelInfo(totalGames);
  const skin        = getSkinById(profile.active_skin);
  const strokeWidth = size === "lg" ? 2.5 : 2;
  const emojiTop    = Math.round(px * 0.05);
  const emojiFontSz = Math.round(px * 0.34);

  return (
    <div style={{ position: "relative", width: px, height: px, flexShrink: 0 }}>
      {/* Silhouette SVG — 80×80 viewBox, scaled to size */}
      <svg width={px} height={px} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background tint */}
        <circle cx="40" cy="40" r="39" fill={profile.avatar_color} opacity="0.15" />
        {/* Body arc */}
        <path
          d="M13 76 C13 57 25 50 40 50 C55 50 67 57 67 76"
          fill={profile.avatar_color}
          opacity="0.55"
        />
        {/* Head */}
        <circle cx="40" cy="28" r="16" fill={profile.avatar_color} />
        {/* Level border ring */}
        <circle cx="40" cy="40" r="38" stroke={borderColor} strokeWidth={strokeWidth} fill="none" />
      </svg>

      {/* Skin emoji — overlaid on the head area */}
      <div
        aria-hidden
        style={{
          position:      "absolute",
          top:           emojiTop,
          left:          "50%",
          transform:     "translateX(-50%)",
          fontSize:      emojiFontSz,
          lineHeight:    1,
          pointerEvents: "none",
          userSelect:    "none",
        }}
      >
        {skin.emoji}
      </div>
    </div>
  );
}
