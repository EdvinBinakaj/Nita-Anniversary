// ============================================================
// Für Nita - ein kleines 3D Jahrestagsspiel 💕
// Mehrere Welten – Welt 1: Hamburg HafenCity
// ============================================================

let scene, camera, renderer, clock;
let character, charParts = {};
let letters = [];
let critters = [];
let foundCount = 0;
let totalLetters = 0;
let camOrbitAngle = 0.35;
let camDist = 11, camHeight = 8.5;
let walkTime = 0;
let isMoving = false;
let nearestOpenIndex = -1;
let gameStarted = false;
let confettiPieces = [];
let worldGroup = null;
let walkables = [];
let currentWorldIndex = 0;
let transitioning = false;
const clouds = [];
const fireworks = [];
let fireworkTimer = 0;

// ---------- Input state ----------
const input = { x: 0, y: 0 };
let joystickActive = false;
let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
const JOY_MAX = 45;

let orbitDragging = false;
let orbitTouchId = null;
let lastOrbitX = 0;

const keys = {};

// ============================================================
// WORLD DEFINITIONS
// ============================================================
const WORLDS = [
  {
    id: "hafencity",
    name: "Hamburg HafenCity",
    sky: 0xa8d4f0,
    fogNear: 40,
    fogFar: 110,
    hemiSky: 0xa8d4f0,
    hemiGround: 0x6a8a9a,
    start: { x: 0, z: 48 },
    camOrbit: 0.05,
    letterOffset: 0,
    spots: [
      { x: -32, z: -14, critter: "dog", color: 0xd9a86c, landmark: "couple_bench" },
    ],
    build: buildHafenCity,
  },
  {
    id: "paris",
    name: "Paris – Unsere erste Reise",
    sky: 0xc8d8e8,
    fogNear: 45,
    fogFar: 120,
    hemiSky: 0xc8d8e8,
    hemiGround: 0x8a9a7a,
    start: { x: -14, z: 34 },
    camOrbit: 0.1,
    letterOffset: 1,
    spots: [
      { x: 26, z: -6, critter: "bunny", color: 0xf3d9e6, landmark: "eiffel_letter" },
    ],
    build: buildParis,
  },
  {
    id: "wohnung",
    name: "Unsere Wohnung",
    sky: 0xe8dcc8,
    fogNear: 18,
    fogFar: 45,
    hemiSky: 0xf0e6d4,
    hemiGround: 0xb8a890,
    start: { x: 10.5, z: 0 },
    camOrbit: Math.PI * 0.5,
    camDist: 9,
    camHeight: 7,
    letterOffset: 2,
    spots: [
      { x: 5.2, z: -5.2, critter: "cat", color: 0xf2f0e6, landmark: "dining_couple" },
    ],
    build: buildApartment,
  },
  {
    id: "koeln",
    name: "Köln am Dom",
    sky: 0xb0c8dc,
    fogNear: 40,
    fogFar: 110,
    hemiSky: 0xb0c8dc,
    hemiGround: 0x8a8a7a,
    start: { x: -8, z: 26 },
    camOrbit: 0.15,
    letterOffset: 3,
    spots: [
      { x: -22, z: -22, critter: "dog", color: 0xd9a86c, landmark: "koeln_bridge" },
    ],
    build: buildKoeln,
  },
  {
    id: "duesseldorf",
    name: "Düsseldorf bei Nacht",
    sky: 0x1a1a35,
    fogNear: 35,
    fogFar: 95,
    hemiSky: 0x2a2a48,
    hemiGround: 0x1a2030,
    start: { x: -18, z: 18 },
    camOrbit: 0.4,
    camDist: 12,
    camHeight: 9,
    letterOffset: 4,
    spots: [
      { x: -14, z: -8, critter: "bunny", color: 0xf3d9e6, landmark: "fireworks_couple" },
    ],
    build: buildDuesseldorf,
  },
];

function makeMat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra });
}

function addWalkableBox(x, z, w, d, rot = 0) {
  walkables.push({ type: "box", x, z, w, d, rot });
}

function isWalkable(px, pz) {
  for (const r of walkables) {
    const dx = px - r.x;
    const dz = pz - r.z;
    const c = Math.cos(r.rot);
    const s = Math.sin(r.rot);
    // Inverse von Three.js rotation.y
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) <= r.w * 0.5 && Math.abs(lz) <= r.d * 0.5) return true;
  }
  return false;
}

// ============================================================
// INIT
// ============================================================
function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 300);

  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("game"), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  clock = new THREE.Clock();

  totalLetters = WORLDS.reduce((sum, w) => sum + w.spots.length, 0);
  document.getElementById("total-count").textContent = totalLetters;

  character = createNita();
  scene.add(character);

  loadWorld(0);

  window.addEventListener("resize", onResize);
  setupInput();

  document.getElementById("loading").classList.add("hidden");
  requestAnimationFrame(animate);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function clearLights() {
  const toRemove = [];
  scene.traverse((obj) => {
    if (obj.isLight) toRemove.push(obj);
  });
  toRemove.forEach((l) => scene.remove(l));
}

function addLights(world) {
  clearLights();
  const hemi = new THREE.HemisphereLight(world.hemiSky, world.hemiGround, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4d6, 1.15);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.0025;
  scene.add(sun);

  scene.add(new THREE.AmbientLight(0xffffff, 0.28));
}

function loadWorld(index) {
  currentWorldIndex = index;
  const world = WORLDS[index];

  if (worldGroup) {
    scene.remove(worldGroup);
    worldGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  letters = [];
  critters = [];
  walkables = [];
  clouds.length = 0;
  clearFireworks();

  worldGroup = new THREE.Group();
  scene.add(worldGroup);

  scene.background = new THREE.Color(world.sky);
  scene.fog = new THREE.Fog(world.sky, world.fogNear, world.fogFar);
  addLights(world);

  world.build(worldGroup, world);

  world.spots.forEach((spot, i) => {
    const contentIndex = world.letterOffset + i;
    const env = createEnvelope(contentIndex);
    env.position.set(spot.x, 1.1, spot.z);
    worldGroup.add(env);
    letters.push({ group: env, spot, opened: false, contentIndex });

    if (
      spot.landmark !== "couple_bench" &&
      spot.landmark !== "eiffel_letter" &&
      spot.landmark !== "dining_couple" &&
      spot.landmark !== "koeln_bridge" &&
      spot.landmark !== "fireworks_couple"
    ) {
      const critter = createCritter(spot.critter, spot.color);
      const cx = spot.x + (Math.random() - 0.5) * 2.2;
      const cz = spot.z + (Math.random() - 0.5) * 2.2 + 1.2;
      critter.position.set(cx, 0, cz);
      critter.userData.baseX = cx;
      critter.userData.baseZ = cz;
      critter.userData.phase = Math.random() * Math.PI * 2;
      worldGroup.add(critter);
      critters.push(critter);
    }
  });

  character.position.set(world.start.x, 0, world.start.z);
  character.rotation.y = 0;
  camOrbitAngle = world.camOrbit;
  camDist = world.camDist != null ? world.camDist : 11;
  camHeight = world.camHeight != null ? world.camHeight : 8.5;

  const worldLabel = document.getElementById("world-name");
  if (worldLabel) worldLabel.textContent = world.name;
}

// ============================================================
// WORLD 1: HAMBURG HAFENCITY (nach Luftbild-Skizze)
// ============================================================
function buildHafenCity(group) {
  // Großes Wasser
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    makeMat(0x5aa8c8, { roughness: 0.25, metalness: 0.15 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.08;
  water.receiveShadow = true;
  group.add(water);

  // Wellen-Highlights
  for (let i = 0; i < 18; i++) {
    const ripple = new THREE.Mesh(
      new THREE.CircleGeometry(3 + Math.random() * 5, 16),
      makeMat(0x7ec4de, { roughness: 0.2, transparent: true, opacity: 0.35 })
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set((Math.random() - 0.5) * 100, -0.05, (Math.random() - 0.5) * 100);
    group.add(ripple);
  }

  // --- Südliche Straße / Startbereich ---
  addLandRect(group, 0, 45, 36, 28, 0xb8b0a4); // Straße + Bürgersteig
  addWalkableBox(0, 45, 34, 26);
  addPathStrip(group, 0, 45, 5.5, 26); // zentraler Weg

  // Häuser links der Straße
  [[-12, 38], [-12, 46], [-12, 54]].forEach(([x, z], i) => {
    group.add(createCityBuilding(x, z, 5.5 + (i % 2), 7 + i, 5, 0xb85a48 + i * 0x080808));
  });
  // Häuser rechts
  [[12, 40], [12, 52]].forEach(([x, z], i) => {
    group.add(createCityBuilding(x, z, 5, 8, 5.5, i === 0 ? 0xc47058 : 0xa85848));
  });

  // --- Brücke 1 (Süd → mittlere Insel) ---
  addBridge(group, 0, 27.5, 5, 12, 0);
  addWalkableBox(0, 27.5, 4.5, 12);

  // --- Mittlere Insel ---
  addLandRect(group, 0, 14, 64, 22, 0xc4bdb0);
  addWalkableBox(0, 14, 62, 20);
  addPathStrip(group, 0, 20, 4.5, 8); // vom Brückenende
  // Weg nach links zur zweiten Brücke
  addPathStrip(group, -10, 10, 28, 4.2);
  addPathStrip(group, -22, 5, 12, 4.5);

  // Großes Haus links (etwas nördlicher, damit der Weg zur Brücke frei bleibt)
  group.add(createLongWarehouse(-18, 16, 16, 6, 7, 0x9a5548));

  // Elbphilharmonie rechts
  group.add(createElbphilharmonie(18, 13));

  // Hafenkräne vor der Elphi
  group.add(createHarborCrane(10, 22));
  group.add(createHarborCrane(14, 23));
  group.add(createHarborCrane(18, 22.5));

  // Bäume / Grün auf der Insel
  [[-5, 18], [2, 8], [-28, 18], [28, 8]].forEach(([x, z]) => {
    group.add(createTree(x, z, 0.9 + Math.random() * 0.3));
  });

  // --- Brücke 2: SW der mittleren Insel → NE der Brief-Insel ---
  const b2Start = { x: -24, z: 4 };
  const b2End = { x: -28, z: -8 };
  const b2x = (b2Start.x + b2End.x) / 2;
  const b2z = (b2Start.z + b2End.z) / 2;
  const b2Len = Math.hypot(b2End.x - b2Start.x, b2End.z - b2Start.z) + 2.5;
  const b2rot = Math.atan2(b2End.x - b2Start.x, b2End.z - b2Start.z);
  addBridge(group, b2x, b2z, 5.5, b2Len, b2rot);
  addWalkableBox(b2x, b2z, 5.2, b2Len + 1.5, b2rot);
  // Übergangsplatten an beiden Enden
  addLandRect(group, b2Start.x, b2Start.z, 7, 5, 0xc4bdb0);
  addWalkableBox(b2Start.x, b2Start.z, 7, 5);
  addLandRect(group, b2End.x, b2End.z, 7, 5, 0xb8c9a0);
  addWalkableBox(b2End.x, b2End.z, 7, 5);

  // --- Zielinsel (Bank, Paar, Welpe, Brief) ---
  addLandRect(group, -32, -14, 22, 18, 0xb8c9a0);
  addWalkableBox(-32, -14, 20, 16);
  addPathStrip(group, -30, -11, 6, 8);

  // Landmark: Bank + Paar + Welpe
  const sceneSpot = createCoupleBenchScene();
  sceneSpot.position.set(-32, 0, -14);
  group.add(sceneSpot);

  // Pfad-Markierung
  addGuideDots(group, [
    [0, 48], [0, 40], [0, 32], [0, 24], [0, 16],
    [-8, 10], [-18, 6], [-24, 4], [-26, -2], [-28, -8], [-32, -12],
  ]);

  // Wolken
  for (let i = 0; i < 8; i++) {
    const cloud = createCloud();
    cloud.position.set((Math.random() - 0.5) * 100, 22 + Math.random() * 8, (Math.random() - 0.5) * 100);
    group.add(cloud);
    clouds.push(cloud);
  }

  // Fern-Skyline Deko
  [[-50, 40], [45, 35], [50, 0], [-55, -5]].forEach(([x, z], i) => {
    group.add(createCityBuilding(x, z, 4 + i, 10 + i * 2, 4, 0x8a6a60));
  });
}

function addLandRect(group, x, z, w, d, color) {
  const land = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), makeMat(color));
  land.position.set(x, 0.1, z);
  land.receiveShadow = true;
  land.castShadow = true;
  group.add(land);

  // dünner Rand / Kai
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
    makeMat(0x8a8580)
  );
  rim.position.set(x, -0.05, z);
  rim.receiveShadow = true;
  group.add(rim);
}

function addPathStrip(group, x, z, w, d) {
  const path = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), makeMat(0xd4cfc4));
  path.position.set(x, 0.3, z);
  path.receiveShadow = true;
  group.add(path);
}

