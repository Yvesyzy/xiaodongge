export type GenreNode = {
  label: string;
  children?: readonly GenreNode[];
};

export const GENRE_TREE = [
  {
    label: "流行",
    children: [
      { label: "Dance Pop", children: [{ label: "Teen Pop" }, { label: "Euro Pop" }, { label: "Bubblegum Pop" }] },
      { label: "Indie Pop", children: [{ label: "Twee Pop" }, { label: "Jangle Pop" }, { label: "Dream Pop" }] },
      { label: "Art Pop", children: [{ label: "Baroque Pop" }, { label: "Chamber Pop" }] },
      { label: "Synth Pop", children: [{ label: "Electropop" }, { label: "Sophisti-Pop" }] },
      { label: "City Pop" },
      { label: "K-Pop" },
      { label: "J-Pop" },
      { label: "C-Pop" },
    ],
  },
  {
    label: "摇滚",
    children: [
      { label: "Rock & Roll / Early Rock", children: [{ label: "Rockabilly" }, { label: "Surf Rock" }, { label: "Beat Music" }, { label: "Frat Rock" }, { label: "Garage Rock" }] },
      { label: "Classic / Album Rock", children: [{ label: "Classic Rock" }, { label: "Album Rock" }, { label: "Mainstream Rock" }, { label: "Heartland Rock" }, { label: "Roots Rock" }, { label: "Pub Rock" }] },
      { label: "Pop Rock", children: [{ label: "Soft Rock" }, { label: "Yacht Rock" }, { label: "Power Pop" }, { label: "Piano Rock" }, { label: "Acoustic Rock" }] },
      { label: "Alternative Rock", children: [{ label: "Grunge" }, { label: "Post-Grunge" }, { label: "Britpop" }, { label: "Shoegaze" }, { label: "Post-Rock" }, { label: "Noise Rock" }, { label: "College Rock" }, { label: "Slacker Rock" }] },
      { label: "Indie Rock", children: [{ label: "Garage Rock Revival" }, { label: "Lo-Fi" }, { label: "Post-Punk Revival" }, { label: "Dance-Punk" }, { label: "Indie Surf" }, { label: "Indietronica" }] },
      { label: "Hard Rock", children: [{ label: "Glam Rock" }, { label: "Arena Rock" }, { label: "Sleaze Rock" }, { label: "Stoner Rock" }, { label: "Desert Rock" }, { label: "Boogie Rock" }, { label: "Occult Rock" }] },
      { label: "Progressive Rock", children: [{ label: "Art Rock" }, { label: "Symphonic Rock" }, { label: "Canterbury Scene" }, { label: "Neo-Prog" }, { label: "Krautrock" }, { label: "Math Rock" }, { label: "Avant-Prog" }, { label: "Rock in Opposition" }] },
      { label: "Psychedelic Rock", children: [{ label: "Acid Rock" }, { label: "Space Rock" }, { label: "Neo-Psychedelia" }, { label: "Raga Rock" }, { label: "Garage Psych" }] },
      { label: "Post-Punk / New Wave", children: [{ label: "New Wave" }, { label: "Gothic Rock" }, { label: "Deathrock" }, { label: "No Wave" }, { label: "Cold Wave" }, { label: "Dark Wave" }, { label: "New Romantic" }, { label: "Synth Rock" }] },
      { label: "Emo", children: [{ label: "Midwest Emo" }, { label: "Emo-Pop" }, { label: "Screamo" }, { label: "Emocore" }, { label: "Emoviolence" }] },
      { label: "Blues Rock", children: [{ label: "British Blues Rock" }, { label: "Texas Blues Rock" }, { label: "Punk Blues" }, { label: "Swamp Rock" }] },
      { label: "Folk / Country Rock", children: [{ label: "Folk Rock" }, { label: "Country Rock" }, { label: "Southern Rock" }, { label: "Celtic Rock" }, { label: "British Folk Rock" }] },
      { label: "Funk / Jazz / Rap Rock", children: [{ label: "Funk Rock" }, { label: "Jazz Rock" }, { label: "Rap Rock" }, { label: "Reggae Rock" }] },
      { label: "Electronic / Industrial Rock", children: [{ label: "Electronic Rock" }, { label: "Industrial Rock" }, { label: "Digital Hardcore" }, { label: "Dance-Rock" }, { label: "Electropunk" }] },
      { label: "Experimental / Novelty Rock", children: [{ label: "Experimental Rock" }, { label: "Instrumental Rock" }, { label: "Geek Rock" }, { label: "Comedy Rock" }] },
      { label: "Regional Rock", children: [{ label: "Latin Rock" }, { label: "J-Rock" }, { label: "Anatolian Rock" }, { label: "Zamrock" }, { label: "Rock en Espanol" }, { label: "Rock Andaluz" }, { label: "Samba-Rock" }] },
      { label: "Theatre / Spiritual Rock", children: [{ label: "Rock Opera" }, { label: "Rock Musical" }, { label: "Christian Rock" }] },
    ],
  },
  {
    label: "电子",
    children: [
      { label: "Dubstep", children: [{ label: "Brostep" }, { label: "Riddim" }, { label: "Riddim Dubstep" }, { label: "Post-Dubstep" }, { label: "Reggaestep" }, { label: "Melodic Dubstep" }, { label: "Tearout" }, { label: "Trancestep" }] },
      { label: "House", children: [{ label: "Deep House" }, { label: "Tech House" }, { label: "Acid House" }, { label: "Progressive House" }, { label: "Electro House" }, { label: "Future House" }, { label: "Bass House" }, { label: "Afro House" }, { label: "Tropical House" }, { label: "Chicago House" }, { label: "French House" }, { label: "Garage House" }, { label: "Microhouse" }, { label: "Organic House" }, { label: "Vocal House" }, { label: "Big Room House" }] },
      { label: "Techno", children: [{ label: "Detroit Techno" }, { label: "Minimal Techno" }, { label: "Acid Techno" }, { label: "Industrial Techno" }, { label: "Dub Techno" }, { label: "Deep Techno" }, { label: "Hard Techno" }, { label: "Melodic Techno" }, { label: "Bleep Techno" }, { label: "Peak Time Techno" }, { label: "Hardgroove Techno" }, { label: "Hypertechno" }] },
      { label: "Trance", children: [{ label: "Progressive Trance" }, { label: "Psytrance" }, { label: "Uplifting Trance" }, { label: "Goa Trance" }, { label: "Hard Trance" }, { label: "Acid Trance" }, { label: "Vocal Trance" }, { label: "Tech Trance" }, { label: "Dream Trance" }, { label: "Balearic Trance" }, { label: "Dark Psytrance" }, { label: "Forest Psytrance" }] },
      { label: "Drum and Bass", children: [{ label: "Jungle" }, { label: "Liquid Funk" }, { label: "Neurofunk" }, { label: "Jump-Up" }, { label: "Darkstep" }, { label: "Techstep" }, { label: "Ragga Jungle" }, { label: "Drumfunk" }, { label: "Atmospheric Drum and Bass" }, { label: "Dancefloor Drum and Bass" }, { label: "Deep Drum and Bass" }, { label: "Minimal Drum and Bass" }] },
      { label: "Ambient / Downtempo", children: [{ label: "Ambient" }, { label: "Drone" }, { label: "IDM" }, { label: "Downtempo" }, { label: "Chillout" }, { label: "Trip Hop" }, { label: "Ambient Dub" }, { label: "Ambient House" }, { label: "Ambient Techno" }, { label: "Dark Ambient" }, { label: "Space Ambient" }, { label: "Ritual Ambient" }, { label: "Black Ambient" }] },
      { label: "UK Garage / Bass", children: [{ label: "UK Garage" }, { label: "2-Step" }, { label: "Future Garage" }, { label: "Speed Garage" }, { label: "Dark Garage" }, { label: "Bassline" }, { label: "Footwork" }, { label: "Juke" }, { label: "Footwork Jungle" }] },
      { label: "Breakbeat / Big Beat", children: [{ label: "Breakbeat" }, { label: "Big Beat" }, { label: "Breakbeat Hardcore" }, { label: "Funky Breaks" }] },
      { label: "Electro / Electronica", children: [{ label: "Electro" }, { label: "Electronica" }, { label: "Electroclash" }, { label: "Electro Swing" }, { label: "Electro-Funk" }, { label: "Dark Electro" }, { label: "French Electro" }, { label: "Electroacoustic" }] },
      { label: "Synth / Vapor", children: [{ label: "Synthwave" }, { label: "Vaporwave" }, { label: "Witch House" }, { label: "Future Funk" }] },
      { label: "Trap EDM / Bass", children: [{ label: "Trap EDM" }, { label: "Festival Trap" }, { label: "Wave" }, { label: "Future Bass" }, { label: "Kawaii Future Bass" }, { label: "Electronic Trap" }, { label: "Glitch Hop EDM" }] },
      { label: "Hardcore", children: [{ label: "Gabber" }, { label: "Happy Hardcore" }, { label: "Breakcore" }, { label: "Hardstyle" }, { label: "Hardcore Techno" }, { label: "Industrial Hardcore" }, { label: "Freeform Hardcore" }, { label: "Uptempo Hardcore" }] },
    ],
  },
  {
    label: "Hip-Hop / Rap",
    children: [
      { label: "Boom Bap" },
      { label: "Trap Rap", children: [{ label: "Drill" }, { label: "Rage" }, { label: "Plugg" }, { label: "Cloud Rap" }] },
      { label: "Alternative Hip-Hop" },
      { label: "Conscious Hip-Hop" },
      { label: "Gangsta Rap" },
      { label: "Grime" },
      { label: "Latin Trap" },
    ],
  },
  {
    label: "R&B / Soul",
    children: [
      { label: "Rhythm and Blues", children: [{ label: "R&B" }, { label: "New Orleans R&B" }, { label: "Doo-Wop" }, { label: "Soul Blues" }] },
      { label: "Soul", children: [{ label: "Neo Soul" }, { label: "Blue-Eyed Soul" }, { label: "Southern Soul" }, { label: "Northern Soul" }, { label: "Chicago Soul" }, { label: "Philly Soul" }, { label: "Motown" }, { label: "Deep Soul" }, { label: "Psychedelic Soul" }, { label: "Smooth Soul" }, { label: "Pop Soul" }, { label: "Latin Soul" }, { label: "Country Soul" }] },
      { label: "Funk", children: [{ label: "P-Funk" }, { label: "Boogie" }, { label: "Afro-Funk" }, { label: "Deep Funk" }, { label: "Brit Funk" }, { label: "G-Funk" }, { label: "Electro-Funk" }, { label: "Synth Funk" }, { label: "Future Funk" }, { label: "Funktronica" }, { label: "Funk Melody" }] },
      { label: "Contemporary R&B", children: [{ label: "Alternative R&B" }, { label: "New Jack Swing" }, { label: "Quiet Storm" }, { label: "Trap Soul" }, { label: "Hip Hop Soul" }, { label: "Urban Contemporary" }, { label: "Pop R&B" }, { label: "Indie R&B" }, { label: "Bedroom R&B" }, { label: "Dark R&B" }, { label: "Chill R&B" }, { label: "Experimental R&B" }] },
      { label: "Gospel", children: [{ label: "Contemporary Gospel" }, { label: "Southern Gospel" }, { label: "Traditional Black Gospel" }, { label: "Urban Contemporary Gospel" }, { label: "Gospel R&B" }, { label: "Gospel Soul" }, { label: "Gospel Rap" }] },
    ],
  },
  {
    label: "爵士",
    children: [
      { label: "Early Jazz", children: [{ label: "Ragtime" }, { label: "Classic Ragtime" }, { label: "Dixieland" }, { label: "New Orleans Jazz" }] },
      { label: "Swing", children: [{ label: "Swing Revival" }, { label: "Western Swing" }, { label: "Vocal Jazz" }, { label: "Contemporary Vocal Jazz" }] },
      { label: "Bebop / Post-Bop", children: [{ label: "Bebop" }, { label: "Hard Bop" }, { label: "Post-Bop" }] },
      { label: "Cool / Modal Jazz", children: [{ label: "Cool Jazz" }, { label: "Modal Jazz" }] },
      { label: "Free / Avant-Garde Jazz", children: [{ label: "Free Jazz" }, { label: "Avant-Garde Jazz" }, { label: "European Free Jazz" }, { label: "Spiritual Jazz" }] },
      { label: "Fusion", children: [{ label: "Jazz Fusion" }, { label: "Jazz-Funk" }, { label: "Nu Jazz" }, { label: "Jazztronica" }, { label: "Acid Jazz" }, { label: "Progressive Jazz Fusion" }, { label: "Psychedelic Jazz Fusion" }] },
      { label: "Smooth / Contemporary Jazz", children: [{ label: "Smooth Jazz" }, { label: "Deep Smooth Jazz" }] },
      { label: "Latin Jazz", children: [{ label: "Bossa Nova Jazz" }, { label: "Deep Latin Jazz" }] },
      { label: "Third Stream / Classical Jazz", children: [{ label: "Third Stream" }, { label: "Classical Jazz Fusion" }] },
    ],
  },
  {
    label: "古典",
    children: [
      { label: "Early Music", children: [{ label: "Medieval" }, { label: "Renaissance" }, { label: "Ars Antiqua" }, { label: "Ars Nova" }, { label: "Ars Subtilior" }, { label: "Gregorian Chant" }] },
      { label: "Baroque", children: [{ label: "Baroque Suite" }, { label: "Concerto Grosso" }, { label: "Cantata" }] },
      { label: "Classical / Romantic Forms", children: [{ label: "Classical Period" }, { label: "Romantic Classical" }, { label: "Symphony" }, { label: "Concerto" }, { label: "Concerto for Orchestra" }, { label: "Sonata" }, { label: "String Quartet" }, { label: "Chamber Music" }] },
      { label: "Opera", children: [{ label: "Opera Buffa" }, { label: "Opera Seria" }, { label: "Opera Semiseria" }, { label: "Grand Opera" }, { label: "Ballad Opera" }, { label: "Opera-Ballet" }] },
      { label: "Sacred / Choral", children: [{ label: "Mass" }, { label: "Requiem" }, { label: "Oratorio" }, { label: "Choral" }, { label: "Choral Symphony" }] },
      { label: "Modern / Contemporary Classical", children: [{ label: "Modern Classical" }, { label: "Contemporary Classical" }, { label: "Impressionism" }, { label: "Neoromanticism" }, { label: "Minimalism" }, { label: "Post-Minimalism" }, { label: "Holy Minimalism" }, { label: "Serialism" }, { label: "Integral Serialism" }, { label: "Acousmatic" }] },
    ],
  },
  {
    label: "蓝调",
    children: [
      { label: "Acoustic Blues", children: [{ label: "Delta Blues" }, { label: "Piedmont Blues" }, { label: "Country Blues" }, { label: "Hill Country Blues" }] },
      { label: "Electric Blues", children: [{ label: "Chicago Blues" }, { label: "Detroit Blues" }, { label: "Memphis Blues" }, { label: "Texas Blues" }, { label: "West Coast Blues" }, { label: "Louisiana Blues" }] },
      { label: "Jump / Boogie Blues", children: [{ label: "Jump Blues" }, { label: "Boogie-Woogie" }, { label: "Boogie" }] },
      { label: "Blues Fusion", children: [{ label: "Blues Rock" }, { label: "British Blues" }, { label: "Soul Blues" }, { label: "Gospel Blues" }] },
      { label: "Regional Blues", children: [{ label: "Swamp Blues" }, { label: "Electric Texas Blues" }, { label: "Acoustic Texas Blues" }, { label: "Acoustic Chicago Blues" }] },
    ],
  },
  {
    label: "民谣 / 世界 / 乡村",
    children: [
      { label: "Modern Folk", children: [{ label: "Singer-Songwriter" }, { label: "Contemporary Folk" }, { label: "Indie Folk" }, { label: "Alternative Folk" }, { label: "Anti-Folk" }, { label: "Freak Folk" }, { label: "Avant-Folk" }, { label: "Chamber Folk" }, { label: "Free Folk" }, { label: "Neofolk" }, { label: "Dark Folk" }] },
      { label: "Traditional / Regional Folk", children: [{ label: "Traditional Folk" }, { label: "American Folk Revival" }, { label: "Appalachian Folk" }, { label: "Country Folk" }, { label: "Old-Time" }, { label: "Irish Folk" }, { label: "British Folk" }, { label: "Scottish Folk" }, { label: "Nordic Folk" }] },
      { label: "Country", children: [{ label: "Alternative Country" }, { label: "Country Pop" }, { label: "Outlaw Country" }, { label: "Honky Tonk" }, { label: "Bro-Country" }, { label: "Americana" }] },
      { label: "Bluegrass / Americana", children: [{ label: "Bluegrass" }, { label: "Traditional Bluegrass" }, { label: "Progressive Bluegrass" }, { label: "Bluegrass Gospel" }, { label: "New Americana" }, { label: "Roots Americana" }] },
      { label: "African / Afro-Diaspora", children: [{ label: "Afrobeat" }, { label: "Afrobeats" }, { label: "Highlife" }, { label: "Soukous" }, { label: "Juju" }, { label: "Mbalax" }, { label: "Gnawa" }] },
      { label: "European / Mediterranean World", children: [{ label: "Celtic" }, { label: "Klezmer" }, { label: "Fado" }, { label: "Fado de Coimbra" }, { label: "Flamenco" }, { label: "Nuevo Flamenco" }] },
      { label: "Americas / Caribbean", children: [{ label: "Cajun" }, { label: "Zydeco" }, { label: "Nouveau Zydeco" }, { label: "Calypso" }] },
      { label: "Asian / Middle Eastern World", children: [{ label: "Qawwali" }, { label: "Bhangra" }, { label: "Baul Gaan" }, { label: "Gamelan" }, { label: "Javanese Gamelan" }, { label: "Balinese Gamelan" }, { label: "Raï" }] },
    ],
  },
  {
    label: "雷鬼",
    children: [
      { label: "Ska" },
      { label: "Rocksteady" },
      { label: "Roots Reggae" },
      { label: "Dub" },
      { label: "Dancehall" },
      { label: "Lovers Rock" },
    ],
  },
  {
    label: "拉丁",
    children: [
      { label: "Salsa" },
      { label: "Bachata" },
      { label: "Merengue" },
      { label: "Reggaeton", children: [{ label: "Latin Trap" }] },
      { label: "Bossa Nova" },
      { label: "Samba" },
      { label: "Tango" },
      { label: "Latin Pop" },
    ],
  },
  {
    label: "金属",
    children: [
      { label: "Heavy Metal", children: [{ label: "NWOBHM" }, { label: "Glam Metal" }, { label: "Speed Metal" }, { label: "Proto-Metal" }] },
      { label: "Thrash Metal", children: [{ label: "Crossover Thrash" }, { label: "Technical Thrash Metal" }, { label: "Melodic Thrash" }, { label: "Old School Thrash" }, { label: "Blackened Thrash Metal" }] },
      { label: "Death Metal", children: [{ label: "Melodic Death Metal" }, { label: "Technical Death Metal" }, { label: "Brutal Death Metal" }, { label: "Slam Death Metal" }, { label: "Old School Death Metal" }, { label: "Blackened Death Metal" }, { label: "Dissonant Death Metal" }] },
      { label: "Black Metal", children: [{ label: "Atmospheric Black Metal" }, { label: "Symphonic Black Metal" }, { label: "Melodic Black Metal" }, { label: "Depressive Black Metal" }, { label: "Pagan Black Metal" }, { label: "War Metal" }, { label: "Blackgaze" }] },
      { label: "Doom / Sludge Metal", children: [{ label: "Traditional Doom Metal" }, { label: "Epic Doom Metal" }, { label: "Funeral Doom Metal" }, { label: "Death-Doom Metal" }, { label: "Drone Metal" }, { label: "Sludge Metal" }, { label: "Atmospheric Sludge Metal" }, { label: "Stoner Metal" }] },
      { label: "Power / Symphonic Metal", children: [{ label: "Power Metal" }, { label: "US Power Metal" }, { label: "Melodic Power Metal" }, { label: "Progressive Power Metal" }, { label: "Symphonic Metal" }, { label: "Neoclassical Metal" }, { label: "Opera Metal" }] },
      { label: "Progressive / Avant Metal", children: [{ label: "Progressive Metal" }, { label: "Avant-Garde Metal" }, { label: "Post-Metal" }, { label: "Djent" }, { label: "Mathcore" }] },
      { label: "Folk / Regional Metal", children: [{ label: "Folk Metal" }, { label: "Celtic Metal" }, { label: "Viking Metal" }, { label: "Pagan Metal" }, { label: "Medieval Metal" }, { label: "Kawaii Metal" }, { label: "J-Metal" }] },
      { label: "Alternative / Groove Metal", children: [{ label: "Alternative Metal" }, { label: "Nu Metal" }, { label: "Rap Metal" }, { label: "Funk Metal" }, { label: "Groove Metal" }, { label: "Industrial Metal" }, { label: "Cyber Metal" }] },
      { label: "Metalcore / Deathcore", children: [{ label: "Metalcore" }, { label: "Melodic Metalcore" }, { label: "Progressive Metalcore" }, { label: "Nu-Metalcore" }, { label: "Deathcore" }, { label: "Blackened Deathcore" }, { label: "Progressive Deathcore" }, { label: "Symphonic Deathcore" }, { label: "Electronicore" }] },
    ],
  },
  {
    label: "朋克",
    children: [
      { label: "Punk Rock", children: [{ label: "Proto-Punk" }, { label: "Garage Punk" }, { label: "Early US Punk" }, { label: "Art Punk" }, { label: "Glam Punk" }, { label: "Punk Revival" }, { label: "Egg Punk" }] },
      { label: "Hardcore Punk", children: [{ label: "Melodic Hardcore" }, { label: "Beatdown Hardcore" }, { label: "D-Beat" }, { label: "Powerviolence" }, { label: "Thrashcore" }, { label: "Raw Punk" }] },
      { label: "Post-Hardcore / Emo Punk", children: [{ label: "Post-Hardcore" }, { label: "Progressive Post-Hardcore" }, { label: "Skramz" }] },
      { label: "Pop Punk", children: [{ label: "Skate Punk" }, { label: "Neon Pop Punk" }, { label: "Easycore" }, { label: "SoCal Pop Punk" }, { label: "Japanese Pop Punk" }, { label: "UK Pop Punk" }] },
      { label: "Post-Punk", children: [{ label: "Dance-Punk Revival" }, { label: "Dark Post-Punk" }, { label: "UK Post-Punk" }, { label: "Russian Post-Punk" }] },
      { label: "Anarcho-Punk / Crust", children: [{ label: "Anarcho-Punk" }, { label: "Crust Punk" }, { label: "Stenchcore" }] },
      { label: "Street Punk / Oi!", children: [{ label: "Street Punk" }, { label: "Oi!" }, { label: "UK82" }, { label: "Punk Urbano" }] },
      { label: "Ska Punk", children: [{ label: "Crack Rock Steady" }, { label: "2 Tone" }] },
      { label: "Folk Punk", children: [{ label: "Celtic Punk" }, { label: "Gypsy Punk" }, { label: "Cowpunk" }] },
      { label: "Horror / Surf Punk", children: [{ label: "Horror Punk" }, { label: "Surf Punk" }] },
    ],
  },
  {
    label: "实验 / 工业 / 噪音",
    children: [
      { label: "Avant-Garde" },
      { label: "Noise", children: [{ label: "Harsh Noise" }, { label: "Noise Wall" }] },
      { label: "Industrial", children: [{ label: "EBM" }, { label: "Aggrotech" }, { label: "Power Electronics" }] },
      { label: "Musique Concrete" },
      { label: "Deconstructed Club" },
    ],
  },
  {
    label: "影视 / 舞台",
    children: [
      { label: "Film Score" },
      { label: "Soundtrack" },
      { label: "Musical" },
      { label: "Video Game Music" },
      { label: "Anime" },
    ],
  },
] as const satisfies readonly GenreNode[];

