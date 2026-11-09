// AutoDiag Pro — English versions of the built-in data.
import { C1 } from "./codes_en_1.js";
import { C2 } from "./codes_en_2.js";
import { C3 } from "./codes_en_3.js";

const RAW = { ...C1, ...C2, ...C3 };
export const CODES_EN = {};
for (const k in RAW) { const [desc, causes, steps, location] = RAW[k]; CODES_EN[k] = { desc, causes, steps, location }; }

export const SAFE_EN = {
  "כן":"Yes","לא מומלץ":"Not recommended","כן, בזהירות":"Yes, with care","לא! סכנה!":"No! Danger!","לא! עצור!":"No! Stop!",
  "לא יתניע":"Won't start","לא מומלץ — נזק לקטליזטור":"Not recommended — catalyst damage","לא — עלול לא להתניע":"No — may not start",
  "כן, בזהירות — מנוע עלול להתחמם":"Yes, with care — engine may overheat","כן, תיבה עלולה להישאר בהילוך":"Yes, gearbox may stay in one gear",
  "כן, תיבה בעייתית":"Yes, gearbox problematic","כן, ללא ABS":"Yes, without ABS","כן, ללא ESP":"Yes, without ESP",
  "כן, כרית לא תיפרס!":"Yes, but the airbag won't deploy!","כן, הגה כבד":"Yes, heavy steering","כן, ללא כריות אוויר!":"Yes, without airbags!",
  "כן, ללא מדים":"Yes, without gauges","כן, עלול לא להתניע":"Yes, may not restart","כן, מהירות מוגבלת":"Yes, limited speed","כן, מוגבל":"Yes, limited",
  "לא! סל\"ד גבוה!":"No! High RPM!","לא יתניע/ינוע":"Won't start/move","לא מומלץ — Limp Mode":"Not recommended — Limp Mode",
  "כן, בזהירות — חוסר כוח":"Yes, with care — lack of power","לא! סכנת נזק מנוע!":"No! Risk of engine damage!","כן, ללא ABS/ESP":"Yes, without ABS/ESP",
  "כן, כרית עלולה להיפרס!":"Yes, but the airbag could deploy!","כן, ללא כרית צד":"Yes, without side airbag","כן, בזהירות — לחץ?":"Yes, with care — check pressure",
  "לא! עצור מיד!":"No! Stop immediately!","כן, ייתכן שלא יתניע!":"Yes, but it may not restart!","כן, Limp Mode":"Yes, Limp Mode",
};

export const SYMPTOMS_EN = {
  s1:{text:"🔥 Engine overheating",tip:"Check coolant, thermostat, fan, radiator"},
  s2:{text:"⚡ No start / hard start",tip:"Check battery, starter, fuel pump, CKP, CMP, immobiliser"},
  s3:{text:"🔧 Rough idle / misfires",tip:"Check spark plugs, coils, injectors, IAC, vacuum leaks"},
  s4:{text:"💨 Black exhaust smoke",tip:"Rich mixture — check MAF, injectors, fuel pressure, O2"},
  s5:{text:"💨 White exhaust smoke",tip:"Possible coolant leak into the cylinders — head gasket?"},
  s6:{text:"⛽ High fuel consumption",tip:"Check MAF, O2, spark plugs, tyre pressure, thermostat"},
  s7:{text:"🚗 Lack of power / slow acceleration",tip:"Check MAF, fuel, spark plugs, turbo, DPF, catalyst, throttle"},
  s8:{text:"💡 Check Engine light",tip:"Scan codes. Most common: catalyst, EVAP, mixture, misfires"},
  s9:{text:"💡 ABS light",tip:"Check ABS sensors, wiring, wheel bearings"},
  s10:{text:"💡 Airbag (SRS) light",tip:"⚠️ Scan the SRS. Never work on it without disconnecting the battery!"},
  s11:{text:"🔌 Electrical problems / flickering lights",tip:"Check battery, alternator, grounds, CAN bus"},
  s12:{text:"🔄 Gearbox — harsh shifts / judder",tip:"Check gearbox fluid, solenoids, sensors"},
  s13:{text:"🔑 Immobiliser / key not recognised",tip:"Try a spare key, check the antenna coil and key battery"},
  s14:{text:"🛞 Heavy steering / EPS",tip:"Check EPS fuse, wiring, battery voltage, steering sensor"},
  s15:{text:"⬆️ High idle",tip:"Check vacuum leaks, IAC, throttle, EGR stuck open"},
  s16:{text:"⬇️ Low idle / engine stalls",tip:"Check IAC, vacuum leaks, fuel pressure, throttle"},
  s17:{text:"🔊 Knocking noise from the engine",tip:"Check engine oil, timing chain, knock sensor, bearings"},
  s18:{text:"💧 Fuel smell / fuel leak",tip:"Check fuel cap, EVAP lines, injectors, fuel lines"},
  s19:{text:"🐌 Limp Mode",tip:"Faulty throttle or pedal. Scan codes, check TPS and APP"},
  s20:{text:"🌫️ DPF / smoke and diesel warning",tip:"Check DPF, AdBlue, NOx sensors, try a regeneration"},
  s21:{text:"💨 Turbo — low boost / noise",tip:"Check wastegate, air pipes, intercooler, the turbo itself"},
  s22:{text:"🛢️ Low oil pressure / oil light",tip:"⚠️ Stop! Check oil level, pump, sensor"},
  s23:{text:"❄️ A/C not working / not cooling",tip:"Check refrigerant, condenser fan, compressor, pressure sensor"},
  s24:{text:"🚪 Central locking / electric windows not working",tip:"Check wiring in the door boot, motor/actuator, switches, BCM"},
  s25:{text:"📡 CAN communication — scanner won't connect",tip:"Check OBD pins 6+14, fuses, CAN wiring, gateway"},
  s26:{text:"🔋 Battery drains / not charging",tip:"Check alternator, battery, parasitic draw, main relay"},
  s27:{text:"🔔 Tyre pressure — TPMS",tip:"Check tyre pressures, TPMS sensors, module"},
};

