export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const symbol = searchParams.get("symbol") || "VALE3:BVMF";
  const interval = searchParams.get("interval") || "1week";

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&apikey=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  return Response.json(data);
}