function addBridge(group, x, z, w, d, rot) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, d), makeMat(0x9a9085));
  deck.position.y = 0.35;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  [-w * 0.45, w * 0.45].forEach((sx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, d), makeMat(0x6e6860));
    rail.position.set(sx, 0.7, 0);
    g.add(rail);
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 0.14), makeMat(0x5a5550));
      post.position.set(sx, 0.55, -d * 0.4 + (i / 4) * d * 0.8);
      g.add(post);
    }
  });

  // Pfeiler im Wasser
  [-d * 0.3, d * 0.3].forEach((pz) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), makeMat(0x7a7570));
    pillar.position.set(0, -0.3, pz);
    g.add(pillar);
  });

  g.position.set(x, 0, z);
  g.rotation.y = rot;
  group.add(g);
}

function addGuideDots(group, points) {
  const mat = makeMat(0xc45a5a, { roughness: 1 });
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i];
    const [x2, z2] = points[i + 1];
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.28, 8), mat);
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(
        x1 + (x2 - x1) * t,
        0.32,
        z1 + (z2 - z1) * t
      );
      group.add(dot);
    }
  }
}

function createCityBuilding(x, z, w, h, d, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(color));
  body.position.y = h * 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Fenster-Raster
  const winMat = makeMat(0xc8e4f5, { roughness: 0.4, metalness: 0.2 });
  const cols = Math.max(2, Math.floor(w / 1.4));
  const rows = Math.max(2, Math.floor(h / 1.6));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.08), winMat);
      win.position.set(
        -w * 0.35 + (c / Math.max(cols - 1, 1)) * w * 0.7,
        1.2 + r * (h - 2) / Math.max(rows - 1, 1),
        d * 0.51
      );
      g.add(win);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.25, d + 0.3), makeMat(0x5a5048));
  roof.position.y = h + 0.1;
  g.add(roof);

  g.position.set(x, 0.28, z);
  return g;
}

function createLongWarehouse(x, z, w, h, d, color) {
  const g = createCityBuilding(x, z, w, h, d, color);
  // flaches Industrie-Dach
  return g;
}

function createElbphilharmonie(x, z) {
  const g = new THREE.Group();

  // Backstein-Sockel (Kaispeicher)
  const brick = new THREE.Mesh(new THREE.BoxGeometry(12, 5.5, 9), makeMat(0x8b3a32));
  brick.position.y = 2.75;
  brick.castShadow = true;
  brick.receiveShadow = true;
  g.add(brick);

  // kleine Fenster im Sockel
  const darkWin = makeMat(0x2a1814);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 8; col++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.1), darkWin);
      w.position.set(-4.5 + col * 1.3, 1.2 + row * 1.1, 4.55);
      g.add(w);
    }
  }

  // Plaza-Schnitt
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.4, 9.4), makeMat(0xd8d2c8));
  plaza.position.y = 5.7;
  g.add(plaza);

  // Glas-Welle oben
  const glassMat = makeMat(0xb8d4e8, { roughness: 0.25, metalness: 0.45, transparent: true, opacity: 0.85 });
  const peaks = [1.2, 2.8, 1.6, 3.4, 2.0, 2.6, 1.4];
  peaks.forEach((ph, i) => {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(1.7, ph, 8.2), glassMat);
    seg.position.set(-5.1 + i * 1.7, 5.9 + ph * 0.5, 0);
    seg.castShadow = true;
    g.add(seg);
  });

  // wellenförmige Dachkante (Spitzen)
  const tipMat = makeMat(0xd0e8f5, { roughness: 0.3, metalness: 0.5 });
  [[-3.5, 3.8], [-0.5, 4.6], [2.5, 3.5], [5, 4.2]].forEach(([ox, oh]) => {
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.1, oh, 4), tipMat);
    tip.position.set(ox, 8.2 + oh * 0.15, 0);
    tip.rotation.y = Math.PI / 4;
    g.add(tip);
  });

  // Bogen-Ausschnitt-Andeutung
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.35, 8, 16, Math.PI),
    makeMat(0xa8c8dc, { roughness: 0.3, metalness: 0.4 })
  );
  arch.position.set(0, 6.2, 4.2);
  arch.rotation.x = Math.PI;
  g.add(arch);

  g.position.set(x, 0.28, z);
  return g;
}

function createHarborCrane(x, z) {
  const g = new THREE.Group();
  const white = makeMat(0xe8e4dc);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.4, 8), white);
  base.position.y = 0.2;
  g.add(base);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 0.25), white);
  mast.position.y = 2.7;
  mast.castShadow = true;
  g.add(mast);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 4.5), white);
  jib.position.set(0, 5, -1.5);
  jib.rotation.x = -0.35;
  g.add(jib);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.8), white);
  counter.position.set(0, 5, 1.2);
  g.add(counter);
  g.position.set(x, 0.28, z);
  g.rotation.y = Math.random() * 0.4 - 0.2;
  return g;
}

function createCoupleBenchScene() {
  const g = new THREE.Group();

  // kleine Grünfläche
  const grass = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20), makeMat(0x8fbf6a));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.32;
  g.add(grass);

  const bench = createBench();
  bench.position.set(0, 0.28, 0);
  g.add(bench);

  // Paar auf der Bank
  const person1 = createSimplePerson(0xffb8c8, 0x2a1a12);
  person1.position.set(-0.4, 0.28, 0.05);
  person1.scale.setScalar(0.85);
  g.add(person1);

  const person2 = createSimplePerson(0x6a9ecc, 0x3a2818);
  person2.position.set(0.4, 0.28, 0.05);
  person2.scale.setScalar(0.9);
  g.add(person2);

  // Welpe vor der Bank
  const puppy = createCritter("dog", 0xd9a86c);
  puppy.position.set(0.2, 0.28, 1.1);
  puppy.scale.setScalar(0.75);
  puppy.rotation.y = Math.PI * 0.85;
  puppy.userData.baseX = 0.2;
  puppy.userData.baseZ = 1.1;
  puppy.userData.baseY = 0.28;
  puppy.userData.baseScale = 0.75;
  puppy.userData.phase = 1.2;
  g.add(puppy);
  critters.push(puppy);

  // Blumen um die Bank
  scatterFlowerFieldLocal(g, -1.5, 1.5, 8, [0xff8fb3, 0xffe07d, 0xffffff]);
  scatterFlowerFieldLocal(g, 1.8, 1.2, 6, [0xff8fb3, 0xc99bff]);

  return g;
}

function createSimplePerson(clothesColor, hairColor) {
  const g = new THREE.Group();
  const skin = makeMat(0xffd9b3);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), makeMat(clothesColor));
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), skin);
  head.position.y = 1.45;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), makeMat(hairColor));
  hair.position.y = 1.5;
  g.add(hair);
  return g;
}

function scatterFlowerFieldLocal(parent, x, z, count, palette) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 1.6;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const f = createFlower(color);
    f.position.set(x + Math.cos(a) * r, 0.28, z + Math.sin(a) * r);
    f.rotation.y = Math.random() * Math.PI * 2;
    parent.add(f);
  }
}

