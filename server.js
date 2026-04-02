import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const N2YO_API_KEY = process.env.N2YO_API_KEY;

const KNOWN_SATS = [
  { name: "ISS (ZARYA)", noradId: 25544, category: "Space Station" },
  { name: "HUBBLE SPACE TELESCOPE", noradId: 20580, category: "Science" },
  { name: "NOAA 19", noradId: 33591, category: "Weather" }
];

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "satops-api" });
});

app.get("/routes-check", (_req, res) => {
  res.json({
    ok: true,
    routes: ["/", "/routes-check", "/satelliteSearch", "/getSatellitePosition"]
  });
});

app.post("/satelliteSearch", async (req, res) => {
  try {
    const query = String(req.body?.query || "").trim();

    if (!query) {
      return res.json({ results: [] });
    }

    if (/^\d+$/.test(query)) {
      return res.json({
        results: [
          {
            name: `NORAD ${query}`,
            noradId: Number(query),
            category: "Unknown"
          }
        ]
      });
    }

    const q = query.toLowerCase();
    const results = KNOWN_SATS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.noradId).includes(q)
    );

    return res.json({ results });
  } catch (err) {
    return res.status(500).json({
      error: "Search failed",
      details: err.message
    });
  }
});

app.post("/getSatellitePosition", async (req, res) => {
  try {
    const noradId = Number(req.body?.noradId);

    if (!noradId) {
      return res.status(400).json({ error: "noradId is required" });
    }

    if (!N2YO_API_KEY) {
      return res.status(500).json({ error: "N2YO_API_KEY missing" });
    }

    const observerLat = 34.0522;
    const observerLng = -118.2437;
    const observerAlt = 71;
    const seconds = 1;

    const url =
      `https://api.n2yo.com/rest/v1/satellite/positions/${noradId}` +
      `/${observerLat}/${observerLng}/${observerAlt}/${seconds}/?apiKey=${N2YO_API_KEY}`;

    const response = await fetch(url);
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        error: "N2YO returned non-JSON",
        details: text.slice(0, 300)
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: "N2YO request failed",
        details: data
      });
    }

    const info = data.info || {};
    const pos = data.positions?.[0];

    if (!pos) {
      return res.status(404).json({
        error: "No satellite position returned",
        details: data
      });
    }

    return res.json({
      name: info.satname || `NORAD ${noradId}`,
      noradId: info.satid || noradId,
      latitude: pos.satlatitude,
      longitude: pos.satlongitude,
      altitude: pos.sataltitude,
      velocity: pos.satvelocity,
      timestamp: pos.timestamp
        ? new Date(pos.timestamp * 1000).toISOString()
        : new Date().toISOString(),
      source: "N2YO"
    });
  } catch (err) {
    return res.status(500).json({
      error: "Position fetch failed",
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`satops-api running on port ${PORT}`);
});
