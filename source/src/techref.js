// AutoDiag Pro — technical reference for auto electricians (offline). Every text is { he, en }.
const x = (he, en) => ({ he, en });

// DIN 72552 terminal numbers
export const DIN = [
  ["1", x("סליל הצתה — צד מינוס (מגע פלטינות)","Ignition coil negative (points side)")],
  ["4", x("סליל הצתה — מתח גבוה","Ignition coil high tension")],
  ["15", x("פלוס אחרי מתג ההצתה (הצתה דלוקה)","Switched positive after the ignition switch (ignition on)")],
  ["15a", x("יציאה מנגד טרום בסליל","Output from the coil ballast resistor")],
  ["30", x("פלוס קבוע ישר מהמצבר","Permanent positive straight from the battery")],
  ["31", x("אדמה / מינוס","Ground / negative")],
  ["31b", x("אדמה דרך מתג (למשל מגבים)","Ground through a switch (e.g. wipers)")],
  ["49 / 49a", x("ממסר מהבהבים — כניסה / יציאה","Flasher relay — input / output")],
  ["50", x("פיקוד מתנע (מתג ההצתה במצב START)","Starter control (ignition switch in START)")],
  ["53", x("מנוע מגבים — פלוס","Wiper motor positive")],
  ["54", x("אורות בלם","Brake lights")],
  ["56 / 56a / 56b", x("פנס ראשי / אור גבוה / אור נמוך","Headlamp / high beam / low beam")],
  ["58", x("אורות חניה / צד, תאורת לוחית","Parking / side lights, plate lamp")],
  ["61", x("נורית טעינה (D+ / L של האלטרנטור)","Charge warning lamp (alternator D+ / L)")],
  ["75", x("אביזרים (ACC) — רדיו, מצית","Accessories (ACC) — radio, lighter")],
  ["85 / 86", x("סליל ממסר (85 בדרך כלל לאדמה, 86 לפלוס)","Relay coil (85 usually ground, 86 positive)")],
  ["87 / 87a", x("מגע ממסר — פתוח במנוחה (NO) / סגור במנוחה (NC)","Relay contact — normally open (NO) / normally closed (NC)")],
  ["B+ / D+ / DF / W", x("אלטרנטור: יציאת טעינה / עירור ונורית / שדה / אות סל\"ד","Alternator: charge output / excitation & lamp / field / RPM signal")],
];

// typical continuous current in automotive wire (short runs, bundled, PVC). Always check voltage drop for long runs.
export const WIRES = [
  ["0.35","22","5"],["0.5","20","7.5"],["0.75","18","10"],["1.0","17","13"],["1.5","15–16","16"],["2.5","13–14","25"],
  ["4","12","32"],["6","10","40"],["10","8","60"],["16","6","80"],["25","4","120"],["35","2","150"],
];

// blade fuse (ATO/ATC and mini) colours
export const FUSES = [
  ["1","#111111",x("שחור","Black")],["2","#9E9E9E",x("אפור","Grey")],["3","#7E57C2",x("סגול","Violet")],["4","#F48FB1",x("ורוד","Pink")],
  ["5","#C8A27A",x("חום בהיר","Tan")],["7.5","#6D4C41",x("חום","Brown")],["10","#E53935",x("אדום","Red")],["15","#1E88E5",x("כחול","Blue")],
  ["20","#FDD835",x("צהוב","Yellow")],["25","#F5F5F5",x("שקוף / לבן","Clear / white")],["30","#43A047",x("ירוק","Green")],["40","#FB8C00",x("כתום","Orange")],
];

