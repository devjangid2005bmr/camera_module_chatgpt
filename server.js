require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "3mb" }));
app.use(express.static("public"));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 40 }));

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const BUCKET = process.env.SUPABASE_BUCKET || "batgpt-photos";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.post("/api/leads", async (req, res) => {
  try {
    const { name, email, phone } = req.body || {};
    if (![name, email, phone].every(v => typeof v === "string" && v.trim())) {
      return res.status(400).json({ error: "Please enter name, email and mobile number." });
    }
    const { data, error } = await supabase.from("leads").insert({
      name: name.trim().slice(0, 100),
      email: email.trim().slice(0, 200),
      phone: phone.trim().slice(0, 30)
    }).select("id").single();
    if (error) throw error;
    res.json({ leadId: data.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "We couldn't save your details. Please try again." });
  }
});

app.post("/api/consent", async (req, res) => {
  try {
    const { leadId } = req.body || {};
    if (!leadId) return res.status(400).json({ error: "Missing lead ID." });
    const now = new Date().toISOString();
    const { error } = await supabase.from("leads")
      .update({ photo_notice_shown_at: now, photo_consent_at: now })
      .eq("id", leadId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not record consent." });
  }
});

app.post("/api/photos", async (req, res) => {
  try {
    const { leadId, cameraType, image } = req.body || {};
    if (!leadId || !["front", "rear"].includes(cameraType) ||
        typeof image !== "string" || !image.startsWith("data:image/jpeg;base64,")) {
      return res.status(400).json({ error: "Invalid photo upload." });
    }
    const { data: lead, error: leadError } = await supabase.from("leads")
      .select("id, photo_consent_at").eq("id", leadId).single();
    if (leadError || !lead?.photo_consent_at) {
      return res.status(403).json({ error: "Photo consent was not recorded." });
    }
    const buffer = Buffer.from(image.split(",")[1], "base64");
    if (buffer.length > 1_500_000) return res.status(413).json({ error: "Photo is too large." });

    const path = `${leadId}/${cameraType}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage.from(BUCKET)
      .upload(path, buffer, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;

    const { error: rowError } = await supabase.from("lead_photos").insert({
      lead_id: leadId, camera_type: cameraType, storage_path: path
    });
    if (rowError) throw rowError;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Photo upload failed." });
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true }));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`BatGPT ready at http://localhost:${port}`));
