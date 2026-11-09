# AutoDiag Pro — קוד המקור

התיקייה `source/` היא קוד המקור של האפליקציה. כל מה שמחוץ לה (index.html, assets, sw.js...) הוא הגרסה הבנויה שרצה באתר.

## בנייה (למי שעובד עם Node.js)
```
cd source
npm install
./build.sh
```
התוצאה נוצרת ב-`source/dist/` — את התוכן שלה מעלים לשורש הריפו.

## מספר גרסה
בכל עדכון מעלים את המספר בשלושה מקומות יחד: `src/App.jsx` (APP_VERSION), `package.json`, `public/manifest.json`. סקריפט הבנייה עוצר אם הם לא תואמים, ומכניס את אותו מספר ל-sw.js.

© 2026 ברק אפללו · AppNest
