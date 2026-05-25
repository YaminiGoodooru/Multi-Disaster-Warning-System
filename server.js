require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const xml2js = require("xml2js");
const cors = require("cors");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();

app.use(express.json());
app.use(cors());

mongoose
  .connect(
   process.env.MONGO_URI
  )
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  location: String,
});

const User = mongoose.model("User", userSchema, "Users");
const alertSchema = new mongoose.Schema({
  disaster_type: String,
  message: String,
  risk: Number,
  location: String,

  status: {
    type: String,
    default: "active",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Alert = mongoose.model("Alert", alertSchema, "Alerts");
const ML_API_URL =
  "https://multi-disaster-warning-system-production-2831.up.railway.app";

function getLastOneMinuteTimeRange() {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 1000);

  return {
    starttime: startTime.toISOString(),
    endtime: endTime.toISOString(),
  };
}

function formatEarthquakes(features) {
  return features.map((item) => {
    const props = item.properties;
    const coords = item.geometry.coordinates;

    return {
      disaster_type: "earthquake",
      magnitude: props.mag,
      place: props.place,
      time: new Date(props.time).toISOString(),
      latitude: coords[1],
      longitude: coords[0],
      depth: coords[2],
      tsunami: props.tsunami,
      alert: props.alert,
      significance: props.sig,
      status: props.status,
      event_id: item.id,
      risk_level: props.mag >= 6 ? "High" : props.mag >= 4 ? "Medium" : "Low",
    };
  });
}

function formatFloods(data) {
  const daily = data.daily;

  return daily.time.slice(0, 7).map((date, index) => {
    const riverDischarge = daily.river_discharge[index];
    const riverDischargeMean = daily.river_discharge_mean[index];

    return {
      disaster_type: "flood",
      forecast_date: date,
      latitude: data.latitude,
      longitude: data.longitude,
      river_discharge: riverDischarge,
      river_discharge_mean: riverDischargeMean,
      water_flow_rate: riverDischarge,
      risk_level: riverDischarge > riverDischargeMean * 1.5 ? "High" : "Low",
    };
  });
}

async function formatCyclones(xmlData) {
  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(xmlData);

  let items = result.rss.channel.item || [];

  if (!Array.isArray(items)) {
    items = [items];
  }

  return items.map((item) => {
    const windSpeed = Number(item["gdacs:severity"]?.$?.value) || 0;

    return {
      disaster_type: "cyclone",
      cyclone_name: item.title || null,
      category_text: item["gdacs:severity"]?._ || null,
      wind_speed: windSpeed,
      pressure: null,
      latitude: Number(item["geo:Point"]?.["geo:lat"]) || null,
      longitude: Number(item["geo:Point"]?.["geo:long"]) || null,
      movement_direction: null,
      severity_text: item["gdacs:severity"]?._ || null,
      affected_country: item["gdacs:country"] || null,
      advisory_text: item.description || null,
      event_time: item.pubDate || null,
      risk_level: windSpeed >= 120 ? "High" : "Low",
    };
  });
}

async function fetchAllDisasterData() {
  const { starttime, endtime } = getLastOneMinuteTimeRange();

  const earthquakeUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${starttime}&endtime=${endtime}`;

  const floodUrl =
    "https://flood-api.open-meteo.com/v1/flood?latitude=12.9716&longitude=77.5946&daily=river_discharge,river_discharge_mean";

  const cycloneUrl = "https://www.gdacs.org/xml/rss_tc_7d.xml";

  const [earthquakeResponse, floodResponse, cycloneResponse] =
    await Promise.all([
      axios.get(earthquakeUrl),
      axios.get(floodUrl),
      axios.get(cycloneUrl),
    ]);

  const earthquakes = formatEarthquakes(earthquakeResponse.data.features || []);
  const floods = formatFloods(floodResponse.data);
  const cyclones = await formatCyclones(cycloneResponse.data);

  return {
    starttime,
    endtime,
    earthquakes,
    floods,
    cyclones,
  };
}

function getEarthquakePayload(earthquakes) {
  if (earthquakes.length > 0) {
    const eq = earthquakes[0];

    return {
      magnitude: Number(eq.magnitude) || 0,
      depth: Number(eq.depth) || 0,
      tsunami: Number(eq.tsunami) || 0,
      significance: Number(eq.significance) || 0,
      latitude: Number(eq.latitude) || 0,
      longitude: Number(eq.longitude) || 0,
    };
  }

  return {
    magnitude: 6.5,
    depth: 10,
    tsunami: 1,
    significance: 600,
    latitude: 17.5,
    longitude: 78.4,
  };
}

function getFloodPayload() {
  return {
    MonsoonIntensity: 8,
    TopographyDrainage: 7,
    RiverManagement: 3,
    Deforestation: 6,
    Urbanization: 7,
    ClimateChange: 8,
    DamsQuality: 2,
    Siltation: 5,
    AgriculturalPractices: 4,
    Encroachments: 3,
    IneffectiveDisasterPreparedness: 6,
    DrainageSystems: 5,
    CoastalVulnerability: 7,
    Landslides: 4,
    Watersheds: 3,
    DeterioratingInfrastructure: 4,
    PopulationScore: 6,
    WetlandLoss: 5,
    InadequatePlanning: 3,
    PoliticalFactors: 4,
  };
}

function getCyclonePayload(cyclones) {
  if (cyclones.length > 0) {
    const cyclone = cyclones[0];

    return {
      pressure: String(cyclone.pressure || 920),
      category: "3",
      severity: cyclone.risk_level === "High" ? "3" : "2",
      latitude: String(cyclone.latitude || 15.5),
      longitude: String(cyclone.longitude || 80.3),
    };
  }

  return {
    pressure: "920",
    category: "3",
    severity: "2",
    latitude: "15.5",
    longitude: "80.3",
  };
}
async function sendEmailAlert(toEmail, subject, message) {
  try {
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: toEmail,
      subject: subject,
      html: `
  <div style="font-family: Arial; padding: 20px; background-color: #f8f9fa;">

    <h1 style="color: red;">
      🚨 Disaster Alert Notification
    </h1>

    <p style="font-size: 18px; color: #333;">
      <b>${subject}</b>
    </p>

    <div style="
      background-color: #ffe5e5;
      padding: 15px;
      border-radius: 10px;
      margin-top: 15px;
    ">

      <h2 style="color: darkred;">
        ⚠️ Risk Level: HIGH
      </h2>

      <p style="font-size: 16px;">
        ${message}
      </p>

    </div>

    <p style="margin-top: 20px; color: gray;">
      Disaster Management System
    </p>

  </div>
`
    });

    console.log(`📧 Email alert sent to ${toEmail}`);
  } catch (err) {
    console.log(`❌ Email failed for ${toEmail}:`, err.message);
  }
}

async function saveAlert(disasterType, mlResponse, location = "Unknown") {
  if (mlResponse.risk === 1) {
    const existingAlert = await Alert.findOne({
      disaster_type: disasterType,
      location: location,
      risk: 1,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    });

    if (existingAlert) {
      console.log(`⚠️ Duplicate ${disasterType} alert skipped`);
      return;
    }

    const newAlert = new Alert({
      disaster_type: disasterType,
      message: mlResponse.message,
      risk: mlResponse.risk,
      location: location,
    });

    await newAlert.save();

    console.log(`🚨 New ${disasterType} alert saved`);

    const users = await User.find({
      email: { $exists: true, $ne: "" },
    });

    for (const user of users) {
      await sendEmailAlert(
        user.email,
        `${disasterType} High Risk Alert`,
        `🚨 ${disasterType} detected in ${location}. Risk level is HIGH. Please stay safe.`
      );
    }
  }
}
async function checkMLRiskAndCreateAlerts() {
  try {
    console.log("🔄 Checking disaster risk automatically...");

    const { earthquakes, floods, cyclones } = await fetchAllDisasterData();

    const earthquakePayload = getEarthquakePayload(earthquakes);
    const floodPayload = getFloodPayload();
    const cyclonePayload = getCyclonePayload(cyclones);

    const [earthquakeML, floodML, cycloneML] = await Promise.all([
      axios.post(`${ML_API_URL}/predict/earthquake`, earthquakePayload),
      axios.post(`${ML_API_URL}/predict/flood`, floodPayload),
      axios.post(`${ML_API_URL}/predict/cyclone`, cyclonePayload),
    ]);

    await saveAlert("Earthquake", earthquakeML.data, "Hyderabad");
    await saveAlert("Flood", floodML.data, "Bangalore");
    await saveAlert("Cyclone", cycloneML.data, "Coastal Area");

    if (
      earthquakeML.data.risk === 1 ||
      floodML.data.risk === 1 ||
      cycloneML.data.risk === 1
    ) {
      console.log("🚨 ALERT: ML detected disaster risk!");
    } else {
      console.log("✅ No risk detected");
    }
  } catch (err) {
    console.log("❌ Auto risk check failed:", err.message);
  }
}
app.get("/", (req, res) => {
  res.send("Disaster Management Backend is running");
});

app.post("/add-user", async (req, res) => {
  try {
    const { name, phone, email, location } = req.body;

    const newUser = new User({
      name,
      phone,
      email,
      location,
    });

    await newUser.save();

    res.send("User added successfully");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await User.find();

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/alerts", async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/alerts/latest", async (req, res) => {
  try {
    const latestAlert = await Alert.findOne().sort({ createdAt: -1 });

    res.json(latestAlert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/alerts/count", async (req, res) => {
  try {
    const count = await Alert.countDocuments();

    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/alerts/active", async (req, res) => {
  try {
    const alerts = await Alert.find({
      status: "active",
    }).sort({ createdAt: -1 });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/alerts/:id/resolve", async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: "resolved" },
      { new: true }
    );

    res.json({
      message: "Alert resolved successfully",
      alert,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/send-to-ml", async (req, res) => {
  try {
    const { starttime, endtime, earthquakes, floods, cyclones } =
      await fetchAllDisasterData();

    const earthquakePayload = getEarthquakePayload(earthquakes);
    const floodPayload = getFloodPayload();
    const cyclonePayload = getCyclonePayload(cyclones);

    const [earthquakeML, floodML, cycloneML] = await Promise.all([
      axios.post(`${ML_API_URL}/predict/earthquake`, earthquakePayload),
      axios.post(`${ML_API_URL}/predict/flood`, floodPayload),
      axios.post(`${ML_API_URL}/predict/cyclone`, cyclonePayload),
    ]);

    await saveAlert("Earthquake", earthquakeML.data, "Hyderabad");
    await saveAlert("Flood", floodML.data, "Bangalore");
    await saveAlert("Cyclone", cycloneML.data, "Coastal Area");

    res.json({
      message: "Data sent to ML APIs successfully",
      earthquake_time_range: {
        starttime,
        endtime,
      },
      ml_responses: {
        earthquake: earthquakeML.data,
        flood: floodML.data,
        cyclone: cycloneML.data,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err.response?.data || err.message,
    });
  }
});
setInterval(checkMLRiskAndCreateAlerts, 60 * 1000);
checkMLRiskAndCreateAlerts();
app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});