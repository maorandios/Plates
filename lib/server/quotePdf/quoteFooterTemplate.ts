/** Playwright/Puppeteer print footer (Hebrew + LTR page numbers) — matches server/pdf/render_quote_pdf.py */
const FOOTER_INSET_H_MM = 17.78 + 2.8;
const FOOTER_FONT_PT = Math.round((8.5 / 1.25) * 100) / 100;
const FOOTER_MUTED = "#6b6b6b";

export const QUOTE_PDF_FOOTER_TEMPLATE =
  `<div style="box-sizing:border-box;width:100%;margin:0;padding:0;">` +
  `<div style="margin:0;padding:0 ${FOOTER_INSET_H_MM}mm;box-sizing:border-box;">` +
  `<div style="` +
  `box-sizing:border-box;width:100%;margin:0;padding:0;border-top:1.5px solid #c9c9c9;` +
  `padding-top:2.5mm;font:500 ${FOOTER_FONT_PT}pt/1.3 'Segoe UI','Noto Sans Hebrew',` +
  `'Noto Sans',Tahoma,Arial,sans-serif;` +
  `color:${FOOTER_MUTED};` +
  `display:flex;flex-direction:row;justify-content:space-between;align-items:center;` +
  `">` +
  `<div style="flex:0 0 auto;direction:ltr;text-align:left;white-space:nowrap;` +
  `unicode-bidi:isolate;">` +
  `עמוד <span class="pageNumber"></span> מתוך <span class="totalPages"></span>` +
  `</div>` +
  `<div style="flex:0 1 auto;text-align:right;direction:rtl;min-width:0;` +
  `padding-inline-start:2mm;">` +
  `הצעת המחיר הזו הופקה באמצעות מערכת אומגות · ` +
  `<span style="unicode-bidi:isolate" dir="ltr">www.Omegot.com</span>` +
  `</div>` +
  `</div></div></div>`;

export const QUOTE_PDF_HEADER_TEMPLATE =
  `<div style="height:0;max-height:0;margin:0;padding:0;overflow:hidden;` +
  `line-height:0;font-size:0"></div>`;