export const SENSORS_EN = [
  {name:"Oxygen sensor (O2)",voltage:"0.1–0.9V",resist:"Heater 4-15Ω",notes:"Switches lean↔rich"},
  {name:"A/F sensor (wideband)",voltage:"2.2–4.2V",resist:"Heater 2-8Ω",notes:"More accurate than a standard O2. 5 wires"},
  {name:"MAP sensor",voltage:"0.5–4.5V",resist:"—",notes:"Vacuum≈1V, atmospheric≈4.5V"},
  {name:"TPS (throttle)",voltage:"0.5–4.5V",resist:"—",notes:"0.5V closed, 4.5V open"},
  {name:"APP sensor (accelerator pedal)",voltage:"0.5–4.5V dual",resist:"—",notes:"2 sensors with a constant ratio between them"},
  {name:"ECT sensor (coolant temp)",voltage:"0.5–3.5V",resist:"NTC 300Ω–30KΩ",notes:"Cold≈3K, hot≈300Ω"},
  {name:"IAT sensor (intake air temp)",voltage:"0.5–3.5V",resist:"NTC 2K–30KΩ",notes:"Similar to ECT"},
  {name:"EGT sensor (exhaust temp)",voltage:"Type K thermocouple",resist:"—",notes:"Up to 1000°C. Diesel/turbo sensor"},
  {name:"CKP sensor (crankshaft)",voltage:"AC 0.3–5V",resist:"200–600Ω",notes:"Inductive or Hall"},
  {name:"CMP sensor (camshaft)",voltage:"0/5V Hall",resist:"200–600Ω",notes:"Hall = square wave, inductive = sine wave"},
  {name:"MAF sensor",voltage:"0.5–5V",resist:"—",notes:"Idle≈0.8V, load≈2-5V. MAF cleaner only!"},
  {name:"ABS sensor",voltage:"AC 0.1–2V",resist:"800Ω–2KΩ",notes:"Rises with speed"},
  {name:"Fuel rail pressure sensor (FRP)",voltage:"0.5–4.5V",resist:"—",notes:"Petrol≈3-4 bar, GDI≈50-200 bar, diesel≈300-2000 bar"},
  {name:"NOx sensor",voltage:"Digital module",resist:"—",notes:"Separate module. Common on Euro 6 diesels. Expensive!"},
  {name:"A/C pressure sensor",voltage:"0.5–4.5V",resist:"—",notes:"LP≈2 bar, HP≈15-25 bar. Protects the compressor"},
  {name:"Fuel injector",voltage:"12V pulse",resist:"12–16Ω",notes:"Open/short = fault"},
  {name:"GDI injector (direct injection)",voltage:"65-200V",resist:"1–3Ω",notes:"High pressure! Measure with suitable equipment"},
  {name:"Ignition coil",voltage:"12V",resist:"P:0.5-2Ω S:6-15KΩ",notes:"Check primary + secondary"},
  {name:"VVT solenoid",voltage:"12V PWM",resist:"7–12Ω",notes:"Clean oil is critical"},
  {name:"Knock sensor",voltage:"Low AC",resist:"50K–600KΩ",notes:"Torque 20-40 N·m!"},
  {name:"Fuel pump",voltage:"12V",resist:"0.5–3Ω",notes:"Minimum 3 bar on petrol"},
  {name:"Throttle motor (ETC)",voltage:"12V DC",resist:"2–10Ω",notes:"2 motor wires + 6-pin TPS"},
  {name:"Steering angle sensor (SAS)",voltage:"5V digital",resist:"—",notes:"Needs calibration after steering/suspension work"},
  {name:"Oil pressure sensor",voltage:"0.5–4.5V",resist:"10–180Ω (analogue)",notes:"Switch: closes at 0.3 bar. Analogue: 0-5 bar"},
  {name:"TPMS sensor (tyre pressure)",voltage:"RF 315/433MHz",resist:"—",notes:"Inside the wheel. Battery lasts 5-10 years"},
];

