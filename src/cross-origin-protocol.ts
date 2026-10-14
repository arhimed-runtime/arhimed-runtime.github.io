export const CROSS_ORIGIN_PROTOCOL = "arhimed-runtime-v1" as const;
export const CROSS_ORIGIN_MAX_SOURCE_BYTES = 16_384;

export type RuntimeCommand = {
  protocol: typeof CROSS_ORIGIN_PROTOCOL;
  sessionId: string;
  revision: number;
  requestId: string;
  kind: "probe" | "run" | "cancel";
  source?: string;
  label?: "simple" | "reactive" | "restart";
};

export type RuntimeEvent = {
  protocol: typeof CROSS_ORIGIN_PROTOCOL;
  sessionId: string;
  revision: number;
  requestId: string;
  kind: "ready" | "status" | "probe" | "rendered" | "stopped" | "failed" | "rejected";
  detail: string;
  data?: Record<string, boolean | number | string | null>;
};

export const SIMPLE_SCENE = `import manimgx as m

class CrossOriginScene(m.Scene):
    def construct(self):
        circle = m.Circle(color=m.BLUE, fill_opacity=0.3)
        label = m.Text("Cross-origin ManimGX").next_to(circle, m.DOWN)
        self.play(m.Create(circle), m.Write(label), run_time=0.2)
        self.wait(0.1)
`;

export const REACTIVE_SCENE = `import manimgx as m

class ReactiveScene(m.Scene):
    def construct(self):
        value = m.ValueTracker(0)
        dot = m.always_redraw(lambda: m.Dot(point=[value.get_value() - 1, 0, 0], color=m.YELLOW))
        self.add(dot)
        self.play(value.animate.set_value(2), run_time=0.25)
        self.wait(0.1)
`;
