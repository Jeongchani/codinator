import { readFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.AI_SMOKE_BASE_URL || "http://127.0.0.1:8000/api/v3/analyze-image";
const root = path.resolve(process.cwd());
const projectRoot = path.resolve(root, "..", "..");
const samples = [
  path.join(projectRoot, "apps/api/uploads/seeds/posts/open-post-1.jpg"),
  path.join(projectRoot, "apps/api/uploads/seeds/posts/open-post-2.jpg"),
  path.join(projectRoot, "apps/api/uploads/seeds/posts/ranked-post-1.jpg"),
];

for (const filePath of samples) {
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("image", new Blob([bytes]), path.basename(filePath));

  const response = await fetch(baseUrl, { method: "POST", body: form });
  const json = await response.json();

  console.log("=".repeat(80));
  console.log(path.basename(filePath));
  console.log("status =", response.status);
  console.log("success =", json.success);
  console.log("pipelineVersion =", json.pipelineVersion);
  console.log("captionFallbackUsed =", json.meta?.captionFallbackUsed);
  console.log("warnings =", json.meta?.warnings);
  console.log("summaryTags =", json.analysis?.summaryTags);
  console.log("garments =");
  for (const garment of json.analysis?.garments ?? []) {
    console.log({
      category: garment.category,
      normalizedCategory: garment.normalizedCategory,
      parserLabel: garment.parserLabel,
      dominantColor: garment.dominantColor,
      areaRatio: garment.areaRatio,
      confidence: garment.confidence,
      bbox: garment.bbox,
    });
  }
}
