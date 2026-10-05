import { SampleAudio, SampleMedia } from "@/constants/media";
import { useAppStore } from "@/store/useAppStore";
import { createSeedProjects } from "@/store/seed";
import { findClip, splitClip, trimClip, projectDuration } from "@/utils/timeline";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const getProject = (id: string) => {
  const p = useAppStore.getState().projects.find((x) => x.id === id);
  if (!p) throw new Error("missing project");
  return p;
};

describe("editing journeys", () => {
  it("seeds projects with expected durations and track counts", () => {
    const seeds = createSeedProjects();
    expect(seeds.map((p) => [p.title, p.duration, p.tracks.length])).toEqual([
      ["Cyberpunk Tokyo Vlog", 222, 5],
      ["Morning Routine Short", 58, 4],
      ["Tech Review Intro", 75, 6],
      ["Podcast Ep 12 Highlight", 150, 3],
    ]);
  });

  it("creates a project, appends media, splits, trims, undoes and redoes", () => {
    const store = useAppStore.getState();
    const id = store.createProject({ title: "Test", aspectRatio: "9:16", frameRate: 60, starterMediaIds: [] });
    expect(getProject(id).resolution).toEqual({ width: 1080, height: 1920 });
    const v1 = getProject(id).tracks.find((t) => t.label === "V1");
    const a1 = getProject(id).tracks.find((t) => t.label === "A1");
    if (!v1 || !a1) throw new Error("tracks");

    const neon = SampleMedia.find((m) => m.name === "Neon City Night");
    const lofi = SampleAudio.find((m) => m.name === "Lo-Fi Chill Beat");
    if (!neon || !lofi) throw new Error("media");

    // emulate actions.addAsset → appendClip
    const { appendClip, buildClip } = jest.requireActual("@/utils/timeline");
    store.edit(id, "Add Clip", (t) => appendClip(t, v1.id, buildClip(neon, v1, 0)));
    store.edit(id, "Add Clip", (t) => appendClip(t, a1.id, buildClip(lofi, a1, 0)));
    expect(getProject(id).duration).toBe(90);

    const clipId = getProject(id).tracks.find((t) => t.id === v1.id)?.clips[0].id as string;
    let rightId = "";
    store.edit(id, "Split Clip", (t) => {
      const r = splitClip(t, clipId, 15);
      if (!r) throw new Error("split failed");
      rightId = r.rightId;
      return r.tracks;
    });
    const v1Clips = () => getProject(id).tracks.find((t) => t.id === v1.id)?.clips ?? [];
    expect(v1Clips().map((c) => [c.startTime, c.duration, c.inPoint, c.outPoint])).toEqual([
      [0, 15, 0, 15],
      [15, 15, 15, 30],
    ]);

    // trim the tail of the right segment by 1.5s, as a live drag then commit
    const snapshot = getProject(id).tracks;
    store.edit(id, "Trim Out-Point", () => trimClip(snapshot, rightId, "out", -0.75), "live");
    store.edit(id, "Trim Out-Point", () => trimClip(snapshot, rightId, "out", -1.5), "live");
    store.endLiveEdit(id, "Trim Out-Point");
    expect(findClip(getProject(id).tracks, rightId)?.clip.outPoint).toBe(28.5);
    expect(getProject(id).history.past.map((h) => h.label)).toEqual(["Add Clip", "Add Clip", "Split Clip", "Trim Out-Point"]);

    expect(store.undo(id)).toBe("Trim Out-Point");
    expect(findClip(getProject(id).tracks, rightId)?.clip.outPoint).toBe(30);
    expect(store.undo(id)).toBe("Split Clip");
    expect(v1Clips()).toHaveLength(1);
    expect(store.redo(id)).toBe("Split Clip");
    expect(v1Clips()).toHaveLength(2);
    expect(store.redo(id)).toBe("Trim Out-Point");
    expect(findClip(getProject(id).tracks, rightId)?.clip.outPoint).toBe(28.5);
    expect(projectDuration(getProject(id).tracks)).toBe(90);
  });

  it("trims the head of a clip by adjusting the in-point", () => {
    const [p] = createSeedProjects();
    const v1 = p.tracks.find((t) => t.label === "V1");
    const second = v1?.clips[1];
    if (!second) throw new Error("clip");
    const next = trimClip(p.tracks, second.id, "in", 2);
    const c = findClip(next, second.id)?.clip;
    expect(c?.inPoint).toBe(2);
    expect(c?.startTime).toBe(second.startTime + 2);
    expect(c?.duration).toBe(second.duration - 2);
  });
});
