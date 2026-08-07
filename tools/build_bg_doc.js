const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
} = require('docx');

const CW = 9360; // US Letter content width @ 1" margins
const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const borders = { top: border, bottom: border, left: border, right: border };
const HEAD_FILL = "2E3440";
const ALT_FILL = "F2F4F8";

function cell(text, w, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text: String(text), bold: !!opts.bold, color: opts.color || "222222", font: opts.mono ? "Consolas" : "Arial", size: opts.size || 20 })];
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: runs })],
  });
}
function headRow(labels, widths) {
  return new TableRow({
    tableHeader: true,
    children: labels.map((l, i) => cell([new TextRun({ text: l, bold: true, color: "FFFFFF", font: "Arial", size: 20 })], widths[i], { fill: HEAD_FILL })),
  });
}
function dataRow(cells, widths, i) {
  const fill = (i % 2 === 1) ? ALT_FILL : undefined;
  return new TableRow({ children: cells.map((c, j) => cell(c.t, widths[j], { mono: c.mono, bold: c.bold, fill, color: c.color, size: 19 })) });
}
function makeTable(widths, header, rows) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headRow(header, widths), ...rows.map((r, i) => dataRow(r, widths, i))],
  });
}
const H = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const P = (t, opts = {}) => new Paragraph({ spacing: { after: opts.after != null ? opts.after : 120 }, children: [new TextRun({ text: t, italics: !!opts.italics, color: opts.color || "333333", size: opts.size || 20 })] });

// ---- Data ----
const W2 = [5760, 3600];
const generic = [
  [{ t: "Gelwater Grotto", bold: true }, { t: "bg_v3_dungeon.png", mono: true }],
  [{ t: "Octopus Grotto", bold: true }, { t: "bg_v3_dungeon.png", mono: true }],
  [{ t: "Lava Cavern", bold: true }, { t: "bg_v3_dungeon.png", mono: true }],
  [{ t: "Koopa Throne", bold: true }, { t: "bg_v3_dungeon.png", mono: true }],
  [{ t: "Abyssal Trench", bold: true }, { t: "bg_v3_dungeon.png", mono: true }],
  [{ t: "Coral Reef Depths", bold: true }, { t: "bg_v3_misty.png", mono: true }],
  [{ t: "Sunken Kelp Forest", bold: true }, { t: "bg_v3_misty.png", mono: true }],
  [{ t: "Bubblebloom Grotto", bold: true }, { t: "bg_v3_misty.png", mono: true }],
  [{ t: "Sunset Coast", bold: true }, { t: "bg_v3_meadow.png", mono: true }],
  [{ t: "Wildflower Plains", bold: true }, { t: "bg_v3_meadow.png", mono: true }],
  [{ t: "Granite Bluffs", bold: true }, { t: "bg_v3_valley.png", mono: true }],
  [{ t: "The Inner Dimension", bold: true }, { t: "bg_v3_galaxy.png", mono: true }],
  [{ t: "Celestial Spire", bold: true }, { t: "bg_v3_galaxy.png", mono: true }],
  [{ t: "Queen's Hollow", bold: true }, { t: "bg_v3_cinematic_zodiac_1.png", mono: true }],
  [{ t: "Sky Garden", bold: true }, { t: "bg_v3_cinematic_zodiac_2.png", mono: true }],
];

const W3 = [3360, 3600, 2400];
const reused = [
  [{ t: "Fungal Hollow", bold: true }, { t: "bg_v3_forest.png", mono: true }, { t: "Emerald Thicket" }],
  [{ t: "Elderwood Grove", bold: true }, { t: "bg_v3_forest.png", mono: true }, { t: "Emerald Thicket" }],
  [{ t: "Bone Graveyard — Mossy Reaches", bold: true }, { t: "bg_v3_cryptHollow.png", mono: true }, { t: "Crypt of Whispers" }],
  [{ t: "Bone Graveyard — Sundered Catacomb", bold: true }, { t: "bg_v3_cryptHollow.png", mono: true }, { t: "Crypt of Whispers" }],
  [{ t: "Bone Graveyard — Lich Reaches", bold: true }, { t: "bg_v3_cryptHollow.png", mono: true }, { t: "Crypt of Whispers" }],
  [{ t: "Tidepool Shoals", bold: true }, { t: "bg_v3_pearlBathhouse.png", mono: true }, { t: "Pearl Bathhouse" }],
  [{ t: "Storm Crest", bold: true }, { t: "bg_v3_thunderPlateau.png", mono: true }, { t: "Thunder Plateau" }],
  [{ t: "The Endless Express", bold: true }, { t: "bg_v3_carriageOfAscension.png", mono: true }, { t: "Carriage of Ascension" }],
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: "1A1A1A", font: "Arial" }, paragraph: { spacing: { after: 80 } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "2E3440", font: "Arial" }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: [
      new Paragraph({ style: "Title", children: [new TextRun("Mojiworld — Maps Without a Unique Background")] }),
      P("These maps currently render a shared or generic background image. Each row shows the map and the image file it falls back to — i.e. the ones to generate dedicated art for.", { italics: true, color: "555555", after: 60 }),
      P("Audited against the BG_IMAGES table and the backgrounds/ folder. 23 maps total (15 generic + 8 reused), plus the two optional groups noted at the end.", { color: "555555", after: 160 }),

      H("A. Generic / cinematic fallback — no map-specific art (15)"),
      makeTable(W2, ["Map", "Shares image"], generic),

      H("B. Reusing another biome's image (8)"),
      makeTable(W3, ["Map", "Borrows image", "Image belongs to"], reused),

      H("C. Intentionally shared — by design (7)"),
      P("The seven Block-land maps all share bg_v3_blockland.png on purpose (Toy Meadow, Brick Grove, Foamblock Flats, Brick Quarry, Toy Outpost, Tigreal's Citadel, Apex). Generate per-map art only if you want to break the shared toy-box look."),

      H("D. No background image"),
      P("The Void uses bg:'voidBlack' — a procedural black screen with no image file. Likely intentional; generate art only if you want a painted void."),

      H("How to wire new art"),
      P("For each map: save the PNG as backgrounds/bg_v3_<key>.png, add a line to BG_IMAGES (≈ line 60930), and set the map's bg:'<key>'. Natural keys mirror the map ids (lavaCavern, coralReef, sunsetBeach, boneGraveyard, skyGarden, …)."),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("Mojiworld_Maps_Missing_Backgrounds.docx", buf);
  console.log("WROTE Mojiworld_Maps_Missing_Backgrounds.docx (" + buf.length + " bytes)");
});
