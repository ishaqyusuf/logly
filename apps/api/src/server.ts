import app from "./app";

Bun.serve({ port: Number(process.env.PORT ?? 4100), fetch: app.fetch });
console.info(
  `Logly collector listening on http://localhost:${process.env.PORT ?? 4100}`,
);