// ============================================================
// WORLD 2: PARIS – Unsere erste Reise
// ============================================================
function buildParis(group) {
  // Seine / Wasser
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    makeMat(0x6a9ab0, { roughness: 0.28, metalness: 0.12 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.08;
  water.receiveShadow = true;
  group.add(water);

  for (let i = 0; i < 14; i++) {
    const ripple = new THREE.Mesh(
      new THREE.CircleGeometry(2.5 + Math.random() * 4, 14),
      makeMat(0x8bb8c8, { roughness: 0.2, transparent: true, opacity: 0.3 })
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set((Math.random() - 0.5) * 90, -0.05, (Math.random() - 0.5) * 90);
    group.add(ripple);
  }

  // --- Südwest-Insel: Start + Notre-Dame ---
  addLandRect(group, -16, 30, 32, 26, 0xc8c2b4);
  addWalkableBox(-16, 30, 30, 24);
  addPathStrip(group, -14, 30, 4.5, 22);

  group.add(createNotreDame(-26, 28));

  // --- Brücke 1 nach Norden (Frau mit Fotoapparat) ---
  addBridge(group, -16, 15, 5, 10, 0);
  addWalkableBox(-16, 15, 4.8, 10);
  const photographer = createPhotographer();
  photographer.position.set(-14.2, 0.35, 15);
  photographer.rotation.y = Math.PI * 0.15;
  group.add(photographer);

  // --- Nordwest-Insel mit Haus ---
  addLandRect(group, -16, 2, 30, 20, 0xc4beb0);
  addWalkableBox(-16, 2, 28, 18);
  addPathStrip(group, -16, 8, 4.5, 8);
  addPathStrip(group, -6, 2, 18, 4.2);

  group.add(createCityBuilding(-22, 0, 10, 5, 6, 0xb87060));

  // --- Brücke 2 nach Osten zum Eiffelturm ---
  addBridge(group, 6, 2, 5, 16, Math.PI / 2);
  addWalkableBox(6, 2, 5, 16, Math.PI / 2);
  addLandRect(group, -2, 2, 6, 6, 0xc4beb0);
  addWalkableBox(-2, 2, 6, 6);
  addLandRect(group, 14, 2, 6, 6, 0xc4beb0);
  addWalkableBox(14, 2, 6, 6);

  // --- Ost-Insel: Eiffelturm + Haus ---
  addLandRect(group, 26, 4, 28, 36, 0xbdb7a8);
  addWalkableBox(26, 4, 26, 34);
  // Trocadéro-artige Platten
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 14), makeMat(0xd8d2c4));
  plaza.position.set(26, 0.32, -4);
  plaza.receiveShadow = true;
  group.add(plaza);
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      if ((i + j) % 2 === 0) continue;
      const tile = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 2.2), makeMat(0xa8a090));
      tile.position.set(20 + i * 2.3, 0.34, -10 + j * 2.3);
      group.add(tile);
    }
  }

  group.add(createEiffelTower(26, -6));
  group.add(createCityBuilding(28, 16, 8, 6, 6, 0xc48868));

  // Bäume am Seine-Ufer
  [[-8, 36], [-4, 22], [-28, 8], [18, 14], [34, -12]].forEach(([x, z]) => {
    group.add(createTree(x, z, 0.85 + Math.random() * 0.25));
  });

  // Kleiner Hase am Turm
  const bunny = createCritter("bunny", 0xf3d9e6);
  bunny.position.set(23, 0.28, -3);
  bunny.userData.baseY = 0.28;
  bunny.userData.baseScale = 1;
  bunny.userData.phase = 2.1;
  group.add(bunny);
  critters.push(bunny);

  addGuideDots(group, [
    [-14, 34], [-14, 26], [-16, 18], [-16, 10], [-16, 4],
    [-8, 2], [0, 2], [8, 2], [16, 2], [22, -2], [26, -5],
  ]);

  for (let i = 0; i < 8; i++) {
    const cloud = createCloud();
    cloud.position.set((Math.random() - 0.5) * 100, 22 + Math.random() * 8, (Math.random() - 0.5) * 100);
    group.add(cloud);
    clouds.push(cloud);
  }
}

function createNotreDame(x, z) {
  const g = new THREE.Group();
  const stone = makeMat(0xd4c8b0);
  const dark = makeMat(0x9a8e78);

  // Hauptkörper
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 7), stone);
  body.position.y = 4.2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Zwei Türme
  [-2.8, 2.8].forEach((tx) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7, 3.2), stone);
    tower.position.set(tx, 11.5, 0);
    tower.castShadow = true;
    g.add(tower);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 3.4), dark);
    top.position.set(tx, 15.1, 0);
    g.add(top);
    // Zinnen
    for (let i = -1; i <= 1; i++) {
      const cren = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.55), stone);
      cren.position.set(tx + i * 1.0, 15.5, 1.4);
      g.add(cren);
    }
  });

  // Rosettenfenster
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.25, 16), makeMat(0x6a8ec8, { roughness: 0.35, metalness: 0.2 }));
  rose.rotation.x = Math.PI / 2;
  rose.position.set(0, 7.2, 3.6);
  g.add(rose);
  const roseCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10), makeMat(0xc9a84a));
  roseCenter.rotation.x = Math.PI / 2;
  roseCenter.position.set(0, 7.2, 3.65);
  g.add(roseCenter);

  // Drei Portale
  [-2.8, 0, 2.8].forEach((px, i) => {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(i === 1 ? 2.2 : 1.8, 3.2, 0.4), dark);
    arch.position.set(px, 1.8, 3.55);
    g.add(arch);
    const door = new THREE.Mesh(new THREE.BoxGeometry(i === 1 ? 1.4 : 1.1, 2.4, 0.2), makeMat(0x4a3020));
    door.position.set(px, 1.3, 3.7);
    g.add(door);
  });

  // Galerie-Andeutung
  const gallery = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.8, 0.5), dark);
  gallery.position.set(0, 5.2, 3.5);
  g.add(gallery);

  g.position.set(x, 0.28, z);
  g.rotation.y = Math.PI * 0.08;
  return g;
}

function createEiffelTower(x, z) {
  const g = new THREE.Group();
  const iron = makeMat(0x6a5a48, { metalness: 0.55, roughness: 0.45 });
  const ironLight = makeMat(0x8a7a68, { metalness: 0.5, roughness: 0.5 });

  // Vier Beine
  const legSpread = 3.2;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 10, 0.45), iron);
    leg.position.set(sx * legSpread, 5, sz * legSpread);
    leg.rotation.x = sz * 0.18;
    leg.rotation.z = -sx * 0.18;
    leg.castShadow = true;
    g.add(leg);
  });

  // Plattformen
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.35, 5.5), ironLight);
  p1.position.y = 9.5;
  g.add(p1);
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 3.2), ironLight);
  p2.position.y = 15;
  g.add(p2);

  // Mittelstück / Spitze
  const mid = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 1.4), iron);
  mid.position.y = 13.5;
  mid.castShadow = true;
  g.add(mid);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 5, 4), ironLight);
  tip.position.y = 20;
  tip.castShadow = true;
  g.add(tip);

  // Querverstrebungen (dezent)
  [4, 7, 11].forEach((hy) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.5 - hy * 0.15, 0.15, 0.15), iron);
    beam.position.y = hy;
    g.add(beam);
    const beam2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 5.5 - hy * 0.15), iron);
    beam2.position.y = hy;
    g.add(beam2);
  });

  g.position.set(x, 0.28, z);
  return g;
}

function createPhotographer() {
  const g = new THREE.Group();
  const skin = makeMat(0xffd9b3);
  const dress = makeMat(0xe8a0b8);
  const hair = makeMat(0x3a2818);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 8), dress);
  body.position.y = 1.0;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), skin);
  head.position.y = 1.52;
  g.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hair
  );
  hairCap.position.y = 1.56;
  g.add(hairCap);

  // Arm hält Kamera
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.35, 3, 6), skin);
  arm.position.set(0.32, 1.15, 0.2);
  arm.rotation.x = -0.9;
  arm.rotation.z = -0.4;
  g.add(arm);

  // Fotoapparat
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.18), makeMat(0x2a2a2a));
  camBody.position.set(0.38, 1.35, 0.42);
  g.add(camBody);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.16, 10), makeMat(0x4a4a4a, { metalness: 0.4 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0.38, 1.35, 0.58);
  g.add(lens);
  const flash = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.08), makeMat(0xe8e4dc));
  flash.position.set(0.38, 1.48, 0.42);
  g.add(flash);

  return g;
}

