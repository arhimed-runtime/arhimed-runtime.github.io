export const PROTOCOL_VERSION = 1 as const;
export const MAX_SOURCE_BYTES = 16_384;

export type ParentCommand = {
  protocol: typeof PROTOCOL_VERSION;
  kind: "run" | "cancel" | "probe";
  requestId: string;
  revision: number;
  capability: string;
  source?: string;
};

export type SandboxEvent = {
  protocol: typeof PROTOCOL_VERSION;
  kind: "ready" | "status" | "result" | "rejected" | "probe";
  requestId: string;
  revision: number;
  capability: string;
  detail: string;
  data?: Record<string, boolean | string | number | null>;
};

export const SIMPLE_SCENE = `import manimgx as m

class LabScene(m.Scene):
    def construct(self):
        circle = m.Circle(color=m.BLUE, fill_opacity=0.35)
        label = m.Text("ArhimedGX")
        self.play(m.Create(circle), m.Write(label), run_time=0.2)
        self.wait(0.1)
`;
