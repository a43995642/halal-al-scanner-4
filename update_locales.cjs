const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.ts') && f !== 'en.ts' && f !== 'ar.ts');

const additions1 = `
  sound: "Sound",
  soundDesc: "Play sounds when showing results.",
  haptics: "Haptics",
  hapticsDesc: "Vibrate on interactions.",`;

const additions2 = `
  dietaryPreferences: "Dietary & Allergies",
  dietaryPreferencesDesc: "You will be warned if the product contains these.",
  dietVegan: "Vegan",
  dietVegetarian: "Vegetarian",
  allergyGluten: "Gluten Allergy",
  allergyDairy: "Dairy Allergy (Lactose)",
  allergyNuts: "Nut Allergy",
  allergyEggs: "Egg Allergy",
  allergySoy: "Soy Allergy",
  healthWarning: "Health Warning",`;

for (const file of files) {
  const filePath = path.join(localesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Add sound and haptics after language:
  if (content.includes('language:') && !content.includes('sound:')) {
    content = content.replace(/(language:.*?,)/, "$1" + additions1);
  }

  // Add dietary preferences after clearHistoryConfirm:
  if (content.includes('clearHistoryConfirm:') && !content.includes('dietaryPreferences:')) {
    content = content.replace(/(clearHistoryConfirm:.*?,)/, "$1" + additions2);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Done updating locales!');