// ============================================================
// WORLD 3: WOHNUNG (wird renoviert)
// Grundriss: Flur mittig, Wohnzimmer oben rechts mit Esstisch
// ============================================================
function buildApartment(group) {
  const wallMat = makeMat(0xf2ebe0);
  const wallBare = makeMat(0xd8cfc0); // unverputzt / Alt
  const wallPaint = makeMat(0xe8f0e4); // frisch gestrichen
  const floorMat = makeMat(0xc4a882);
  const floorNew = makeMat(0xd4b896);
  const trimMat = makeMat(0x8a7a68);

  // Außenhülle (dunkler Raum drumherum)
  const voidFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), makeMat(0x3a342c));
  voidFloor.rotation.x = -Math.PI / 2;
  voidFloor.position.y = -0.05;
  group.add(voidFloor);

  // Hilfsfunktion: Bodenplatte
  function floor(x, z, w, d, mat) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), mat);
    f.position.set(x, 0.06, z);
    f.receiveShadow = true;
    group.add(f);
    addWalkableBox(x, z, w - 0.3, d - 0.3);
  }

  // Hilfsfunktion: Wandsegment (lücke für Türen manuell)
  function wall(x, z, w, d, h, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h * 0.5, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  const H = 3.2;

  // --- Böden nach Grundriss ---
  // Flur (horizontal mittig), Eingang rechts
  floor(0, 0, 22, 2.8, floorMat);
  // Schlafzimmer oben links
  floor(-7, -5.2, 8.2, 6.4, floorMat);
  // Wohnzimmer oben rechts
  floor(5.5, -5.4, 10.2, 7.0, floorNew);
  // Raum 3 unten links
  floor(-7.2, 5.0, 7.6, 5.2, floorMat);
  // Küche unten mitte
  floor(0.2, 5.0, 5.8, 5.2, floorMat);
  // Bad unten rechts
  floor(6.8, 5.0, 6.0, 5.2, floorMat);

  // Tür-Übergänge Flur ↔ Räume (extra Walkable)
  addWalkableBox(-7, -1.6, 2.2, 1.2); // Schlafzimmer-Tür
  addWalkableBox(4, -1.7, 2.4, 1.4);  // Wohnzimmer-Tür
  addWalkableBox(-7, 1.6, 2.2, 1.2);  // Raum3-Tür
  addWalkableBox(0.2, 1.6, 2.0, 1.2); // Küche-Tür
  addWalkableBox(6.5, 1.6, 2.0, 1.2); // Bad-Tür
  addWalkableBox(11.2, 0, 2.5, 2.4);  // Eingang

  // --- Außenwände ---
  wall(0, -8.6, 23, 0.35, H, wallMat);   // Nord
  wall(0, 7.8, 23, 0.35, H, wallMat);    // Süd
  wall(-11.2, -0.4, 0.35, 16.5, H, wallMat); // West
  // Ost mit Eingangsöffnung
  wall(11.2, -4.5, 0.35, 7.5, H, wallMat);
  wall(11.2, 4.5, 0.35, 6.5, H, wallMat);
  // Türrahmen Eingang
  wall(11.2, -1.35, 0.4, 0.3, H, trimMat);
  wall(11.2, 1.35, 0.4, 0.3, H, trimMat);

  // --- Innenwände Flur ---
  // Nordwand Flur (Schlaf + Wohn), mit Türöffnungen
  wall(-3.5, -1.5, 6.5, 0.3, H, wallBare); // links der Schlaf-Tür? 
  // Schlafzimmer Süd: von x=-11 bis -8.2 und -5.8 bis -3
  wall(-9.5, -1.5, 3.2, 0.3, H, wallBare);
  wall(-4.2, -1.5, 2.8, 0.3, H, wallBare);
  // Wohnzimmer Süd
  wall(1.2, -1.5, 3.5, 0.3, H, wallPaint);
  wall(7.8, -1.5, 5.5, 0.3, H, wallPaint);
  // Trennwand Schlaf | Wohn
  wall(-2.8, -5.2, 0.3, 6.5, H, wallMat);

  // Südwand Flur
  wall(-9.5, 1.5, 3.2, 0.3, H, wallBare);
  wall(-4.5, 1.5, 3.0, 0.3, H, wallBare);
  wall(-1.2, 1.5, 1.6, 0.3, H, wallBare);
  wall(2.0, 1.5, 2.0, 0.3, H, wallBare);
  wall(4.8, 1.5, 2.0, 0.3, H, wallBare);
  wall(9.0, 1.5, 3.5, 0.3, H, wallBare);

  // Trennwände unten: Raum3 | Küche | Bad
  wall(-3.4, 5.0, 0.3, 5.2, H, wallMat);
  wall(3.2, 5.0, 0.3, 5.2, H, wallMat);

  // --- Renovierungs-Details ---
  // Leiter im Flur
  group.add(createLadder(8.5, 0.6));
  // Farbkübel
  group.add(createPaintCan(-1.5, -0.6, 0xe8f0e4));
  group.add(createPaintCan(-0.8, -0.9, 0xf2ebe0));
  group.add(createPaintCan(7.5, -3.5, 0xd4e8f0));
  // Abdeckplane
  const tarp = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.05, 2.2), makeMat(0xc8d4e0));
  tarp.position.set(-5, 0.14, 0);
  tarp.rotation.y = 0.2;
  group.add(tarp);
  // Kartons
  group.add(createCardboardBox(-9, -3.5));
  group.add(createCardboardBox(-8.2, -4.2));
  group.add(createCardboardBox(9, -6.5));
  // Halb gestrichene Wand-Markierung (Wohnzimmer)
  const paintPatch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 3.5), wallPaint);
  paintPatch.position.set(10.9, 1.5, -5);
  group.add(paintPatch);

  // --- Möbel / Räume ---
  // Schlafzimmer: Bett
  group.add(createBed(-7.5, -5.5));

  // Wohnzimmer: Sofa + Esstisch mit Paar
  group.add(createSofa(8.5, -6.5));
  const dining = createDiningCoupleScene();
  dining.position.set(4.5, 0, -5.0);
  group.add(dining);

  // Küche: Zeile
  group.add(createKitchenCounter(0.2, 6.5));

  // Bad: Dusche
  const shower = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.2), makeMat(0xb8c8d0, { transparent: true, opacity: 0.35 }));
  shower.position.set(8.2, 1.1, 5.8);
  group.add(shower);
  const showerTray = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.15, 2.3), makeMat(0xe0e4e8));
  showerTray.position.set(8.2, 0.15, 5.8);
  group.add(showerTray);

  // Raum 3: Werkzeug / Renovierung
  group.add(createCardboardBox(-8.5, 4.5));
  group.add(createCardboardBox(-7.5, 5.5));
  group.add(createPaintCan(-9, 6, 0xf5d0a0));
  const plank = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.35), makeMat(0xb89868));
  plank.position.set(-6, 0.2, 6.2);
  plank.rotation.y = 0.4;
  group.add(plank);

  // Katze im Flur (niedlich)
  const cat = createCritter("cat", 0xf2f0e6);
  cat.position.set(2.5, 0, 0.3);
  cat.userData.baseY = 0;
  cat.userData.baseScale = 0.9;
  cat.userData.phase = 0.7;
  cat.scale.setScalar(0.9);
  group.add(cat);
  critters.push(cat);

  // Deckenlichter (PointLights)
  [[-7, -5], [5, -5], [0, 0], [0, 5]].forEach(([lx, lz]) => {
    const light = new THREE.PointLight(0xfff0d8, 0.55, 12);
    light.position.set(lx, 2.8, lz);
    group.add(light);
  });
}

function createLadder(x, z) {
  const g = new THREE.Group();
  const wood = makeMat(0xa88858);
  [-0.35, 0.35].forEach((sx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.8, 0.1), wood);
    rail.position.set(sx, 1.4, 0);
    g.add(rail);
  });
  for (let i = 0; i < 6; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), wood);
    rung.position.set(0, 0.35 + i * 0.4, 0);
    g.add(rung);
  }
  g.position.set(x, 0, z);
  g.rotation.z = -0.25;
  g.rotation.y = -0.4;
  return g;
}

function createPaintCan(x, z, color) {
  const g = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.55, 10), makeMat(0xb0b0b0, { metalness: 0.4, roughness: 0.5 }));
  can.position.y = 0.28;
  can.castShadow = true;
  g.add(can);
  const paint = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 10), makeMat(color));
  paint.position.y = 0.52;
  g.add(paint);
  g.position.set(x, 0, z);
  return g;
}

function createCardboardBox(x, z) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), makeMat(0xc4a06a));
  box.position.y = 0.35;
  box.castShadow = true;
  g.add(box);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.15), makeMat(0xe8d8a0));
  tape.position.y = 0.7;
  g.add(tape);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * 0.5;
  return g;
}

function createBed(x, z) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 3.2), makeMat(0x8a6a48));
  frame.position.y = 0.3;
  frame.castShadow = true;
  g.add(frame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 3.0), makeMat(0xf0e8dc));
  mattress.position.y = 0.55;
  g.add(mattress);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.55), makeMat(0xe8f0f8));
  pillow.position.set(0, 0.72, -1.1);
  g.add(pillow);
  g.position.set(x, 0, z);
  return g;
}

function createSofa(x, z) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 1.1), makeMat(0x7a9ab0));
  seat.position.y = 0.4;
  seat.castShadow = true;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 0.3), makeMat(0x6a8aa0));
  back.position.set(0, 0.85, -0.45);
  g.add(back);
  g.position.set(x, 0, z);
  g.rotation.y = -0.4;
  return g;
}

function createKitchenCounter(x, z) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.9, 1.0), makeMat(0xe8e0d4));
  base.position.y = 0.45;
  base.castShadow = true;
  g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.08, 1.1), makeMat(0x9a9890));
  top.position.y = 0.94;
  g.add(top);
  g.position.set(x, 0, z);
  return g;
}

function createDiningCoupleScene() {
  const g = new THREE.Group();

  // Tisch
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.2), makeMat(0xa88858));
  tableTop.position.y = 0.85;
  tableTop.castShadow = true;
  g.add(tableTop);
  [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), makeMat(0x8a6848));
    leg.position.set(lx, 0.4, lz);
    g.add(leg);
  });

  // Teller & Gläser
  [-0.45, 0.45].forEach((px) => {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), makeMat(0xf5f0e8));
    plate.position.set(px, 0.92, 0);
    g.add(plate);
    const food = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), makeMat(0xd47858));
    food.scale.set(1, 0.4, 1);
    food.position.set(px, 0.96, 0);
    g.add(food);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.22, 8), makeMat(0xb8d8e8, { transparent: true, opacity: 0.55 }));
    glass.position.set(px + 0.35, 1.02, 0.25);
    g.add(glass);
  });

  // Stühle
  [-1.0, 1.0].forEach((sx, i) => {
    const chair = createDiningChair();
    chair.position.set(sx * 0.15, 0, sx > 0 ? 0.95 : -0.95);
    chair.rotation.y = sx > 0 ? Math.PI : 0;
    g.add(chair);
  });

  // Paar sitzend am Tisch
  const person1 = createSimplePerson(0xffb8c8, 0x2a1a12);
  person1.position.set(-0.15, -0.15, -0.85);
  person1.scale.setScalar(0.82);
  person1.rotation.y = 0;
  // etwas „sitzender“
  person1.position.y = -0.05;
  g.add(person1);

  const person2 = createSimplePerson(0x6a9ecc, 0x3a2818);
  person2.position.set(0.15, -0.05, 0.85);
  person2.scale.setScalar(0.85);
  person2.rotation.y = Math.PI;
  g.add(person2);

  // Kerze in der Mitte
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 8), makeMat(0xf5f0e0));
  candle.position.y = 1.05;
  g.add(candle);
  const flame = new THREE.PointLight(0xffaa66, 0.4, 4);
  flame.position.y = 1.25;
  g.add(flame);

  return g;
}

function createDiningChair() {
  const g = new THREE.Group();
  const wood = makeMat(0x8a6848);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), wood);
  seat.position.y = 0.48;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.08), wood);
  back.position.set(0, 0.78, -0.24);
  g.add(back);
  [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.48, 0.07), wood);
    leg.position.set(lx, 0.24, lz);
    g.add(leg);
  });
  return g;
}

