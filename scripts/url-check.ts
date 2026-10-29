const { normaliseUrl } = await import("../src/lib/fetchSite.ts");
for (const v of ["localhost:3000", "127.0.0.1", "https://foo", "", "not a website", "example.com"]) {
  console.log(JSON.stringify({ v, ...normaliseUrl(v), href: undefined, url: normaliseUrl(v).url?.href }));
}
