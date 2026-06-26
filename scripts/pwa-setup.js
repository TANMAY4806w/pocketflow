const fs = require("fs");
const path = require("path");

const sourceIcon = "C:\\Users\\TANMAY\\.gemini\\antigravity-ide\\brain\\9ad13be3-a177-4d82-a98a-8a0b74e05a98\\pocketflow_logo_1782494947250.png";
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