// ============================================================
// WORLD 4: KÖLN – HBF, Dom, Treppe, Rheinbrücke
// ============================================================
function buildKoeln(group) {
  // Platz / Steinboden
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(55, 48), makeMat(0xb8b0a4));
  plaza.rotation.x = -Math.PI / 2;
  plaza.receiveShadow = true;
  group.add(plaza);
  addWalkableBox(0, 0, 90, 90);

  // Wasserstreifen NW (Rhein-Andeutung)
  const rhein = new THREE.Mesh(
    new THREE.BoxGeometry(40, 0.08, 18),
    makeMat(0x5a90a8, { roughness: 0.3, metalness: 0.15 })
  );
  rhein.position.set(-28, -0.02, -28);
  group.add(rhein);

  // --- HBF (unten links) ---
  group.add(createHbfBuilding(-24, 24));

  // Startbereich-Pfad
  addPathStrip(group, -8, 26, 5, 8);
  addPathStrip(group, 4, 26, 18, 5);
  addPathStrip(group, 12, 14, 5, 22);
  addPathStrip(group, 0, -8, 28, 5);
  addPathStrip(group, -14, -18, 12, 5);

  // --- Treppe diagonal (Mitte → unten rechts) ---
  group.add(createGrandStairs(10, 12, 0.65));

  // --- Kölner Dom (oben rechts) ---
  group.add(createKoelnerDom(20, -14));

  // --- Rheinbrücke mit Pärchen + Brief ---
  addBridge(group, -22, -22, 6, 18, Math.PI * 0.15);
  addWalkableBox(-22, -22, 5.5, 18, Math.PI * 0.15);
  // Brückenanschluss vom Platz
  addLandRect(group, -14, -16, 10, 8, 0xb8b0a4);
  addWalkableBox(-14, -16, 10, 8);

  const couple = createBridgeCouple();
  couple.position.set(-22, 0.35, -20);
  couple.rotation.y = Math.PI * 0.4;
  group.add(couple);

  // Wegpunkte
  addGuideDots(group, [
    [-8, 26], [2, 26], [12, 26], [12, 14], [12, 2],
    [4, -8], [-8, -12], [-16, -18], [-22, -22],
  ]);

  // Bäume / Laternen
  [[-5, 18], [25, 20], [5, -20], [-30, 10]].forEach(([x, z]) => {
    group.add(createTree(x, z, 0.9));
  });
  [[0, 20], [18, 0], [-10, -5]].forEach(([x, z]) => {
    group.add(createStreetLamp(x, z));
  });

  for (let i = 0; i < 7; i++) {
    const cloud = createCloud();
    cloud.position.set((Math.random() - 0.5) * 90, 22 + Math.random() * 6, (Math.random() - 0.5) * 90);
    group.add(cloud);
    clouds.push(cloud);
  }
}

function createHbfBuilding(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), makeMat(0xc8c0b4));
  body.position.y = 3;
  body.castShadow = true;
  g.add(body);
  // Glasdach-Andeutung
  const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 8), makeMat(0x8ab0c8, { metalness: 0.35, roughness: 0.4 }));
  roof.position.y = 6.3;
  g.add(roof);
  // Bögen / Eingang
  for (let i = 0; i < 4; i++) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.5, 0.3), makeMat(0x6a6058));
    arch.position.set(-4.5 + i * 3, 1.8, 5.2);
    g.add(arch);
  }
  const sign = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.2), makeMat(0xd4453a));
  sign.position.set(0, 5.2, 5.2);
  g.add(sign);
  g.position.set(x, 0, z);
  return g;
}

function createGrandStairs(x, z, rot) {
  const g = new THREE.Group();
  const stone = makeMat(0xa8a098);
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.28, 1.1), stone);
    step.position.set(0, 0.14 + i * 0.22, -i * 1.0);
    step.castShadow = true;
    step.receiveShadow = true;
    g.add(step);
  }
  // Geländer
  [-2.6, 2.6].forEach((sx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, steps * 1.0), makeMat(0x7a7068));
    rail.position.set(sx, 1.2, -(steps * 0.5) + 0.5);
    g.add(rail);
  });
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  // Walkable entlang der Treppe (flach genug zum Laufen)
  const len = steps * 1.0;
  const cx = x + Math.sin(rot) * (-len * 0.5);
  const cz = z + Math.cos(rot) * (-len * 0.5);
  addWalkableBox(cx, cz, 5, len + 2, rot);
  return g;
}

function createKoelnerDom(x, z) {
  const g = new THREE.Group();
  const stone = makeMat(0xd0c8b8);
  const dark = makeMat(0x9a9080);

  const nave = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 10), stone);
  nave.position.y = 5;
  nave.castShadow = true;
  g.add(nave);

  // Zwei gotische Türme
  [-4.5, 4.5].forEach((tx) => {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4.2, 18, 4.2), stone);
    tower.position.set(tx, 14, -1);
    tower.castShadow = true;
    g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 4), dark);
    spire.position.set(tx, 27, -1);
    spire.rotation.y = Math.PI / 4;
    g.add(spire);
  });

  // Mittelgiebel
  const gable = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 4), stone);
  gable.position.set(0, 12, 4);
  gable.rotation.y = Math.PI / 4;
  g.add(gable);

  // Rosette
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 16), makeMat(0x5a78a8, { roughness: 0.35 }));
  rose.rotation.x = Math.PI / 2;
  rose.position.set(0, 7, 5.2);
  g.add(rose);

  g.position.set(x, 0, z);
  return g;
}

function createStreetLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6), makeMat(0x4a4a48));
  pole.position.y = 1.6;
  g.add(pole);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), makeMat(0xffe8a0, { roughness: 0.4 }));
  lamp.position.y = 3.3;
  g.add(lamp);
  const light = new THREE.PointLight(0xffe8a0, 0.35, 10);
  light.position.y = 3.3;
  g.add(light);
  g.position.set(x, 0, z);
  return g;
}

function createBridgeCouple() {
  const g = new THREE.Group();
  const p1 = createSimplePerson(0xffb8c8, 0x2a1a12);
  p1.position.set(-0.35, 0, 0);
  p1.scale.setScalar(0.85);
  g.add(p1);
  const p2 = createSimplePerson(0x6a9ecc, 0x3a2818);
  p2.position.set(0.35, 0, 0);
  p2.scale.setScalar(0.9);
  g.add(p2);
  return g;
}

// ============================================================
// WORLD 5: DÜSSELDORF – Nacht, Brücke, Feuerwerk, letzter Brief
// ============================================================
function buildDuesseldorf(group) {
  // Nacht-Wasser (Rhein)
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    makeMat(0x1a3048, { roughness: 0.25, metalness: 0.2 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.1;
  group.add(water);

  // Ufer / Häuser unten
  addLandRect(group, 0, 28, 70, 16, 0x3a3a48);
  addWalkableBox(0, 28, 68, 14);

  // Düsseldorf Häuser-Skyline
  const houseColors = [0x4a3a50, 0x3a4a58, 0x504038, 0x384850, 0x453848];
  for (let i = 0; i < 12; i++) {
    const hx = -30 + i * 5.5;
    const hh = 4 + (i % 4) * 1.8 + Math.random() * 2;
    const b = createCityBuilding(hx, 32, 4, hh, 4.5, houseColors[i % houseColors.length]);
    // Fensterlichter
    const glow = new THREE.PointLight(0xffaa66, 0.25, 8);
    glow.position.set(hx, hh * 0.6, 30);
    group.add(glow);
    group.add(b);
  }

  // --- Brücke diagonal SW → NW ---
  const bStart = { x: -18, z: 18 };
  const bEnd = { x: -16, z: -14 };
  const bx = (bStart.x + bEnd.x) / 2;
  const bz = (bStart.z + bEnd.z) / 2;
  const bLen = Math.hypot(bEnd.x - bStart.x, bEnd.z - bStart.z) + 3;
  const brot = Math.atan2(bEnd.x - bStart.x, bEnd.z - bStart.z);

  addBridge(group, bx, bz, 6, bLen, brot);
  addWalkableBox(bx, bz, 5.5, bLen + 2, brot);
  addLandRect(group, bStart.x, bStart.z, 8, 8, 0x4a4a58);
  addWalkableBox(bStart.x, bStart.z, 8, 8);
  addLandRect(group, bEnd.x, bEnd.z, 8, 8, 0x4a4a58);
  addWalkableBox(bEnd.x, bEnd.z, 8, 8);

  // Pärchen schaut Feuerwerk (Blick nach Osten / Rhein)
  const couple = createBridgeCouple();
  couple.position.set(-14, 0.35, -8);
  couple.rotation.y = Math.PI * 0.55;
  group.add(couple);

  // Wegpunkte auf der Brücke
  addGuideDots(group, [
    [-18, 18], [-17, 10], [-16, 2], [-15, -4], [-14, -8],
  ]);

  // Straßenlaternen auf der Brücke
  [[-17, 12], [-16, 2], [-15, -6]].forEach(([x, z]) => {
    group.add(createStreetLamp(x, z));
  });

  // Mond
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12), makeMat(0xf0e8d0, { roughness: 1 }));
  moon.position.set(25, 28, -20);
  group.add(moon);

  // Sterne (kleine Punkte)
  for (let i = 0; i < 40; i++) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 4, 4),
      makeMat(0xffffff, { roughness: 1 })
    );
    star.position.set((Math.random() - 0.5) * 100, 18 + Math.random() * 20, (Math.random() - 0.5) * 100);
    group.add(star);
  }

  // Feuerwerk startet über dem Rhein (rechts)
  fireworkTimer = 0.5;
}

function clearFireworks() {
  fireworks.forEach((f) => {
    if (f.parent) f.parent.remove(f);
    if (f.geometry) f.geometry.dispose();
    if (f.material) f.material.dispose();
  });
  fireworks.length = 0;
  fireworkTimer = 999;
}

