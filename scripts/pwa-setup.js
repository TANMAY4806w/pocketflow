const fs = require("fs");
const path = require("path");

const sourceIcon = "C:\\Users\\TANMAY\\.gemini\\antigravity-cli\\brain\\9b1f863b-e751-49a3-aede-82ce7f219988\\pocketflow_icon_1781531429606.jpg";
const publicDir = path.join(__dirname, "..", "public");

try {
  if (fs.existsSync(sourceIcon)) {
    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Copy to target PWA icons
    fs.copyFileSync(sourceIcon, path.join(publicDir, "placeholder-icon.png"));
    fs.copyFileSync(sourceIcon, path.join(publicDir, "apple-touch-icon.png"));
    fs.copyFileSync(sourceIcon, path.join(publicDir, "pocketflow-icon.png"));

    console.log("PocketFlow PWA branding assets successfully copied to public/ directory.");
  } else {
    console.warn("Branding source icon not found at: " + sourceIcon);
    console.warn("Setup will proceed. Please ensure icon is manually generated/copied later.");
  }
} catch (err) {
  console.error("Error setting up PWA assets:", err);
}
