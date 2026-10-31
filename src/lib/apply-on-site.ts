// Postings that are applied for on a site rather than by email: a link in
// the posting, or an account on the job board it came from (emprego.co.mz
// takes applications with the CV kept there). The Email tab then says where
// and how, since there's no address to send the email to.

export type ApplyOnSite =
  /** A page to apply on, e.g. the employer's form or Kukwira's. */
  | { how: "link"; url: string; site: string }
  /** The job board's own application, with an account there. */
  | { how: "account"; url: string; site: string };

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// "Candidatura: <url>", as Dossier's emprego.co.mz and Kukwira adapters write it,
// and the ways postings say it: "Apply here: <url>", "Candidaturas através de <url>"…
const LINK_LINE =
  /^[ \t]*(?:candidatura|candidaturas|candidate-se|candidatar-se|apply|apply here|apply online|apply via|apply at|how to apply|to apply)\b[^\n]{0,60}?(https?:\/\/[^\s<>"')]+)/imu;

/** Where and how a posting is applied for on a site, or null when it says nothing of the kind. */
export function applyOnSite(postingText: string, postingUrl: string): ApplyOnSite | null {
  const link = LINK_LINE.exec(postingText)?.[1]?.replace(/[.,;:]+$/, "");
  if (link) return { how: "link", url: link, site: host(link) };
  if (/^Candidatura: com uma conta no emprego\.co\.mz\.?$/m.test(postingText)) {
    const url = host(postingUrl).endsWith("emprego.co.mz") ? postingUrl : "https://www.emprego.co.mz/";
    return { how: "account", url, site: "emprego.co.mz" };
  }
  return null;
}