function spawnFireworkBurst(x, y, z) {
  const colors = [0xff6b8a, 0xffe07d, 0x7ec8ff, 0xc99bff, 0xff9d6c, 0x8fd35f];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const count = 28 + Math.floor(Math.random() * 16);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.1, 4, 4), mat);
    p.position.set(x, y, z);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 4 + Math.random() * 6;
    p.userData.vx = Math.sin(phi) * Math.cos(theta) * speed;
    p.userData.vy = Math.cos(phi) * speed * 0.85 + 1;
    p.userData.vz = Math.sin(phi) * Math.sin(theta) * speed;
    p.userData.life = 1.2 + Math.random() * 0.8;
    p.userData.maxLife = p.userData.life;
    scene.add(p);
    fireworks.push(p);
  }
}

function spawnFireworkRocket() {
  const x = 8 + Math.random() * 28;
  const z = -8 + (Math.random() - 0.5) * 20;
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const rocket = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), mat);
  rocket.position.set(x, 0.5, z);
  rocket.userData.vy = 18 + Math.random() * 8;
  rocket.userData.life = 1.1 + Math.random() * 0.4;
  rocket.userData.isRocket = true;
  rocket.userData.burstY = 14 + Math.random() * 8;
  scene.add(rocket);
  fireworks.push(rocket);
}

function updateFireworks(delta) {
  if (WORLDS[currentWorldIndex]?.id !== "duesseldorf") return;

  fireworkTimer -= delta;
  if (fireworkTimer <= 0) {
    spawnFireworkRocket();
    fireworkTimer = 0.6 + Math.random() * 1.1;
  }

  for (let i = fireworks.length - 1; i >= 0; i--) {
    const p = fireworks[i];
    p.userData.life -= delta;

    if (p.userData.isRocket) {
      p.position.y += p.userData.vy * delta;
      p.userData.vy -= 6 * delta;
      if (p.position.y >= p.userData.burstY || p.userData.life <= 0) {
        spawnFireworkBurst(p.position.x, p.position.y, p.position.z);
        scene.remove(p);
        fireworks.splice(i, 1);
      }
      continue;
    }

    p.userData.vy -= 9 * delta;
    p.position.x += p.userData.vx * delta;
    p.position.y += p.userData.vy * delta;
    p.position.z += p.userData.vz * delta;
    p.userData.vx *= 0.98;
    p.userData.vz *= 0.98;
    if (p.material) p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);

    if (p.userData.life <= 0 || p.position.y < -1) {
      scene.remove(p);
      if (p.geometry) p.geometry.dispose();
      if (p.material) p.material.dispose();
      fireworks.splice(i, 1);
    }
  }
}

// ============================================================
// WORLD (optional): WIESE – bleibt im Code, aktuell nicht in WORLDS
// ============================================================
function buildMeadowWorld(group, world) {
  const boundaryRadius = 46;
  addWalkableBox(0, 0, boundaryRadius * 2, boundaryRadius * 2);

  const groundMat = makeMat(0x8fd35f);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(boundaryRadius + 15, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * boundaryRadius;
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2 + Math.random() * 4, 10), makeMat(0x7ec653));
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
    patch.receiveShadow = true;
    group.add(patch);
  }

  scatterFlowerField(0, 4, 8, [0xffffff]);

  const spots = world.spots;
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 14 + Math.random() * (boundaryRadius - 8);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (tooCloseToSpots(x, z, spots, 4)) continue;
    group.add(createTree(x, z, 0.85 + Math.random() * 0.5));
  }

  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * (boundaryRadius - 4);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (tooCloseToSpots(x, z, spots, 2.5)) continue;
    group.add(createBush(x, z));
  }

  const palettes = [
    [0xff8fb3, 0xffe07d, 0xffffff],
    [0xc99bff, 0xfff2b0, 0xffffff],
    [0xff9d6c, 0xffe07d, 0xff8fb3],
  ];
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * (boundaryRadius - 6);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (tooCloseToSpots(x, z, spots, 2)) continue;
    scatterFlowerField(x, z, 5 + Math.floor(Math.random() * 5), palettes[i % palettes.length]);
  }

  [[-38, -10], [30, 30], [-30, 32], [38, -30]].forEach(([x, z]) => {
    group.add(createHill(x, z, 6 + Math.random() * 3));
  });

  for (let i = 0; i < 10; i++) {
    const cloud = createCloud();
    cloud.position.set((Math.random() - 0.5) * 90, 20 + Math.random() * 8, (Math.random() - 0.5) * 90);
    group.add(cloud);
    clouds.push(cloud);
  }

  spots.forEach((spot) => {
    const landmark = buildLandmark(spot);
    if (landmark) group.add(landmark);
    group.add(createPawTrail(0, 2, spot.x, spot.z));
  });
}

function tooCloseToSpots(x, z, spots, margin) {
  for (const s of spots) {
    if (Math.hypot(x - s.x, z - s.z) < 6 + margin) return true;
  }
  if (Math.hypot(x, z) < 6) return true;
  return false;
}

function buildLandmark(spot) {
  const g = new THREE.Group();
  g.position.set(spot.x, 0, spot.z);
  if (spot.landmark === "tree") {
    g.add(createTree(0, -1.5, 1.4));
  } else if (spot.landmark === "pond") {
    g.add(createPond(1.5, -1));
  } else if (spot.landmark === "flowers") {
    scatterFlowerField(spot.x, spot.z, 14, [0xff8fb3, 0xfff2b0, 0xc99bff]);
    return null;
  } else if (spot.landmark === "hill") {
    const bench = createBench();
    bench.position.set(-1, 0, -1.5);
    g.add(bench);
  } else if (spot.landmark === "cottage") {
    const cottage = createCottage();
    cottage.position.set(-1, 0, -4);
    g.add(cottage);
  }
  return g;
}

// ============================================================
// SHARED PROP BUILDERS
// ============================================================
function createTree(x, z, scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.5, 6), makeMat(0x8a6142));
  trunk.position.y = 0.75;
  trunk.castShadow = true;
  g.add(trunk);
  const leafColors = [0x8bd46e, 0x7bc85e, 0x9de26a];
  for (let i = 0; i < 3; i++) {
    const s = 1.15 - i * 0.2;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), makeMat(leafColors[i % leafColors.length]));
    leaf.position.y = 1.55 + i * 0.7;
    leaf.rotation.y = Math.random() * Math.PI;
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}

function createBush(x, z) {
  const g = new THREE.Group();
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const s = 0.5 + Math.random() * 0.35;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), makeMat(0x7bc85e));
    b.position.set((Math.random() - 0.5) * 0.6, s * 0.7, (Math.random() - 0.5) * 0.6);
    b.castShadow = true;
    g.add(b);
  }
  g.position.set(x, 0, z);
  return g;
}

function createFlower(color) {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), makeMat(0x5fae4a));
  stem.position.y = 0.2;
  g.add(stem);
  const petalMat = makeMat(color);
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), petalMat);
    const a = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.08, 0.42, Math.sin(a) * 0.08);
    petal.scale.set(1, 0.6, 1);
    g.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), makeMat(0xffe07d));
  center.position.y = 0.42;
  g.add(center);
  return g;
}

function scatterFlowerField(x, z, count, palette) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 2.2;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const f = createFlower(typeof color === "string" ? parseInt(color) : color);
    f.position.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
    f.rotation.y = Math.random() * Math.PI * 2;
    if (worldGroup) worldGroup.add(f);
    else scene.add(f);
  }
}

function createPond(x, z) {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), makeMat(0x6ec6e6, { roughness: 0.3 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, -0.05, z);
  g.add(water);
  for (let i = 0; i < 4; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), makeMat(0x4fae5a));
    pad.rotation.x = -Math.PI / 2;
    const a = Math.random() * Math.PI * 2, r = Math.random() * 2.2;
    pad.position.set(x + Math.cos(a) * r, 0.01, z + Math.sin(a) * r);
    g.add(pad);
  }
  return g;
}

function createBench() {
  const g = new THREE.Group();
  const seatMat = makeMat(0xa9773f);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.5), seatMat);
  seat.position.y = 0.5;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.1), seatMat);
  back.position.set(0, 0.75, -0.22);
  g.add(back);
  [-0.6, 0.6].forEach((lx) => {
    [0.2, -0.2].forEach((lz) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), seatMat);
      leg.position.set(lx, 0.25, lz);
      g.add(leg);
    });
  });
  return g;
}

function createCottage() {
  const g = new THREE.Group();
  const wallMat = makeMat(0xfff3d6);
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.6), wallMat);
  body.position.y = 1;
  body.castShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), makeMat(0xd9736b));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.7;
  roof.castShadow = true;
  g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.1), makeMat(0x8a6142));
  door.position.set(0, 0.55, 1.31);
  g.add(door);
  [-0.9, 0.9].forEach((wx) => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), makeMat(0xbdeaff));
    win.position.set(wx, 1.3, 1.31);
    g.add(win);
  });
  return g;
}

function createHill(x, z, scale) {
  const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), makeMat(0x7bc85e));
  hill.scale.set(scale, scale * 0.55, scale);
  hill.position.set(x, -scale * 0.25, z);
  hill.receiveShadow = true;
  return hill;
}

function createCloud() {
  const g = new THREE.Group();
  const mat = makeMat(0xffffff, { roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const s = 1.3 + Math.random() * 1;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
    puff.position.set(i * 1.4 - 2, Math.random() * 0.4, (Math.random() - 0.5) * 1);
    g.add(puff);
  }
  return g;
}

function createPawTrail(fromX, fromZ, toX, toZ) {
  const g = new THREE.Group();
  const dx = toX - fromX, dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.1) return g;
  const steps = Math.floor(dist / 2.4);
  const dirX = dx / dist, dirZ = dz / dist;
  const perpX = -dirZ, perpZ = dirX;
  const pawMat = makeMat(0x5a3f2b, { roughness: 1 });
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const wob = Math.sin(t * 8) * 0.4;
    const side = i % 2 === 0 ? 1 : -1;
    const px = fromX + dirX * dist * t + perpX * (wob + side * 0.3);
    const pz = fromZ + dirZ * dist * t + perpZ * (wob + side * 0.3);
    const paw = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), pawMat);
    pad.rotation.x = -Math.PI / 2;
    paw.add(pad);
    for (let k = 0; k < 3; k++) {
      const toe = new THREE.Mesh(new THREE.CircleGeometry(0.045, 6), pawMat);
      toe.rotation.x = -Math.PI / 2;
      toe.position.set((k - 1) * 0.09, 0, 0.14);
      paw.add(toe);
    }
    paw.position.set(px, 0.015, pz);
    paw.rotation.y = Math.atan2(dirX, dirZ) + (Math.random() - 0.5) * 0.3;
    g.add(paw);
  }
  return g;
}

