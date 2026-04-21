export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const symbol = searchParams.get("symbol") || "PETR4.SA";
    const interval = searchParams.get("interval") || "1wk";
    const range = searchParams.get("range") || "1y";

    const allowedIntervals = [
      "1m",
      "2m",
      "5m",
      "15m",
      "30m",
      "60m",
      "90m",
      "1h",
      "1d",
      "5d",
      "1wk",
      "1mo",
      "3mo",
    ];

    const allowedRanges = [
      "1d",
      "5d",
      "1mo",
      "3mo",
      "6mo",
      "1y",
      "2y",
      "5y",
      "10y",
      "ytd",
      "max",
    ];

    if (!allowedIntervals.includes(interval)) {
      return Response.json(
        {
          error: true,
          message: `Intervalo inválido: ${interval}`,
          details: `Use um destes: ${allowedIntervals.join(", ")}`,
          symbol,
          interval,
          range,
        },
        { status: 400 }
      );
    }

    if (!allowedRanges.includes(range)) {
      return Response.json(
        {
          error: true,
          message: `Range inválido: ${range}`,
          details: `Use um destes: ${allowedRanges.join(", ")}`,
          symbol,
          interval,
          range,
        },
        { status: 400 }
      );
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?interval=${interval}&range=${range}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json(
        {
          error: true,
          message: "Falha ao consultar o provedor de dados.",
          details: `HTTP ${res.status}`,
          symbol,
          interval,
          range,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    const result = data?.chart?.result?.[0];
    const error = data?.chart?.error;
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp;

    if (error) {
      return Response.json(
        {
          error: true,
          message: error?.description || "Erro retornado pelo provedor.",
          symbol,
          interval,
          range,
        },
        { status: 400 }
      );
    }

    if (!result || !quote || !timestamps) {
      return Response.json(
        {
          error: true,
          message: "Resposta sem dados suficientes para montar candles.",
          symbol,
          interval,
          range,
        },
        { status: 404 }
      );
    }

    return Response.json({
      error: false,
      symbol,
      interval,
      range,
      chart: data.chart,
    });
  } catch (err) {
    return Response.json(
      {
        error: true,
        message: "Erro interno ao buscar histórico.",
        details: err instanceof Error ? err.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}