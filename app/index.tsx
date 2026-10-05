import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { NewProjectModal } from "@/components/dashboard/new-project-modal";
import { PresetCard } from "@/components/dashboard/preset-card";
import { ProjectCard } from "@/components/dashboard/project-card";
import { StorageCard } from "@/components/dashboard/storage-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState, MessageState } from "@/components/ui/state-views";
import { useToast } from "@/components/ui/toast";
import { type QuickPreset, QuickPresets } from "@/constants/presets";
import { Fonts } from "@/constants/Typography";
import { makeStyles } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { type NewProjectInput, useAppStore } from "@/store/useAppStore";

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, colors } = useTheme();
  const s = useStyles(theme);
  const hydrated = useAppStore((st) => st.hasHydrated);
  const projects = useAppStore((st) => st.projects);
  const userMedia = useAppStore((st) => st.userMedia);
  const view = useAppStore((st) => st.preferences.projectView);
  const setPreference = useAppStore((st) => st.setPreference);
  const createProject = useAppStore((st) => st.createProject);
  const duplicateProject = useAppStore((st) => st.duplicateProject);
  const deleteProject = useAppStore((st) => st.deleteProject);
  const { toastNode, showToast } = useToast();

  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [preset, setPreset] = useState<QuickPreset | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const compact = width < 560;
  const wide = width >= 760;
  const columns = wide && view === "grid" ? 2 : 1;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return q ? list.filter((p) => p.title.toLowerCase().includes(q)) : list;
  }, [projects, query]);

  const rows = useMemo(() => {
    const out: (typeof filtered)[] = [];
    for (let i = 0; i < filtered.length; i += columns) out.push(filtered.slice(i, i + columns));
    return out;
  }, [filtered, columns]);

  const openNew = useCallback((p: QuickPreset | null) => {
    setPreset(p);
    setModalKey((k) => k + 1);
    setModalOpen(true);
  }, []);

  const handleCreate = useCallback(
    (input: NewProjectInput) => {
      try {
        const id = createProject({ ...input });
        setModalOpen(false);
        router.push({ pathname: "/editor", params: { id } });
      } catch (e) {
        console.error("Create project failed", e);
        showToast("Could not create project. Try again.", "error");
      }
    },
    [createProject, router, showToast],
  );

  const handleEdit = useCallback((id: string) => router.push({ pathname: "/editor", params: { id } }), [router]);

  const handleDuplicate = useCallback(
    (id: string) => {
      const copy = duplicateProject(id);
      showToast(copy ? "Project duplicated" : "Project not found", copy ? "success" : "error");
    },
    [duplicateProject, showToast],
  );

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const title = projects.find((p) => p.id === pendingDelete)?.title ?? "Project";
    deleteProject(pendingDelete);
    setPendingDelete(null);
    showToast(`Deleted "${title}"`, "success");
  }, [pendingDelete, projects, deleteProject, showToast]);

  if (!hydrated) return <LoadingState label="Restoring your projects…" />;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.inner}>
          <DashboardHeader onNewProject={() => openNew(null)} compact={compact} />

          <View style={s.search}>
            <Ionicons name="search-outline" size={19} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search projects..."
              placeholderTextColor={colors.muted}
              style={s.searchInput}
              accessibilityLabel="Search projects"
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <View>
            <Text style={s.h2}>Quick Start</Text>
            <Text style={s.h2Sub}>Create a new project from a preset</Text>
          </View>
          {wide ? (
            <View style={s.presetRow}>
              {QuickPresets.map((p) => (
                <PresetCard key={p.id} preset={p} onPress={openNew} />
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.presetScroll} contentContainerStyle={s.presetScrollContent}>
              {QuickPresets.map((p) => (
                <PresetCard key={p.id} preset={p} onPress={openNew} width={122} />
              ))}
            </ScrollView>
          )}

          <View style={s.recentHeader}>
            <Text style={s.h2}>Recent Projects</Text>
            <View style={s.viewToggle} accessibilityRole="radiogroup" accessibilityLabel="Project layout">
              {(["grid", "list"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setPreference("projectView", v)}
                  accessibilityRole="radio"
                  accessibilityLabel={v === "grid" ? "Grid view" : "List view"}
                  accessibilityState={{ checked: view === v }}
                  hitSlop={6}
                >
                  <View style={[s.viewBtn, view === v && { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
                    <Ionicons name={v === "grid" ? "grid" : "list"} size={16} color={view === v ? colors.text : colors.muted} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {filtered.length === 0 ? (
            <View style={s.emptyCard}>
              <MessageState
                fill={false}
                icon={query ? "search-outline" : "film-outline"}
                title={query ? "No matching projects" : "No projects yet"}
                message={query ? `Nothing matches "${query}". Try another title.` : "Start from a preset above or create a blank project."}
                actionLabel={query ? "Clear search" : "New Project"}
                onAction={query ? () => setQuery("") : () => openNew(null)}
              />
            </View>
          ) : (
            <View style={s.grid}>
              {rows.map((row) => (
                <View key={row.map((p) => p.id).join("-")} style={s.gridRow}>
                  {row.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      layout={view === "list" ? "list" : "grid"}
                      onEdit={handleEdit}
                      onDuplicate={handleDuplicate}
                      onDelete={setPendingDelete}
                    />
                  ))}
                  {row.length < columns ? <View style={s.flex} /> : null}
                </View>
              ))}
            </View>
          )}

          <StorageCard projects={projects} userMedia={userMedia} />
        </View>
      </ScrollView>

      <NewProjectModal key={modalKey} visible={modalOpen} preset={preset} onClose={() => setModalOpen(false)} onCreate={handleCreate} />
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete project?"
        message={`"${projects.find((p) => p.id === pendingDelete)?.title ?? ""}" and its timeline will be permanently removed from this device.`}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      {toastNode}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 14, alignItems: "center" },
  inner: { width: "100%", maxWidth: 1080, gap: 18 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, height: 44, color: c.text, fontFamily: Fonts.regular, fontSize: 15 },
  h2: { fontFamily: Fonts.bold, fontSize: 21, color: c.text, letterSpacing: -0.3 },
  h2Sub: { fontFamily: Fonts.regular, fontSize: 14, color: "#8B9CD8", marginTop: 2 },
  presetRow: { flexDirection: "row", gap: 10, marginTop: -6 },
  presetScroll: { flexGrow: 0, marginHorizontal: -14, marginTop: -6 },
  presetScrollContent: { paddingHorizontal: 14, gap: 10 },
  recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  viewToggle: { flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 3, gap: 2 },
  viewBtn: { width: 36, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  grid: { gap: 12, marginTop: -6 },
  gridRow: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  emptyCard: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border },
}));
