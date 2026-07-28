const uploadBtn = document.getElementById("uploadBtn");
const intelBox = document.getElementById("intel");
const urlBox = document.getElementById("pageUrl");
const status = document.getElementById("status");

uploadBtn.addEventListener("click", async () => {
  const intel = intelBox.value.trim();

  if (
    !intel.includes("Total Provinces") &&
    !intel.includes("The Province of") &&
    !intel.includes("Thievery") &&
    !intel.includes("Military") &&
    !intel.includes("Net Offensive Points")
  ) {
    status.textContent = "Not a valid Utopia intel page.";
    return;
  }
  const url = urlBox.value.trim();

  if (!intel) {
    status.textContent = "No intel entered.";
    return;
  }

  if (!url) {
    status.textContent = "No URL entered.";
    return;
  }

  status.textContent = "Uploading intel...";

  try {
    const form = new URLSearchParams();

    form.append("key", "NikkoAce");
    form.append("data_simple", intel);
    form.append("url", url);
    form.append("prov", "unknown");

    const response = await fetch(
      "https://utopia-nexus-production.up.railway.app/intel",
      {
        method: "POST",
        body: form
      }
    );

    if (response.ok) {
      status.textContent = "Intel uploaded successfully.";
      intelBox.value = "";
    } else {
      status.textContent = "Upload failed.";
    }

  } catch (error) {
    console.error(error);
    status.textContent = "Connection error.";
  }
});