export const WIRE_TYPES_EN = [
  {name:"Standard wire (GPT/GXL)",desc:"Copper wire with PVC insulation. The most common wire in a vehicle.",use:"General wiring, lighting, sensors"},
  {name:"Shielded wire",desc:"Wire with a metal layer around it that protects against EMI.",use:"CKP, CMP and knock sensors, audio, sensitive sensors"},
  {name:"Twisted pair",desc:"2 wires twisted together. Cancels interference.",use:"CAN bus (CAN-H + CAN-L), communication between modules"},
  {name:"CAN bus",desc:"Twisted pair (often green/green-white), 120Ω at each end, 2.5V at rest.",use:"Communication between all the vehicle's modules. OBD pins 6+14"},
  {name:"Heat-resistant wire (GXL/TXL)",desc:"Insulation rated for high temperatures, thinner.",use:"Engine bay, near the exhaust, injectors, coils"},
  {name:"HV wire (orange)",desc:"⚡ High-voltage cable in hybrid/electric vehicles. Orange!",use:"⚠️ HV battery, electric motor, charger. Do not touch!"},
  {name:"SRS wire (yellow)",desc:"Airbag wiring. Yellow only.",use:"⚠️ Airbags, crash sensors. Disconnect the battery for 15+ minutes!"},
  {name:"Coax cable",desc:"Centre conductor + shield + insulation.",use:"Radio antenna, GPS, multimedia system"},
  {name:"Flex cable / FPC",desc:"Flat flexible cable.",use:"Clockspring in the steering wheel, instrument cluster connections"},
  {name:"Fusible link",desc:"A thin wire that burns like a fuse to protect the circuit.",use:"Near the battery, protects the main circuits"},
];

export const WIRE_COLORS_EN = {
  "כללי":[{n:"Black",u:"Ground (GND)"},{n:"Red",u:"Positive +B"},{n:"Orange",u:"SRS/HV ⚠️"},{n:"Yellow",u:"SRS airbags ⚠️"},{n:"White",u:"Signals"},{n:"Green",u:"CAN / sensors"},{n:"Blue",u:"Lighting"},{n:"Purple",u:"Multiplex"},{n:"Pink",u:"Control"},{n:"Brown",u:"Sensor ground"},{n:"Grey",u:"Ground / signal"}],
  "Toyota":[{n:"Black B",u:"Ground"},{n:"Red R",u:"+B"},{n:"White W",u:"Ignition"},{n:"Green G",u:"Sensors"},{n:"Blue L",u:"Lighting"},{n:"Orange O",u:"SRS"},{n:"Yellow Y",u:"SRS"},{n:"Brown BR",u:"Fan/heater"},{n:"Pink PI",u:"ECU control"}],
  "BMW":[{n:"Brown BR",u:"Ground 31"},{n:"Red RT",u:"+30 (constant)"},{n:"Green GN",u:"Ignition 15"},{n:"Orange OR",u:"CAN-H"},{n:"White WS",u:"CAN-L"},{n:"Yellow GE",u:"SRS"},{n:"Purple VI",u:"K-Bus"},{n:"Blue BL",u:"MOST/LIN"}],
  "Hyundai/Kia":[{n:"Black BK",u:"Ground"},{n:"Red RD",u:"+B"},{n:"White WH",u:"Signals"},{n:"Green GN",u:"CAN"},{n:"Yellow YL",u:"SRS"},{n:"Orange OR",u:"CAN-H/SRS"},{n:"Brown BR",u:"Sensor ground"},{n:"Blue BL",u:"Lighting"},{n:"Purple VI",u:"LIN bus"}],
  "VW/Audi":[{n:"Brown BR",u:"Ground 31"},{n:"Red RT",u:"+30"},{n:"Black SW",u:"Ground 31"},{n:"Orange OR",u:"CAN-H"},{n:"White WS",u:"CAN-L (VW = orange + brown)"},{n:"Yellow GE",u:"SRS"},{n:"Green GN",u:"Ignition 15"},{n:"Purple LI",u:"LIN/control"}],
  "Ford":[{n:"Black BK",u:"Ground"},{n:"Red RD",u:"+B"},{n:"Yellow YE",u:"SRS"},{n:"Orange OG",u:"+B without ignition"},{n:"Blue",u:"HS-CAN"},{n:"White WH",u:"MS-CAN"},{n:"Green GN",u:"Sensors"},{n:"Purple PU",u:"LIN"}],
};

export const CONV_CAT_EN = { "לחץ":"Pressure", "טמפרטורה":"Temperature", "מהירות":"Speed", "אורך":"Length", "מומנט":"Torque", "הספק":"Power", "נפח":"Volume" };
export const BATTERY_EN = ["Full","Good","Medium","Weak","Empty — charge it!","Dead — replace it!"];
