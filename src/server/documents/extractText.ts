export async function extractTextFromFile(args: {
  fileName: string;
  contentType: string;
  buffer: Buffer;
}): Promise<string> {
  const ct = args.contentType.toLowerCase();
  const name = args.fileName.toLowerCase();

  const isPdf = ct.includes("pdf") || name.endsWith(".pdf");
  if (isPdf) {
    // pdf-parse is CommonJS; use dynamic import to keep Next.js happy.
    const mod = (await import("pdf-parse")) as unknown as { default: (b: Buffer) => Promise<{ text: string }> };
    const pdfParse = mod.default;
    const data = await pdfParse(args.buffer);
    return (data.text ?? "").trim();
  }

  const isText =
    ct.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv");
  if (isText) {
    return args.buffer.toString("utf8").trim();
  }

  // Fallback: try UTF-8 decode.
  return args.buffer.toString("utf8").trim();
}


