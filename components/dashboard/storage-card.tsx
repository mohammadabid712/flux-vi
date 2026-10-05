import { useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { findMedia } from "@/constants/media";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { MediaAsset, Project } from "@/store/types";
import { useSyncStore } from "@/store/sync-store";

const BUDGET_MB = 2048; // local media cache budget

const parseMb = (size: string): number => {
  const m = /([\d.]+)\s*(KB|MB|GB)/i.exec(size);
  if (!m) return 0;
  const n = Number.parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  return unit === "GB" ? n * 1024 : unit === "KB" ? n / 1024 : n;
};

const formatMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(mb < 10 ? 1 : 0)} MB`);

interface Props {
  projects: Project[];
  userMedia: MediaAsset[];
  /** Supabase storage used by the signed-in account; null in guest mode. */
  cloudUsedBytes: number | null;
  cloudQuotaBytes: number;
}

export function StorageCard({ projects, userMedia, cloudUsedBytes, cloudQuotaBytes }: Props) {
  const { theme, colors } = useTheme();
  const s = useStyles(theme);

  const stats = useMemo(() => {
    const ids = new Set<string>();
    let clips = 0;
    for (const p of projects)
      for (const t of p.tracks)
        for (const c of t.clips) {
          clips += 1;
          if (c.mediaId !== "text") ids.add(c.mediaId);
        }
    let mediaMb = 0;
    for (const id of ids) mediaMb += parseMb(findMedia(id, userMedia)?.fileSize ?? "0 MB");
    const projectMb = JSON.stringify(projects).length / (1024 * 1024);
    const cloud = cloudUsedBytes !== null;
    const used = cloud ? cloudUsedBytes / (1024 * 1024) + projectMb : mediaMb + projectMb;
    const budget = cloud ? cloudQuotaBytes / (1024 * 1024) : BUDGET_MB;
    return { used, budget, cloud, pct: Math.min(100, Math.round((used / budget) * 100)), clips, assets: ids.size };
  }, [projects, userMedia, cloudUsedBytes, cloudQuotaBytes]);

  const r = 30;
  const circ = 2 * Math.PI * r;
  const syncStatus = useSyncStore((st) => st.status);
  const syncBad = stats.cloud && syncStatus === "offline";
  const healthy = stats.pct < 85 && !syncBad;
  const healthText = syncBad
    ? "Cloud unreachable — edits kept locally"
    : stats.pct >= 85
      ? stats.cloud
        ? "Cloud quota almost full"
        : "Cache almost full"
      : stats.cloud
        ? syncStatus === "saved"
          ? "Sync healthy · all changes saved"
          : "Sync healthy · saving changes"
        : "All systems optimal";

  return (
    <View style={s.card}>
      <View style={s.left}>
        <View style={s.ring}>
          <Svg width={76} height={76} viewBox="0 0 76 76">
            <Circle cx={38} cy={38} r={r} stroke={colors.border} strokeWidth={6} fill="none" />
            <Circle
              cx={38}
              cy={38}
              r={r}
              stroke={healthy ? colors.cyan : colors.amber}
              strokeWidth={6}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(circ * Math.max(stats.pct, 1)) / 100} ${circ}`}
              transform="rotate(-90 38 38)"
            />
          </Svg>
          <Text style={s.pct}>{stats.pct}%</Text>
        </View>
        <View style={s.textCol}>
          <Text style={s.title}>{stats.cloud ? "Cloud Storage & Health" : "Device Storage & Performance"}</Text>
          <Text style={s.sub}>
            {stats.cloud
              ? `${formatMb(stats.used)} / ${formatMb(stats.budget)} used on Supabase`
              : `${formatMb(stats.used)} used of ${formatMb(stats.budget)} local cache`}
          </Text>
        </View>
      </View>
      <View style={s.divider} />
      <View style={s.right}>
        <View style={s.statusRow}>
          <View style={[s.dot, { backgroundColor: healthy ? colors.green : colors.amber }]} />
          <Text style={[s.status, { color: healthy ? colors.green : colors.amber }]}>
            {healthText}
          </Text>
        </View>
        <Text style={s.sub}>
          {projects.length} projects · {stats.clips} clips · {stats.assets} media assets
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 16,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 14, flexGrow: 1 },
  ring: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  pct: { position: "absolute", fontFamily: Fonts.semiBold, fontSize: 15, color: c.text },
  textCol: { gap: 4, flexShrink: 1 },
  title: { fontFamily: Fonts.semiBold, fontSize: 15, color: c.text },
  sub: { fontFamily: Fonts.regular, fontSize: 12.5, color: c.muted },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: c.border },
  right: { gap: 6, flexGrow: 1, paddingLeft: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontFamily: Fonts.medium, fontSize: 13 },
}));
