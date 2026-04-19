export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const symbol = searchParams.get("symbol") || "PETR4.SA";
  const interval = searchParams.get("interval") || "1wk";
  const range = searchParams.get("range") || "1y";

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;

  const res = await fetch(url);
  const data = await res.json();

  return Response.json(data);
}