export const PROTOCOLS = [
  ["ISO 15765-4 (CAN)", "6, 14", x("רוב הרכבים מ-2008 (באירופה: בנזין מ-2001 בערך, דיזל מ-2004). 11 או 29 ביט, 250/500 kbps.","Most cars from 2008 (in Europe: petrol from about 2001, diesel from 2004). 11 or 29 bit, 250/500 kbps.")],
  ["ISO 14230 (KWP2000)", "7 (15)", x("אירופאים ואסייתים ישנים, K-Line. התחלה מהירה או 5 baud.","Older European and Asian cars, K-Line. Fast or 5-baud init.")],
  ["ISO 9141-2", "7 (15)", x("אירופאים ואסייתים ישנים (שנות ה-90 עד אמצע 2000), K-Line.","Older European and Asian cars (1990s to mid-2000s), K-Line.")],
  ["SAE J1850 PWM", "2, 10", x("פורד ישנות.","Older Fords.")],
  ["SAE J1850 VPW", "2", x("ג'נרל מוטורס ישנות.","Older GM.")],
];

export const SECTIONS = [
  { id:"meter", icon:"🧰", title:x("עבודה נכונה עם מולטימטר","Using a multimeter properly"), items:[
    x("מתח מודדים כשהמעגל מחובר ועובד — מתח 'בלי עומס' יכול להיראות 12V גם כשיש חוט חלוד.","Measure voltage with the circuit connected and working — an unloaded reading can show 12V even through a corroded wire."),
    x("התנגדות מודדים רק כשהמעגל מנותק ממתח. אוהמטר לא מגלה מגע חלקי שנופל בעומס — בשביל זה יש בדיקת מפל מתח.","Measure resistance only with the circuit unpowered. An ohmmeter won't find a partial contact that fails under load — that's what voltage-drop testing is for."),
    x("זרם מודדים בטור, ומתחילים מהטווח הגבוה (10A). לזרמים גבוהים — מד צבת.","Measure current in series and start on the high range (10A). For high currents — a clamp meter."),
    x("מודדים מאחורי המחבר (Back-probe) עם מחט דקה. לא מנקבים בידוד — זה מכניס מים וחלודה.","Back-probe behind the connector with a thin pin. Don't pierce insulation — it lets in water and corrosion."),
    x("גשר עוקף תמיד עם נתיך. לעולם לא מחברים 12V ישר לחוט אות של מחשב או חיישן.","Always fuse a bypass jumper. Never put 12V straight onto an ECU or sensor signal wire."),
    x("נורת בדיקה (Test light) מעמיסה את המעגל — טובה לבדוק הזנה ואדמה. לא להשתמש בה על חוטי מחשב ו-CAN.","A test light loads the circuit — good for checking supply and ground. Don't use it on ECU or CAN wires."),
  ]},
  { id:"relay", icon:"🔁", title:x("ממסרים — סוגים ובדיקה","Relays — types and testing"), items:[
    x("ממסר 4 פינים: 30, 87, 85, 86. ממסר 5 פינים מוסיף 87a — מגע שסגור במנוחה (מחליף).","4-pin relay: 30, 87, 85, 86. A 5-pin relay adds 87a — a normally-closed (changeover) contact."),
    x("יש ממסרים עם דיודה או נגד על הסליל (נגד קוצי מתח). בממסר עם דיודה הקוטביות של 85/86 חשובה!","Some relays have a diode or resistor across the coil (spike suppression). With a diode, 85/86 polarity matters!"),
    x("בדיקה: התנגדות סליל 50–120Ω בערך. מחברים 12V לסליל — צריך קליק, ובין 30 ל-87 התנגדות כמעט 0 (ומפל מתח קטן מ-0.2V בעומס).","Test: coil about 50–120Ω. Apply 12V to the coil — you should hear a click and read near 0Ω between 30 and 87 (and below 0.2V drop under load)."),
    x("הדרך הכי מהירה בשטח: להחליף עם ממסר זהה מאותה תיבה (למשל של הצופר).","Quickest field test: swap with an identical relay from the same box (e.g. the horn's)."),
  ]},
  { id:"hv", icon:"⚠️", title:x("בטיחות ברכב היברידי / חשמלי","Hybrid / EV safety"), items:[
    x("כבלים כתומים = מתח גבוה (בדרך כלל 200–800V). לא חותכים, לא מנתקים ולא מודדים בלי הכשרה וציוד.","Orange cables = high voltage (usually 200–800V). Don't cut, unplug or measure them without training and equipment."),
    x("לפני עבודה ליד המערכת: מכבים מצב READY, מרחיקים את המפתח, מנתקים את מצבר ה-12V ומוציאים את תקע השירות (Service plug) לפי היצרן.","Before working near the system: switch off READY, keep the key away, disconnect the 12V battery and remove the service plug per the manufacturer."),
    x("מחכים לפי הוראות היצרן (בדרך כלל 5–10 דקות) כדי שהקבלים בממיר יתרוקנו, ומוודאים 0V עם מכשיר מתאים.","Wait as the manufacturer says (usually 5–10 minutes) for the inverter capacitors to discharge, and verify 0V with a suitable meter."),
    x("ציוד: כפפות מבודדות בדרגה מתאימה (נבדקות לפני שימוש) ומודד CAT III 1000V לפחות.","Equipment: insulated gloves of the right class (checked before use) and a meter rated CAT III 1000V or better."),
    x("רכב ב-READY יכול לזוז או להפעיל מנוע בנזין לבד — גם כשהוא שקט.","A car in READY can move or start its petrol engine by itself — even when it's silent."),
    x("מצבר ה-12V עדיין קיים ומפעיל את המחשבים. 'לא מתניע' ברכב היברידי הוא לעיתים קרובות מצבר 12V חלש.","The 12V battery still exists and powers the modules. A 'no start' on a hybrid is often just a weak 12V battery."),
  ]},
  { id:"ground", icon:"⏚", title:x("אדמות — איפה ואיך","Grounds — where and how"), items:[
    x("שלוש אדמות ראשיות: מינוס מצבר לשלדה, מנוע/תיבה לשלדה (רצועה עבה), ומינוס מצבר למנוע. כל אחת חייבת מפל מתח נמוך בעומס.","Three main grounds: battery negative to body, engine/gearbox to body (thick strap), and battery negative to engine. Each must show a low voltage drop under load."),
    x("סימני אדמה רעה: פנסים מתעמעמים יחד, מחוגים קופצים, קודי תקשורת רבים, חימום של חיבור.","Signs of a bad ground: lamps dimming together, jumping gauges, lots of communication codes, a connection getting warm."),
    x("ניקוי: מסירים צבע וחלודה עד מתכת, מחזקים, ומורחים שכבת הגנה מעל (לא מתחת) לחיבור.","Cleaning: remove paint and rust to bare metal, tighten, and apply a protective coating over (not under) the joint."),
    x("מחשבים וחיישנים משתמשים באדמות נפרדות ('אדמת חיישן') — לא מחברים אליהן צרכנים.","ECUs and sensors use separate grounds ('sensor ground') — don't hook loads onto them."),
  ]},
  { id:"battery", icon:"🔋", title:x("מצבר — סוגים וטיפול","Battery — types and care"), items:[
    x("רכבים עם Start-Stop משתמשים ב-EFB או AGM. מחליפים באותו סוג — מצבר רגיל ייכשל מהר.","Start-Stop cars use EFB or AGM. Replace with the same type — a standard battery will fail quickly."),
    x("ברכבים עם חיישן מצבר (על הדק המינוס) צריך לרשום מצבר חדש בסורק, אחרת הטעינה לא תותאם.","Cars with a battery sensor (on the negative terminal) need a new battery registered with a scan tool, otherwise charging won't adapt."),
    x("טעינת AGM — במטען שיש לו מצב AGM (בלי מצב 'דסולפציה' אגרסיבי).","Charge AGM with a charger that has an AGM mode (no aggressive 'desulphation' mode)."),
    x("לפני ניתוק מצבר: שמור קוד רדיו, סגור חלונות; אחרי חיבור: לימוד חלונות, מצערת והגה (לפי רכב).","Before disconnecting: note the radio code, close the windows; after reconnecting: relearn windows, throttle and steering (per car)."),
  ]},
];

// standard E12 resistor values (for the LED calculator)
export const E12 = [1.0,1.2,1.5,1.8,2.2,2.7,3.3,3.9,4.7,5.6,6.8,8.2];
export const FUSE_STEPS = [1,2,3,4,5,7.5,10,15,20,25,30,40,50,60,80,100];