export const GENRE_TAGS = Array.from(new Set(collectGenreLabels(GENRE_TREE)));

const GENRE_TAG_SET = new Set(GENRE_TAGS);

export function isKnownGenreTag(value: string) {
  return GENRE_TAG_SET.has(value);
}

export function genreChildren(label: string) {
  return findGenreNode(GENRE_TREE, label)?.children ?? [];
}

export function findGenrePath(label: string) {
  return findGenrePathIn(GENRE_TREE, label);
}

export function genreMatchesFilter(value: string, filter: string) {
  return value === filter || findGenrePathsIn(GENRE_TREE, value).some((path) => path.includes(filter));
}

function collectGenreLabels(nodes: readonly GenreNode[]): string[] {
  return nodes.flatMap((node) => [node.label, ...collectGenreLabels(node.children ?? [])]);
}

function findGenreNode(nodes: readonly GenreNode[], label: string): GenreNode | null {
  for (const node of nodes) {
    if (node.label === label) return node;
    const child = findGenreNode(node.children ?? [], label);
    if (child) return child;
  }
  return null;
}

function findGenrePathIn(nodes: readonly GenreNode[], label: string, path: string[] = []): string[] {
  for (const node of nodes) {
    const nextPath = [...path, node.label];
    if (node.label === label) return nextPath;
    const childPath = findGenrePathIn(node.children ?? [], label, nextPath);
    if (childPath.length) return childPath;
  }
  return [];
}

function findGenrePathsIn(nodes: readonly GenreNode[], label: string, path: string[] = []): string[][] {
  return nodes.flatMap((node) => {
    const nextPath = [...path, node.label];
    const childPaths = findGenrePathsIn(node.children ?? [], label, nextPath);
    return node.label === label ? [nextPath, ...childPaths] : childPaths;
  });
}
