export const dynamic = "force-static";

export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok", ts: new Date().toISOString() }),
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}