let sparkleTexture = null;
function getSparkleTexture() {
  if (sparkleTexture) return sparkleTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,250,210,1)");
  grad.addColorStop(0.4, "rgba(255,230,150,0.8)");
  grad.addColorStop(1, "rgba(255,230,150,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  sparkleTexture = new THREE.CanvasTexture(c);
  return sparkleTexture;
}

function createEnvelope(index) {
  const g = new THREE.Group();
  const palette = [0xffe3ec, 0xfff6d9, 0xe3f0ff, 0xf0e3ff, 0xe3ffe9, 0xffe9d9];
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.62), makeMat(palette[index % palette.length]));
  base.castShadow = true;
  g.add(base);
  const flap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.32, 3), makeMat(0xffd4e2));
  flap.rotation.x = -Math.PI / 2;
  flap.rotation.z = Math.PI / 6;
  flap.scale.set(1.05, 1, 0.72);
  flap.position.y = 0.05;
  g.add(flap);
  const seal = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), makeMat(0xe5637f));
  seal.scale.set(1, 0.5, 1);
  seal.position.y = 0.11;
  g.add(seal);

  const sparkleGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.SpriteMaterial({ map: getSparkleTexture(), transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    const s = 0.25 + Math.random() * 0.2;
    sprite.scale.set(s, s, s);
    sprite.userData.angle = (i / 5) * Math.PI * 2;
    sprite.userData.radius = 0.7 + Math.random() * 0.3;
    sprite.userData.yOff = Math.random() * 0.6;
    sparkleGroup.add(sprite);
  }
  g.add(sparkleGroup);
  g.userData.sparkles = sparkleGroup;

  const glow = new THREE.PointLight(0xfff2c0, 0.6, 3);
  glow.position.y = 0.3;
  g.add(glow);

  g.userData.baseY = 1.1;
  return g;
}

function createCritter(type, color) {
  const g = new THREE.Group();
  const bodyMat = makeMat(color);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.36, 4, 8), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.32;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), bodyMat);
  head.position.set(0.4, 0.42, 0);
  head.castShadow = true;
  g.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), makeMat(0xfff2e0));
  snout.position.set(0.58, 0.36, 0);
  g.add(snout);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2b1c14 });
  [-0.08, 0.08].forEach((o) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.033, 6, 6), eyeMat);
    eye.position.set(0.56, 0.46, o);
    g.add(eye);
  });

  if (type === "dog") {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), bodyMat);
      ear.scale.set(0.55, 1, 0.35);
      ear.position.set(0.3, 0.56, side * 0.22);
      ear.rotation.z = side * 0.4;
      g.add(ear);
    });
  } else if (type === "cat") {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), bodyMat);
      ear.position.set(0.32, 0.63, side * 0.15);
      g.add(ear);
    });
  } else {
    [-1, 1].forEach((side) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.32, 2, 6), makeMat(0xffe4ee));
      ear.position.set(0.26, 0.8, side * 0.12);
      ear.rotation.z = side * 0.15;
      g.add(ear);
    });
  }

  let tail;
  if (type === "bunny") {
    tail = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), makeMat(0xffffff));
    tail.position.set(-0.4, 0.34, 0);
  } else {
    tail = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.36, 6), bodyMat);
    tail.position.set(-0.48, 0.46, 0);
    tail.rotation.z = Math.PI / 2.5;
  }
  g.add(tail);

  [[0.2, 0.12], [0.2, -0.12], [-0.2, 0.12], [-0.2, -0.12]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.26, 6), bodyMat);
    leg.position.set(lx, 0.13, lz);
    leg.castShadow = true;
    g.add(leg);
  });

  g.userData.tail = tail;
  g.userData.type = type;
  return g;
}

function createLimb(length, radius, mat) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), mat);
  mesh.position.y = -(length / 2 + radius);
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

function createNita() {
  const g = new THREE.Group();
  const skin = makeMat(0xffd9b3);
  const hairMat = makeMat(0x2a1a12);
  const dressMat = makeMat(0xff9dc0);
  const shoeMat = makeMat(0xffffff);

  const leftLegPivot = createLimb(0.42, 0.13, skin);
  leftLegPivot.position.set(-0.17, 0.85, 0);
  const rightLegPivot = createLimb(0.42, 0.13, skin);
  rightLegPivot.position.set(0.17, 0.85, 0);
  g.add(leftLegPivot, rightLegPivot);

  [leftLegPivot, rightLegPivot].forEach((legPivot) => {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), shoeMat);
    shoe.scale.set(1, 0.55, 1.3);
    shoe.position.set(0, -0.68, 0.06);
    shoe.castShadow = true;
    legPivot.children[0].add(shoe);
  });

  const body = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.95, 10), dressMat);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 10), makeMat(0xffc4dd));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.48;
  g.add(collar);

  const leftArmPivot = createLimb(0.4, 0.1, skin);
  leftArmPivot.position.set(-0.46, 1.42, 0);
  leftArmPivot.rotation.z = 0.3;
  const rightArmPivot = createLimb(0.4, 0.1, skin);
  rightArmPivot.position.set(0.46, 1.42, 0);
  rightArmPivot.rotation.z = -0.3;
  g.add(leftArmPivot, rightArmPivot);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.455, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hairCap.position.y = 1.8;
  hairCap.castShadow = true;
  g.add(hairCap);

  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 12, Math.PI * 0.15, Math.PI * 1.35, Math.PI * 0.15, Math.PI * 0.55), hairMat);
  hairBack.position.y = 1.78;
  hairBack.rotation.y = -Math.PI / 2;
  g.add(hairBack);

  [-1, 1].forEach((side) => {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), hairMat);
    bun.position.set(side * 0.42, 1.78, 0.05);
    g.add(bun);
    const strand = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), hairMat);
    strand.position.set(side * 0.44, 1.45, 0.05);
    strand.rotation.z = side * 0.15;
    g.add(strand);
  });

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1a12 });
  [-0.14, 0.14].forEach((o) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
    eye.scale.set(1, 1.3, 0.6);
    eye.position.set(o, 1.8, 0.39);
    g.add(eye);
  });

  [-0.24, 0.24].forEach((o) => {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), makeMat(0xff9db3, { roughness: 1 }));
    blush.position.set(o, 1.68, 0.4);
    g.add(blush);
  });

  g.userData.limbs = { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot };
  g.position.set(0, 0, 6);
  return g;
}

// ============================================================
// INPUT
// ============================================================
function setupInput() {
  const joyBase = document.getElementById("joystick-base");
  const joyKnob = document.getElementById("joystick-knob");

  function joyStart(clientX, clientY, id) {
    joystickActive = true;
    joystickTouchId = id;
    const rect = joyBase.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joyMove(clientX, clientY);
  }
  function joyMove(clientX, clientY) {
    if (!joystickActive) return;
    let dx = clientX - joystickCenter.x;
    let dy = clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_MAX) {
      dx = (dx / dist) * JOY_MAX;
      dy = (dy / dist) * JOY_MAX;
    }
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.x = dx / JOY_MAX;
    input.y = -dy / JOY_MAX;
  }
  function joyEnd() {
    joystickActive = false;
    joystickTouchId = null;
    joyKnob.style.transform = `translate(0px, 0px)`;
    input.x = 0;
    input.y = 0;
  }

  joyBase.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyStart(t.clientX, t.clientY, t.identifier);
  }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) joyMove(t.clientX, t.clientY);
      if (t.identifier === orbitTouchId) {
        const delta = t.clientX - lastOrbitX;
        camOrbitAngle -= delta * 0.005;
        lastOrbitX = t.clientX;
      }
    }
  }, { passive: false });
  window.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) joyEnd();
      if (t.identifier === orbitTouchId) orbitTouchId = null;
    }
  });

  const canvas = document.getElementById("game");
  canvas.addEventListener("touchstart", (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.35 && orbitTouchId === null) {
        orbitTouchId = t.identifier;
        lastOrbitX = t.clientX;
      }
    }
  }, { passive: false });

  joyBase.addEventListener("mousedown", (e) => { joyStart(e.clientX, e.clientY, "mouse"); });
  window.addEventListener("mousemove", (e) => {
    if (joystickActive && joystickTouchId === "mouse") joyMove(e.clientX, e.clientY);
    if (orbitDragging) {
      const delta = e.clientX - lastOrbitX;
      camOrbitAngle -= delta * 0.005;
      lastOrbitX = e.clientX;
    }
  });
  window.addEventListener("mouseup", () => {
    if (joystickTouchId === "mouse") joyEnd();
    orbitDragging = false;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.clientX > window.innerWidth * 0.35) {
      orbitDragging = true;
      lastOrbitX = e.clientX;
    }
  });

  window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
  window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

  document.getElementById("open-prompt").addEventListener("click", () => {
    if (nearestOpenIndex >= 0) openLetter(nearestOpenIndex);
  });

  document.getElementById("close-letter").addEventListener("click", () => {
    document.getElementById("letter-modal").classList.add("hidden");
    maybeAdvanceWorld();
  });

  document.getElementById("start-btn").addEventListener("click", startGame);
  document.getElementById("restart-btn").addEventListener("click", () => location.reload());

  const nextBtn = document.getElementById("next-world-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      document.getElementById("world-transition").classList.add("hidden");
      transitioning = false;
      loadWorld(currentWorldIndex + 1);
    });
  }
}

function startGame() {
  document.getElementById("start-screen").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  document.getElementById("joystick-base").classList.remove("hidden");
  gameStarted = true;
}

