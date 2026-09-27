// Starting catalogue of Indian two-wheeler brands and models.
// Loaded by `npm run db:seed`; editable later in Settings → Brands & models.

export const BRAND_MODELS: Record<string, string[]> = {
  Hero: ["Splendor Plus", "Super Splendor", "Splendor iSmart", "Passion Pro", "Passion Plus", "Passion XTEC", "HF Deluxe", "HF 100", "HF Dawn", "Glamour", "Glamour XTEC", "Super Splendor XTEC", "CD Deluxe", "CD Dawn", "Achiever", "Hunk", "Ignitor", "Xtreme 160R", "Xtreme 160R 4V", "Xtreme 125R", "Xtreme 200S", "Xpulse 200", "Xpulse 200 4V", "Karizma", "Karizma XMR", "Maestro", "Maestro Edge", "Pleasure", "Pleasure Plus", "Destini 125", "Duet", "Xoom", "Mavrick 440"],
  Honda: ["Activa 3G", "Activa 4G", "Activa 5G", "Activa 6G", "Activa 125", "Dio", "Dio 125", "Aviator", "Grazia", "Eterno", "Shine", "Shine 100", "SP 125", "SP 160", "Livo", "Dream Yuga", "CD 110 Dream", "Stunner", "Twister", "Unicorn", "Trigger", "X-Blade", "Hornet 2.0", "CB200X", "CBR 150R", "CBR 250R", "Hness CB350", "CB350RS"],
  Bajaj: ["CT 100", "CT 110", "CT 125X", "Platina 100", "Platina 110", "Platina 110 H-Gear", "Discover 100", "Discover 110", "Discover 125", "Discover 150", "Boxer", "Caliber", "XCD 125", "Pulsar 125", "Pulsar 135 LS", "Pulsar 150", "Pulsar 180", "Pulsar 220F", "Pulsar N150", "Pulsar N160", "Pulsar N250", "Pulsar NS125", "Pulsar NS160", "Pulsar NS200", "Pulsar RS200", "Avenger 150", "Avenger 160", "Avenger 220", "Dominar 250", "Dominar 400", "Freedom 125", "Chetak"],
  TVS: ["Jupiter", "Jupiter 110", "Jupiter 125", "Jupiter Classic", "Ntorq 125", "Scooty Pep Plus", "Scooty Zest 110", "Wego", "Streak", "XL100", "XL Super", "Heavy Duty Super XL", "Sport", "Star City", "Star City Plus", "Radeon", "Victor", "Phoenix", "Flame", "Raider 125", "Apache RTR 150", "Apache RTR 160", "Apache RTR 160 4V", "Apache RTR 180", "Apache RTR 200 4V", "Apache RTR 310", "Apache RR 310", "Ronin", "iQube"],
  Yamaha: ["RX 100", "RX 135", "Crux", "Libero", "YBR 110", "YBR 125", "Gladiator", "SS 125", "Saluto", "Saluto RX", "SZ-RR", "Fazer", "FZ 16", "FZ-S", "FZ-S V3", "FZ-S Fi V4", "FZ V3", "FZ-X", "FZ 25", "R15 V2", "R15 V3", "R15 V4", "MT-15", "Ray ZR 125", "Fascino 125", "Alpha", "Aerox 155"],
  Suzuki: ["Access 125", "Burgman Street", "Avenis", "Let's", "Swish", "Hayate", "Slingshot", "Heat", "Zeus", "Gixxer", "Gixxer SF", "Gixxer 250", "Gixxer SF 250", "Intruder 150", "V-Strom SX"],
  "Royal Enfield": ["Bullet 350", "Bullet 500", "Classic 350", "Classic 500", "Hunter 350", "Meteor 350", "Thunderbird 350", "Thunderbird 500", "Electra", "Himalayan 411", "Himalayan 450", "Scram 411", "Interceptor 650", "Continental GT 650", "Super Meteor 650", "Guerrilla 450"],
  KTM: ["Duke 125", "Duke 200", "Duke 250", "Duke 390", "RC 125", "RC 200", "RC 390", "Adventure 250", "Adventure 390"],
  Mahindra: ["Centuro", "Pantero", "Arro", "Gusto", "Rodeo", "Duro", "Flyte", "Kine", "Mojo"],
};

export const UNIVERSAL_BRAND = "Universal";

export const CATEGORIES = [
  "Engine", "Brakes", "Clutch", "Transmission", "Electricals", "Lights", "Suspension",
  "Cables", "Body parts", "Filters", "Tyres & Tubes", "Bearings", "Fasteners", "Wheels", "Fuel system",
];
