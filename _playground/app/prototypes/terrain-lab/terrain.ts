import type { Settings } from "./types";
export function wireframe({ elevation, frequency, seed }: Settings) {
  const rows = 60,
    cols = 65,
    phase = seed * 0.17;
  function at(i: number, j: number) {
    const x = (i / cols) * 2 - 1,
      z = (j / rows) * 2 - 1;
    const scale = frequency / 38;
    const ridge =
      Math.cos(4 * x * scale + 2 * z + phase) * 0.16 +
      Math.sin(7 * z * scale - x + phase) * 0.12 +
      Math.sin(10 * x + 6 * z + phase) * 0.055 +
      Math.cos(18 * z - 8 * x) * 0.025;
    const hill = (a: number, b: number, width: number) =>
      Math.exp(-((x - a) ** 2 + (z - b) ** 2) * width);
    const envelope = Math.max(0, (1 - x * x) * (1 - z * z));
    const height =
      envelope *
      (0.3 +
        ridge +
        hill(-0.28, -0.18, 8) * 0.89 +
        hill(0.36, 0.08, 12) * 0.63);
    return [
      (350 + x * 219 + z * 82).toFixed(1),
      (251 + z * 67 - x * 27 - height * elevation * 1.72).toFixed(1),
    ].join(",");
  }
  const lines = [];
  for (let j = 0; j < rows; j++) {
    const front = Array.from({ length: cols + 1 }, (_, i) => at(i, j + 1));
    const back = Array.from({ length: cols + 1 }, (_, i) => at(i, j));
    const stitches = back
      .filter((_, i) => i % 2 === 0)
      .map((p, i) => "M" + p + "L" + front[i * 2])
      .join(" ");
    lines.push({
      strip: "M" + back.join("L") + "L" + [...front].reverse().join("L") + "Z",
      line: "M" + front.join("L"),
      stitches,
    });
  }
  return lines;
}
