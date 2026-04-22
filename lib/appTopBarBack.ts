/**
 * When non-null, show a back control in {@link AppTopBar} (logout slot) for the current path.
 */
export function getAppTopBarBack(
  pathname: string
):
  | {
      href: string;
      labelKey:
        | "quotePreview.backToList"
        | "projectPreview.backToList"
        | "clientDetail.back"
        | "common.back";
    }
  | null {
  if (/^\/quotes\/[^/]+\/preview$/.test(pathname)) {
    return { href: "/quotes", labelKey: "quotePreview.backToList" };
  }
  if (/^\/projects\/[^/]+\/preview$/.test(pathname)) {
    return { href: "/projects", labelKey: "projectPreview.backToList" };
  }
  if (
    /^\/settings\/(account|materials|bill-and-usage|units)(?:\/|$)/.test(
      pathname
    )
  ) {
    return { href: "/", labelKey: "common.back" };
  }
  const clientEdit = pathname.match(/^\/clients\/([^/]+)\/edit$/);
  if (clientEdit?.[1]) {
    return { href: `/clients/${clientEdit[1]}`, labelKey: "common.back" };
  }
  if (pathname === "/clients/new") {
    return { href: "/clients", labelKey: "clientDetail.back" };
  }
  const clientId = pathname.match(/^\/clients\/([^/]+)$/)?.[1];
  if (clientId && clientId !== "new") {
    return { href: "/clients", labelKey: "clientDetail.back" };
  }
  return null;
}