// ============================================================
// GAME LOGIC
// ============================================================
function openLetter(index) {
  const letter = letters[index];
  if (letter.opened) return;
  letter.opened = true;
  foundCount++;
  document.getElementById("found-count").textContent = foundCount;

  const content = (typeof LETTERS_CONTENT !== "undefined" && LETTERS_CONTENT[letter.contentIndex]) || {
    title: "Ein Brief",
    text: "..."
  };
  document.getElementById("letter-title").textContent = content.title;
  document.getElementById("letter-text").textContent = content.text;
  document.getElementById("letter-modal").classList.remove("hidden");
  document.getElementById("open-prompt").classList.add("hidden");

  spawnHearts(letter.group.position);
}

function maybeAdvanceWorld() {
  if (transitioning) return;
  const allOpened = letters.every((l) => l.opened);
  if (!allOpened) return;

  if (currentWorldIndex < WORLDS.length - 1) {
    transitioning = true;
    const next = WORLDS[currentWorldIndex + 1];
    const modal = document.getElementById("world-transition");
    document.getElementById("world-transition-title").textContent = "Welt geschafft!";
    document.getElementById("world-transition-text").textContent =
      `Weiter geht's nach: ${next.name}`;
    modal.classList.remove("hidden");
  } else if (foundCount >= totalLetters) {
    setTimeout(() => {
      document.getElementById("finale-text").textContent =
        "Danke, dass du diese kleinen Welten mit mir entdeckt hast, meine Nita.\nIch liebe dich über alles. 🐾💕";
      document.getElementById("finale-modal").classList.remove("hidden");
      spawnConfetti(character.position);
    }, 400);
  }
}

function spawnHearts(pos) {
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.SpriteMaterial({ map: getSparkleTexture(), color: 0xff8fb3, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.4, 0.4, 0.4);
    sprite.position.copy(pos);
    sprite.userData.vy = 1.2 + Math.random() * 0.6;
    sprite.userData.vx = (Math.random() - 0.5) * 0.6;
    sprite.userData.life = 1.4;
    scene.add(sprite);
    confettiPieces.push(sprite);
  }
}

function spawnConfetti(pos) {
  const colors = [0xff8fb3, 0xffe07d, 0xc99bff, 0x8fd35f, 0x6ec6e6];
  for (let i = 0; i < 60; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], flatShading: true });
    const piece = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), mat);
    piece.position.copy(pos);
    piece.position.y += 1.5;
    piece.userData.vx = (Math.random() - 0.5) * 4;
    piece.userData.vy = 3 + Math.random() * 3;
    piece.userData.vz = (Math.random() - 0.5) * 4;
    piece.userData.spin = (Math.random() - 0.5) * 10;
    piece.userData.life = 3;
    scene.add(piece);
    confettiPieces.push(piece);
  }
}

function updateConfetti(delta) {
  for (let i = confettiPieces.length - 1; i >= 0; i--) {
    const p = confettiPieces[i];
    p.userData.life -= delta;
    if (p.userData.vy !== undefined) p.userData.vy -= 6 * delta;
    if (p.userData.vx !== undefined) p.position.x += p.userData.vx * delta;
    if (p.userData.vz !== undefined) p.position.z += p.userData.vz * delta;
    if (p.userData.vy !== undefined) p.position.y += p.userData.vy * delta;
    if (p.userData.spin !== undefined) p.rotation.z += p.userData.spin * delta;
    if (p.material) p.material.opacity = Math.max(0, p.userData.life / 1.4);
    if (p.userData.life <= 0) {
      scene.remove(p);
      confettiPieces.splice(i, 1);
    }
  }
}

// ============================================================
// UPDATE / ANIMATE
// ============================================================
function updateMovement(delta) {
  if (transitioning) return;

  let ix = input.x, iy = input.y;
  if (keys["w"] || keys["arrowup"]) iy = 1;
  if (keys["s"] || keys["arrowdown"]) iy = -1;
  if (keys["a"] || keys["arrowleft"]) ix = -1;
  if (keys["d"] || keys["arrowright"]) ix = 1;

  const len = Math.hypot(ix, iy);
  isMoving = len > 0.05;

  if (isMoving) {
    const nx = ix / len, ny = iy / len;

    const forward = new THREE.Vector3(-Math.sin(camOrbitAngle), 0, -Math.cos(camOrbitAngle));
    // Rechts relativ zur Kamera (Bildschirm-rechts = Charakter-rechts)
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    const move = new THREE.Vector3()
      .addScaledVector(forward, ny)
      .addScaledVector(right, nx)
      .normalize();

    const speed = 6.5;
    const step = speed * delta;
    const ox = character.position.x;
    const oz = character.position.z;
    const nxPos = ox + move.x * step;
    const nzPos = oz + move.z * step;

    if (isWalkable(nxPos, nzPos)) {
      character.position.x = nxPos;
      character.position.z = nzPos;
    } else if (isWalkable(nxPos, oz)) {
      character.position.x = nxPos;
    } else if (isWalkable(ox, nzPos)) {
      character.position.z = nzPos;
    }

    const targetAngle = Math.atan2(move.x, move.z);
    let cur = character.rotation.y;
    let diff = ((targetAngle - cur + Math.PI) % (Math.PI * 2)) - Math.PI;
    character.rotation.y += diff * Math.min(1, delta * 10);

    walkTime += delta * 9;
  }

  const limbs = character.userData.limbs;
  const swingTarget = isMoving ? 1 : 0;
  const swing = Math.sin(walkTime) * 0.55 * swingTarget;
  const swingArm = Math.sin(walkTime) * 0.4 * swingTarget;
  limbs.leftLegPivot.rotation.x = THREE.MathUtils.lerp(limbs.leftLegPivot.rotation.x, swing, 0.3);
  limbs.rightLegPivot.rotation.x = THREE.MathUtils.lerp(limbs.rightLegPivot.rotation.x, -swing, 0.3);
  limbs.leftArmPivot.rotation.x = THREE.MathUtils.lerp(limbs.leftArmPivot.rotation.x, -swingArm, 0.3);
  limbs.rightArmPivot.rotation.x = THREE.MathUtils.lerp(limbs.rightArmPivot.rotation.x, swingArm, 0.3);

  character.position.y = isMoving ? Math.abs(Math.sin(walkTime)) * 0.06 : Math.sin(clock.elapsedTime * 2) * 0.02;
}

function updateCamera(delta) {
  const offset = new THREE.Vector3(Math.sin(camOrbitAngle) * camDist, camHeight, Math.cos(camOrbitAngle) * camDist);
  const targetPos = character.position.clone().add(offset);
  camera.position.lerp(targetPos, 1 - Math.pow(0.001, delta));
  const lookTarget = character.position.clone().add(new THREE.Vector3(0, 1.3, 0));
  camera.lookAt(lookTarget);
}

function updateLetters(delta) {
  let nearest = -1;
  let nearestDist = Infinity;
  letters.forEach((letter, i) => {
    if (letter.opened) {
      letter.group.visible = false;
      return;
    }
    const t = clock.elapsedTime;
    letter.group.position.y = letter.group.userData.baseY + Math.sin(t * 1.6 + i) * 0.12;
    letter.group.rotation.y = t * 0.6;
    letter.group.userData.sparkles.children.forEach((sprite, si) => {
      const a = sprite.userData.angle + t * 0.8;
      sprite.position.set(
        Math.cos(a) * sprite.userData.radius,
        sprite.userData.yOff + Math.sin(t * 2 + si) * 0.15,
        Math.sin(a) * sprite.userData.radius
      );
      sprite.material.opacity = 0.5 + Math.sin(t * 3 + si) * 0.5;
    });

    const d = character.position.distanceTo(letter.group.position);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = i;
    }
  });

  const openPrompt = document.getElementById("open-prompt");
  if (nearest >= 0 && nearestDist < 2.4 && !transitioning) {
    nearestOpenIndex = nearest;
    openPrompt.classList.remove("hidden");
  } else {
    nearestOpenIndex = -1;
    openPrompt.classList.add("hidden");
  }

  let compassTarget = -1, compassDist = Infinity;
  letters.forEach((letter, i) => {
    if (letter.opened) return;
    const d = character.position.distanceTo(letter.group.position);
    if (d < compassDist) { compassDist = d; compassTarget = i; }
  });
  const compassEl = document.getElementById("compass-arrow");
  const compassWrap = document.getElementById("compass-wrap");
  if (compassTarget >= 0) {
    compassWrap.style.visibility = "visible";
    const target = letters[compassTarget].group.position;
    const dx = target.x - character.position.x;
    const dz = target.z - character.position.z;
    const angleToTarget = Math.atan2(dx, dz);
    const relative = angleToTarget + camOrbitAngle;
    compassEl.style.transform = `rotate(${relative}rad)`;
  } else {
    compassWrap.style.visibility = "hidden";
  }
}

function updateCritters(delta) {
  const t = clock.elapsedTime;
  critters.forEach((critter) => {
    const phase = critter.userData.phase || 0;
    if (critter.userData.baseScale == null) critter.userData.baseScale = 1;
    if (critter.userData.baseY == null) critter.userData.baseY = 0;

    const worldPos = new THREE.Vector3();
    critter.getWorldPosition(worldPos);
    critter.position.y = critter.userData.baseY + Math.abs(Math.sin(t * 2 + phase)) * 0.08;

    const d = character.position.distanceTo(worldPos);
    const excited = d < 3.5;
    const wag = excited ? 10 : 4;
    if (critter.userData.tail) {
      critter.userData.tail.rotation.y = Math.sin(t * wag + phase) * (excited ? 0.9 : 0.4);
    }
    const bounceScale = excited ? 1 + Math.abs(Math.sin(t * 8)) * 0.12 : 1;
    critter.scale.setScalar(critter.userData.baseScale * bounceScale);
    if (excited) {
      critter.rotation.y = Math.atan2(character.position.x - worldPos.x, character.position.z - worldPos.z);
    } else {
      critter.rotation.y = Math.sin(t * 0.5 + phase) * 0.6;
    }
  });
}

function updateClouds(delta) {
  clouds.forEach((c, i) => {
    c.position.x += Math.sin(clock.elapsedTime * 0.05 + i) * delta * 0.3;
  });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  if (gameStarted) {
    updateMovement(delta);
  }
  updateCamera(delta);
  updateLetters(delta);
  updateCritters(delta);
  updateClouds(delta);
  updateFireworks(delta);
  updateConfetti(delta);

  renderer.render(scene, camera);
}

init();
