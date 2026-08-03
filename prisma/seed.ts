import { PrismaClient, type Team } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { BASE_RATING, replayRatings, roundRating } from "../lib/elo";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function daysFromNow(days: number, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours, 0, 0, 0);
  return d;
}

/** Data-URI placeholder banner so ad slots render without external image hosting. */
function adSvg(label: string, w: number, h: number, from: string, to: string) {
  const fontSize = Math.max(10, Math.round(Math.min(h * 0.15, w / (label.length * 0.62))));
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><text x='50%' y='50%' fill='white' font-family='sans-serif' font-weight='700' font-size='${fontSize}' text-anchor='middle' dominant-baseline='middle' opacity='0.92'>${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const NICK_WORDS = [
  "Nova", "Ghost", "Zenith", "Blaze", "Frost", "Orbit", "Nomad", "Rift",
  "Vortex", "Cipher", "Talon", "Ember", "Drift", "Halo", "Krypt", "Solace",
  "Raven", "Static", "Vector", "Omen", "Pulse", "Wraith", "Havoc", "Lumen",
  "Fable", "Quartz", "Sable", "Clad", "Nyx", "Axiom", "Flux", "Grit",
  "Marrow", "Onyx", "Torque", "Vane", "Wisp", "Zephyr", "Cobalt", "Ashen",
];
let nickCursor = 0;
function nextNickname() {
  const base = NICK_WORDS[nickCursor % NICK_WORDS.length];
  const round = Math.floor(nickCursor / NICK_WORDS.length);
  nickCursor++;
  return round === 0 ? base : `${base}${round + 1}`;
}

const TEAM_ADJ = ["Crimson", "Obsidian", "Northlight", "Iron", "Shadow", "Golden", "Neon", "Silver", "Velocity", "Prime", "Apex", "Frostbound"];
const TEAM_NOUN = ["Vanguard", "Wolves", "Circuit", "Sentinel", "Order", "Legion", "Five", "Syndicate", "Collective", "Dynasty", "Uprising", "Nexus"];

const COUNTRIES = ["AZ", "TR", "DE", "FR", "DK", "SE", "PL", "UA", "BR", "US", "KR", "GB", "FI", "BG", "ES", "IT"];
let countryCursor = 0;
function nextCountry() {
  return COUNTRIES[countryCursor++ % COUNTRIES.length];
}

type GameDef = {
  slug: string;
  name: string;
  shortName: string;
  accentColor: string;
  maps: string[];
  statShape: (base: { kills: number; deaths: number; assists: number }) => Record<string, number>;
};

const GAME_DEFS: GameDef[] = [
  {
    slug: "cs2",
    name: "Counter-Strike 2",
    shortName: "CS2",
    accentColor: "#f5a524",
    maps: ["Mirage", "Inferno", "Nuke", "Ancient", "Anubis", "Vertigo", "Overpass"],
    statShape: (b) => ({ adr: Math.round(60 + b.kills * 4.2), hs: Math.round(35 + Math.random() * 30) }),
  },
  {
    slug: "valorant",
    name: "Valorant",
    shortName: "VALORANT",
    accentColor: "#ff4655",
    maps: ["Ascent", "Bind", "Haven", "Icebox", "Lotus", "Sunset", "Split"],
    statShape: (b) => ({ acs: Math.round(180 + b.kills * 9), firstBloods: Math.round(1 + Math.random() * 4) }),
  },
  {
    slug: "dota2",
    name: "Dota 2",
    shortName: "Dota 2",
    accentColor: "#dc2626",
    maps: ["Game 1", "Game 2", "Game 3"],
    statShape: () => ({ gpm: Math.round(400 + Math.random() * 300), xpm: Math.round(450 + Math.random() * 350), lastHits: Math.round(150 + Math.random() * 150) }),
  },
  {
    slug: "lol",
    name: "League of Legends",
    shortName: "LoL",
    accentColor: "#c9aa71",
    maps: ["Game 1", "Game 2", "Game 3"],
    statShape: () => ({ cs: Math.round(180 + Math.random() * 100), visionScore: Math.round(20 + Math.random() * 40) }),
  },
];

const ROLE_POOL: Record<string, string[]> = {
  cs2: ["IGL", "AWPer", "Entry", "Support", "Lurker"],
  valorant: ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"],
  dota2: ["Carry", "Mid", "Offlane", "Soft Support", "Hard Support"],
  lol: ["Top", "Jungle", "Mid", "ADC", "Support"],
};

/**
 * Real CS2 organisations, countries and rosters, supplied by the site owner.
 *
 * Two rules apply to everything in this list, because these are real companies
 * and real people:
 *  - the country is the team's ACTUAL country and is never taken from the
 *    round-robin `nextCountry()` pool, which is what previously produced
 *    nonsense like "MOUZ — Azerbaijan" and "Astralis — Poland";
 *  - no invented matches, results or player statistics are ever generated for
 *    them. The site would otherwise publish match reports that never happened.
 *    Real results are entered through the admin panel.
 *
 * Roles are left empty rather than guessed. Rosters are a snapshot and go stale
 * as players transfer — they are maintained from the admin panel.
 */
const REAL_CS2_TEAMS: { name: string; country: string; earnings?: number; players: string[] }[] = [
  { name: "Vitality", country: "FR", earnings: 1_082_500, players: ["apEX", "ropz", "ZywOo", "flameZ", "mezii"] },
  { name: "Falcons", country: "SA", earnings: 789_000, players: ["NiKo", "karrigan", "TeSeS", "m0NESY", "kyousuke"] },
  { name: "Spirit", country: "RU", earnings: 568_188, players: ["sh1ro", "magixx", "zont1x", "tN1R", "donk"] },
  { name: "MOUZ", country: "DE", earnings: 563_813, players: ["Spinx", "torzsi", "xertioN", "PR", "xelex"] },
  { name: "FURIA", country: "BR", earnings: 467_500, players: ["FalleN", "YEKINDAR", "yuurih", "KSCERATO", "molodoy"] },
  { name: "Natus Vincere", country: "UA", earnings: 433_500, players: ["Aleksib", "b1t", "iM", "w0nderful", "makazze"] },
  { name: "9z", country: "AR", earnings: 363_442, players: ["meyern", "max", "luchov", "dgt", "HUASOPEEK"] },
  { name: "PARIVISION", country: "RU", earnings: 309_750, players: ["HObbit", "Jame", "xiELO", "zweih", "slaxejezzz"] },
  { name: "FUT", country: "TR", earnings: 289_125, players: ["xfl0ud", "dem0n", "Krabeni", "cmtry", "dziugss"] },
  { name: "Aurora", country: "RU", earnings: 287_000, players: ["XANTARES", "woxic", "Jimpphat", "kyxsan", "Wicadia"] },
  { name: "Legacy", country: "BR", earnings: 270_253, players: ["arT", "latto", "dumau", "try", "n1ssim"] },
  { name: "Astralis", country: "DK", earnings: 236_000, players: ["HooXi", "jabbi", "ryu", "Staehr", "phzy"] },
  { name: "The MongolZ", country: "MN", earnings: 235_000, players: ["Techno4K", "bLitz", "910", "tikuak", "DarkMeister"] },
  { name: "G2", country: "DE", earnings: 215_115, players: ["huNter-", "Nertz", "HeavyGod", "r1nkle", "MATYS"] },
  { name: "FaZe", country: "US", earnings: 171_750, players: ["Twistzz", "frozen", "Neityu", "jcobbb", "JBOEN"] },
  { name: "3DMAX", country: "FR", earnings: 137_231, players: ["Maka", "Lucky", "misutaaa", "Kursy", "Graviti"] },
  { name: "Nemesis", country: "RU", earnings: 135_500, players: ["SELLTER", "r3salt", "Sdaim", "tex1y", "mag1k3Y"] },
  { name: "BetBoom", country: "RU", earnings: 125_078, players: ["Boombl4", "zorte", "d1Ledez", "s1ren", "Magnojez"] },
  { name: "B8", country: "UA", earnings: 123_894, players: ["alex666", "npl", "kensizor", "esenthial", "s1zzi"] },
  { name: "GamerLegion", country: "DE", earnings: 122_930, players: ["Snax", "REZ", "Tauson", "FL4MUS", "hypex"] },
  // Present in the ranking the owner supplied, absent from the earnings list —
  // kept without an earnings figure rather than guessing one.
  { name: "MIBR", country: "BR", players: ["nqz", "LNZ", "brnz4n", "venomzera", "insani"] },
  { name: "Alliance", country: "SE", players: ["twist", "eraa", "bobeksde", "upE", "Avid"] },
  { name: "TYLOO", country: "CN", players: ["JamYoung", "Jee", "Mercury", "Moseyuh", "Zero"] },
];

/**
 * Period averages for the players the owner supplied figures for.
 *
 * Only these are filled in. Every other player is left null — inventing numbers
 * for a named professional would publish a false claim about a real person, and
 * an empty cell is the honest representation of "we have no data yet".
 * [maps, kills/round, deaths/round, damage/round]
 */
const CS2_PLAYER_STATS: Record<string, [number, number, number, number]> = {
  ZywOo: [88, 0.88, 0.55, 88.06],
  donk: [88, 0.9, 0.68, 94.57],
  m0NESY: [92, 0.81, 0.59, 81.19],
  Magnojez: [60, 0.76, 0.66, 86.03],
  sh1ro: [88, 0.78, 0.54, 77.82],
  w0nderful: [102, 0.75, 0.58, 73.11],
  kyousuke: [90, 0.76, 0.69, 83.29],
  dumau: [78, 0.74, 0.66, 83.6],
  makazze: [102, 0.74, 0.7, 82.73],
  molodoy: [97, 0.75, 0.6, 76.79],
  latto: [78, 0.73, 0.62, 79.11],
  flameZ: [88, 0.74, 0.66, 79.03],
  xertioN: [109, 0.72, 0.66, 84.78],
  luchov: [65, 0.74, 0.69, 83.2],
  KSCERATO: [97, 0.74, 0.61, 80.22],
};

function randomTeamStat(rating: number) {
  const kills = Math.max(0, Math.round(rating * (12 + Math.random() * 10)));
  const deaths = Math.max(0, Math.round(10 + Math.random() * 10));
  const assists = Math.max(0, Math.round(Math.random() * 10));
  return { kills, deaths, assists };
}

async function main() {
  // Demo data (fictional teams, invented matches, sample ads) is for local
  // development. Set SEED_DEMO=false in production: games, the admin user and
  // the real CS2 teams are still created, but nothing is invented.
  const seedDemo = process.env.SEED_DEMO !== "false";

  console.log(`Cleaning existing data... (demo data: ${seedDemo ? "yes" : "no"})`);
  await prisma.playerMatchStat.deleteMany();
  await prisma.matchVetoStep.deleteMany();
  await prisma.matchMap.deleteMany();
  await prisma.newsArticleTranslation.deleteMany();
  await prisma.newsArticle.deleteMany();
  await prisma.matchPrediction.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournamentParticipant.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.teamInvite.deleteMany();
  await prisma.profileClaim.deleteMany();
  await prisma.teamMembership.deleteMany();
  // Registered accounts survive a re-seed — wiping them would delete real
  // people's logins. Their links to the demo world are cut instead: teams they
  // own are released (the FK would otherwise block the delete below) and their
  // memberships went with the deleteMany above.
  await prisma.team.updateMany({ data: { ownerId: null } });
  await prisma.player.deleteMany({ where: { isClaimed: false } });
  await prisma.team.deleteMany();
  await prisma.adBanner.deleteMany();
  // Games are upserted rather than recreated: surviving accounts point at a
  // gameId, so dropping the rows would fail on the foreign key.
  await prisma.adminUser.deleteMany();

  console.log("Creating admin user...");
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme";
  const admin = await prisma.adminUser.create({
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      name: "Baş Admin",
      role: "SUPER_ADMIN",
    },
  });

  const newsPool: { gameSlug: string; teamSlug?: string; matchSlug?: string; az: { title: string; excerpt: string; body: string }; en: { title: string; excerpt: string; body: string }; tags: string[]; featured: boolean }[] = [];

  for (const gameDef of GAME_DEFS) {
    console.log(`Seeding ${gameDef.name}...`);
    const game = await prisma.game.upsert({
      where: { slug: gameDef.slug },
      create: {
        slug: gameDef.slug,
        name: gameDef.name,
        shortName: gameDef.shortName,
        accentColor: gameDef.accentColor,
      },
      update: {
        name: gameDef.name,
        shortName: gameDef.shortName,
        accentColor: gameDef.accentColor,
      },
    });

    // ---------- Real CS2 teams ----------
    // Created in every environment, demo or not — this is real data. They are
    // deliberately left without matches; results come from the admin panel.
    if (gameDef.slug === "cs2") {
      for (const def of REAL_CS2_TEAMS) {
        const team = await prisma.team.create({
          data: {
            slug: `${gameDef.slug}-${slugify(def.name)}`,
            name: def.name,
            country: def.country,
            earnings: def.earnings ?? null,
            primaryColor: gameDef.accentColor,
            secondaryColor: "#0a0b10",
            gameId: game.id,
          },
        });
        for (const nickname of def.players) {
          const stats = CS2_PLAYER_STATS[nickname];
          const player = await prisma.player.create({
            data: {
              slug: slugify(nickname) + "-" + team.id.slice(-4),
              nickname,
              gameId: game.id,
              statMaps: stats?.[0] ?? null,
              statKillsPerRound: stats?.[1] ?? null,
              statDeathsPerRound: stats?.[2] ?? null,
              statDamagePerRound: stats?.[3] ?? null,
            },
          });
          await prisma.teamMembership.create({ data: { teamId: team.id, playerId: player.id } });
        }
      }
      continue;
    }

    if (!seedDemo) continue;

    // ---------- Demo teams & players (fictional names only) ----------
    const teamDefs = Array.from({ length: 6 }).map((_, i) => {
      const adj = TEAM_ADJ[(GAME_DEFS.indexOf(gameDef) * 6 + i) % TEAM_ADJ.length];
      const noun = TEAM_NOUN[(GAME_DEFS.indexOf(gameDef) * 6 + i + 3) % TEAM_NOUN.length];
      return `${adj} ${noun}`;
    });

    const teams: Team[] = [];
    for (let i = 0; i < teamDefs.length; i++) {
      const name = teamDefs[i];
      const team = await prisma.team.create({
        data: {
          slug: `${gameDef.slug}-${slugify(name)}`,
          name,
          country: nextCountry(),
          primaryColor: gameDef.accentColor,
          secondaryColor: "#0a0b10",
          gameId: game.id,
        },
      });
      teams.push(team);

      const roles = ROLE_POOL[gameDef.slug];
      for (let p = 0; p < 5; p++) {
        const nickname = nextNickname();
        const player = await prisma.player.create({
          data: {
            slug: slugify(nickname) + "-" + team.id.slice(-4),
            nickname,
            country: nextCountry(),
            role: roles[p],
            gameId: game.id,
          },
        });
        await prisma.teamMembership.create({
          data: { teamId: team.id, playerId: player.id, joinedAt: daysFromNow(-200) },
        });
      }
      // one roster change on the first two teams, to populate "transfers"
      if (i < 2) {
        const formerNick = nextNickname();
        const formerPlayer = await prisma.player.create({
          data: { slug: slugify(formerNick) + "-" + team.id.slice(-4) + "x", nickname: formerNick, country: nextCountry(), role: roles[0], gameId: game.id, status: "BENCHED" },
        });
        await prisma.teamMembership.create({
          data: { teamId: team.id, playerId: formerPlayer.id, joinedAt: daysFromNow(-260), leftAt: daysFromNow(-14) },
        });
      }
    }

    const rosterByTeam = new Map<string, { id: string }[]>();
    for (const team of teams) {
      const memberships = await prisma.teamMembership.findMany({
        where: { teamId: team.id, leftAt: null },
        select: { playerId: true },
      });
      rosterByTeam.set(team.id, memberships.map((m) => ({ id: m.playerId })));
    }

    // ---------- Tournaments ----------
    const finishedTournament = await prisma.tournament.create({
      data: {
        slug: `${gameDef.slug}-winter-championship-2026`,
        name: `${gameDef.shortName} Winter Championship 2026`,
        gameId: game.id,
        tier: "A",
        startDate: daysFromNow(-30),
        endDate: daysFromNow(-23),
        location: "Berlin, Germany",
        prizePool: "$250,000",
        status: "FINISHED",
      },
    });
    const ongoingTournament = await prisma.tournament.create({
      data: {
        slug: `${gameDef.slug}-summer-series-2026`,
        name: `${gameDef.shortName} Summer Series 2026`,
        gameId: game.id,
        tier: "S",
        startDate: daysFromNow(-5),
        endDate: daysFromNow(5),
        location: "Katowice, Poland",
        prizePool: "$500,000",
        status: "ONGOING",
      },
    });

    // Prize breakdown, by place range — the shape real tournaments publish.
    for (const t of [finishedTournament, ongoingTournament]) {
      const pot = t.id === finishedTournament.id ? 1 : 2;
      await prisma.tournamentPrize.createMany({
        data: [
          { tournamentId: t.id, placeFrom: 1, placeTo: 1, amount: 100_000 * pot, label: "Winner" },
          { tournamentId: t.id, placeFrom: 2, placeTo: 2, amount: 50_000 * pot },
          { tournamentId: t.id, placeFrom: 3, placeTo: 4, amount: 25_000 * pot },
          { tournamentId: t.id, placeFrom: 5, placeTo: 8, amount: 12_500 * pot },
        ],
      });
    }

    for (let i = 0; i < teams.length; i++) {
      await prisma.tournamentParticipant.create({
        data: { tournamentId: finishedTournament.id, teamId: teams[i].id, seed: i + 1, placement: i + 1 },
      });
      await prisma.tournamentParticipant.create({
        data: { tournamentId: ongoingTournament.id, teamId: teams[i].id, seed: i + 1 },
      });
    }

    async function createMatch(opts: {
      tournamentId: string;
      teamA: (typeof teams)[number];
      teamB: (typeof teams)[number];
      status: "UPCOMING" | "LIVE" | "FINISHED";
      bestOf: number;
      stage: string;
      scheduledAt: Date;
      starRating: number;
      isFeatured?: boolean;
      withFullStats?: boolean;
    }) {
      const { tournamentId, teamA, teamB, status, bestOf, stage, scheduledAt, starRating, isFeatured, withFullStats } = opts;
      const mapPool = [...gameDef.maps].sort(() => Math.random() - 0.5);
      const mapsToPlay = status === "UPCOMING" ? 0 : status === "LIVE" ? Math.min(bestOf, 2) : Math.ceil(bestOf / 2) === 1 ? 1 : Math.min(bestOf, 2 + (Math.random() > 0.5 ? 1 : 0));

      let teamAScore = 0;
      let teamBScore = 0;
      let winnerId: string | null = null;

      const match = await prisma.match.create({
        data: {
          slug: `${teamA.slug}-vs-${teamB.slug}-${tournamentId.slice(-5)}-${stage.toLowerCase().replace(/\s+/g, "-")}`,
          gameId: game.id,
          tournamentId,
          teamAId: teamA.id,
          teamBId: teamB.id,
          scheduledAt,
          status,
          bestOf,
          stage,
          starRating,
          isFeatured: !!isFeatured,
          streamUrl: status !== "UPCOMING" ? "https://twitch.tv/arenahub" : null,
        },
      });

      const aggregate = new Map<string, { teamId: string; kills: number; deaths: number; assists: number; ratings: number[] }>();

      if (status !== "UPCOMING") {
        for (let m = 0; m < mapsToPlay; m++) {
          const isLastMapLive = status === "LIVE" && m === mapsToPlay - 1;
          const aScore = isLastMapLive ? Math.round(Math.random() * 10) : Math.round(6 + Math.random() * 10);
          const bScore = isLastMapLive ? Math.round(Math.random() * 10) : Math.round(6 + Math.random() * 10);
          let mWinnerId: string | null = null;
          if (!isLastMapLive) {
            mWinnerId = aScore >= bScore ? teamA.id : teamB.id;
            if (mWinnerId === teamA.id) teamAScore++; else teamBScore++;
          }
          const mapRow = await prisma.matchMap.create({
            data: {
              matchId: match.id,
              mapOrder: m + 1,
              mapName: mapPool[m % mapPool.length],
              teamAScore: aScore,
              teamBScore: bScore,
              status: isLastMapLive ? "LIVE" : "FINISHED",
              winnerId: mWinnerId,
            },
          });

          if (withFullStats && !isLastMapLive) {
            for (const side of [{ team: teamA, roster: rosterByTeam.get(teamA.id)! }, { team: teamB, roster: rosterByTeam.get(teamB.id)! }]) {
              for (const player of side.roster) {
                const base = randomTeamStat(0.8 + Math.random() * 0.7);
                const rating = Math.round((0.7 + Math.random() * 0.8) * 100) / 100;
                await prisma.playerMatchStat.create({
                  data: {
                    matchId: match.id,
                    mapId: mapRow.id,
                    playerId: player.id,
                    teamId: side.team.id,
                    ...base,
                    rating,
                    coreStats: gameDef.statShape(base),
                  },
                });
                const agg = aggregate.get(player.id) ?? { teamId: side.team.id, kills: 0, deaths: 0, assists: 0, ratings: [] };
                agg.kills += base.kills;
                agg.deaths += base.deaths;
                agg.assists += base.assists;
                agg.ratings.push(rating);
                aggregate.set(player.id, agg);
              }
            }
          }
        }
        if (status === "FINISHED") {
          winnerId = teamAScore >= teamBScore ? teamA.id : teamB.id;
          await prisma.match.update({ where: { id: match.id }, data: { teamAScore, teamBScore, winnerId } });
        } else {
          await prisma.match.update({ where: { id: match.id }, data: { teamAScore, teamBScore } });
        }
      }

      // Match-level aggregate row (mapId: null) so leaderboards/profile history don't need to fan out per map.
      for (const [playerId, agg] of aggregate) {
        await prisma.playerMatchStat.create({
          data: {
            matchId: match.id,
            mapId: null,
            playerId,
            teamId: agg.teamId,
            kills: agg.kills,
            deaths: agg.deaths,
            assists: agg.assists,
            rating: Math.round((agg.ratings.reduce((a, b) => a + b, 0) / agg.ratings.length) * 100) / 100,
            coreStats: gameDef.statShape({ kills: agg.kills, deaths: agg.deaths, assists: agg.assists }),
          },
        });
      }

      return match;
    }

    // Finished tournament bracket
    const semi1 = await createMatch({ tournamentId: finishedTournament.id, teamA: teams[0], teamB: teams[3], status: "FINISHED", bestOf: 3, stage: "Semifinal", scheduledAt: daysFromNow(-25), starRating: 4 });
    const semi2 = await createMatch({ tournamentId: finishedTournament.id, teamA: teams[1], teamB: teams[2], status: "FINISHED", bestOf: 3, stage: "Semifinal", scheduledAt: daysFromNow(-25, 3), starRating: 4 });
    await createMatch({ tournamentId: finishedTournament.id, teamA: teams[4], teamB: teams[5], status: "FINISHED", bestOf: 1, stage: "3rd Place Decider", scheduledAt: daysFromNow(-23), starRating: 2 });
    const semi1Fresh = await prisma.match.findUniqueOrThrow({ where: { id: semi1.id } });
    const semi2Fresh = await prisma.match.findUniqueOrThrow({ where: { id: semi2.id } });
    const finalTeamA = semi1Fresh.winnerId === teams[0].id ? teams[0] : teams[3];
    const finalTeamB = semi2Fresh.winnerId === teams[1].id ? teams[1] : teams[2];
    await createMatch({ tournamentId: finishedTournament.id, teamA: finalTeamA, teamB: finalTeamB, status: "FINISHED", bestOf: 3, stage: "Final", scheduledAt: daysFromNow(-23, 5), starRating: 5, withFullStats: true });

    // Ongoing tournament
    await createMatch({ tournamentId: ongoingTournament.id, teamA: teams[0], teamB: teams[5], status: "FINISHED", bestOf: 1, stage: "Group Stage", scheduledAt: daysFromNow(-4), starRating: 3 });
    await createMatch({ tournamentId: ongoingTournament.id, teamA: teams[1], teamB: teams[4], status: "FINISHED", bestOf: 1, stage: "Group Stage", scheduledAt: daysFromNow(-3), starRating: 3 });
    await createMatch({ tournamentId: ongoingTournament.id, teamA: teams[2], teamB: teams[3], status: "FINISHED", bestOf: 1, stage: "Group Stage", scheduledAt: daysFromNow(-2), starRating: 3 });
    await createMatch({ tournamentId: ongoingTournament.id, teamA: teams[0], teamB: teams[1], status: "LIVE", bestOf: 3, stage: "Quarterfinal", scheduledAt: daysFromNow(0, -0.5), starRating: 5, isFeatured: true, withFullStats: true });
    await createMatch({ tournamentId: ongoingTournament.id, teamA: teams[2], teamB: teams[4], status: "UPCOMING", bestOf: 3, stage: "Quarterfinal", scheduledAt: daysFromNow(0, 4), starRating: 4 });
    await createMatch({ tournamentId: ongoingTournament.id, teamA: teams[3], teamB: teams[5], status: "UPCOMING", bestOf: 3, stage: "Quarterfinal", scheduledAt: daysFromNow(1, 2), starRating: 3 });
    await createMatch({ tournamentId: ongoingTournament.id, teamA: teams[1], teamB: teams[3], status: "UPCOMING", bestOf: 3, stage: "Semifinal", scheduledAt: daysFromNow(2, 6), starRating: 5, isFeatured: true });

    newsPool.push(
      {
        gameSlug: gameDef.slug,
        teamSlug: finalTeamA.slug,
        az: { title: `${finalTeamA.name} ${gameDef.shortName} Winter Championship-i qazandı`, excerpt: `${finalTeamA.name} finalda ${finalTeamB.name} komandasını məğlub edərək titulu qazandı.`, body: `<p>${finalTeamA.name}, Berlində keçirilən ${gameDef.shortName} Winter Championship 2026 turnirinin finalında ${finalTeamB.name} komandasına qarşı inamlı oyun nümayiş etdirərək çempion oldu.</p><p>Komanda bütün turnir boyu sabit performans göstərdi və final matçında da bunu təsdiqlədi.</p>` },
        en: { title: `${finalTeamA.name} win the ${gameDef.shortName} Winter Championship`, excerpt: `${finalTeamA.name} defeated ${finalTeamB.name} in the grand final to claim the title.`, body: `<p>${finalTeamA.name} closed out ${gameDef.shortName} Winter Championship 2026 in Berlin with a commanding performance over ${finalTeamB.name} in the grand final.</p><p>The roster stayed consistent throughout the event, and it showed once again on the biggest stage.</p>` },
        tags: [gameDef.shortName, "Turnir"],
        featured: true,
      },
      {
        gameSlug: gameDef.slug,
        teamSlug: teams[0].slug,
        az: { title: `${teams[0].name} Summer Series-də canlı oyunda`, excerpt: `${gameDef.shortName} Summer Series 2026 davam edir, çeyrək finalda gərgin mübarizə gedir.`, body: `<p>${gameDef.shortName} Summer Series 2026 turnirinin plей-off mərhələsi başladı. Çeyrək finalda ${teams[0].name} rəqibi ilə üz-üzədir.</p>` },
        en: { title: `${teams[0].name} in action at the Summer Series`, excerpt: `${gameDef.shortName} Summer Series 2026 continues with a tense quarterfinal.`, body: `<p>The playoff stage of ${gameDef.shortName} Summer Series 2026 is underway, with ${teams[0].name} facing a tough quarterfinal matchup.</p>` },
        tags: [gameDef.shortName, "Canlı"],
        featured: false,
      },
      {
        gameSlug: gameDef.slug,
        teamSlug: teams[1].slug,
        az: { title: `${teams[1].name} rosterində dəyişiklik`, excerpt: `${teams[1].name} tərkibində transfer elan etdi.`, body: `<p>${teams[1].name} komandası yeni mövsüm ərəfəsində rosterində dəyişiklik apardığını rəsmi olaraq açıqladı.</p>` },
        en: { title: `${teams[1].name} announce a roster change`, excerpt: `${teams[1].name} confirmed a lineup change ahead of the new season.`, body: `<p>${teams[1].name} officially announced a roster change heading into the new competitive season.</p>` },
        tags: [gameDef.shortName, "Transfer"],
        featured: false,
      },
    );
  }

  console.log("Seeding news...");
  for (const item of newsPool) {
    const game = await prisma.game.findUniqueOrThrow({ where: { slug: item.gameSlug } });
    const relatedTeam = item.teamSlug ? await prisma.team.findUnique({ where: { slug: item.teamSlug } }) : null;
    const article = await prisma.newsArticle.create({
      data: {
        slug: slugify(item.en.title) + "-" + Math.random().toString(36).slice(2, 7),
        authorId: admin.id,
        gameId: game.id,
        relatedTeamId: relatedTeam?.id,
        tags: item.tags,
        isFeatured: item.featured,
        publishedAt: daysFromNow(-Math.round(Math.random() * 12)),
      },
    });
    await prisma.newsArticleTranslation.create({
      data: { articleId: article.id, locale: "az", title: item.az.title, excerpt: item.az.excerpt, bodyHtml: item.az.body },
    });
    await prisma.newsArticleTranslation.create({
      data: { articleId: article.id, locale: "en", title: item.en.title, excerpt: item.en.excerpt, bodyHtml: item.en.body },
    });
  }

  if (!seedDemo) {
    console.log(`Seed tamamlandı (yalnız real data).`);
    console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
    return;
  }

  console.log("Seeding ad banners...");
  // HEADER and FOOTER are intentionally absent: those slots were removed from
  // the site, so seeding banners for them would create invisible rows.
  const adDefs: { name: string; placement: "SIDEBAR_LEFT" | "SIDEBAR_RIGHT_TOP" | "SIDEBAR_RIGHT_BOTTOM" | "IN_CONTENT" | "MATCH_PAGE_TOP"; w: number; h: number }[] = [
    { name: "Left Skyscraper", placement: "SIDEBAR_LEFT", w: 160, h: 600 },
    { name: "Right Rail Top", placement: "SIDEBAR_RIGHT_TOP", w: 300, h: 250 },
    { name: "Right Rail Bottom", placement: "SIDEBAR_RIGHT_BOTTOM", w: 300, h: 250 },
    { name: "In-Content Banner", placement: "IN_CONTENT", w: 468, h: 60 },
    { name: "Match Page Top", placement: "MATCH_PAGE_TOP", w: 728, h: 90 },
  ];
  for (const ad of adDefs) {
    await prisma.adBanner.create({
      data: {
        name: `Sample Sponsor — ${ad.name}`,
        placement: ad.placement,
        imageUrl: adSvg("SAMPLE SPONSOR", ad.w, ad.h, "#7c3aed", "#22d3ee"),
        linkUrl: "https://example.com",
        altText: "Sample sponsor placeholder",
        weight: 1,
        isActive: true,
      },
    });
  }

  // Matches are written straight to the database here, so the admin actions
  // that normally trigger a recompute never run — do it once at the end.
  await recomputeRatings();

  console.log("Seed tamamlandı.");
  console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
}

/** Same replay the app uses, sharing the formula from lib/elo.ts. */
async function recomputeRatings() {
  console.log("Reytinqlər hesablanır...");
  const matches = await prisma.match.findMany({
    where: { status: "FINISHED", winnerId: { not: null } },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    select: { teamAId: true, teamBId: true, winnerId: true, tournament: { select: { tier: true } } },
  });
  const { rating, previous } = replayRatings(matches);
  for (const team of await prisma.team.findMany({ select: { id: true } })) {
    await prisma.team.update({
      where: { id: team.id },
      data: {
        rating: roundRating(rating.get(team.id) ?? BASE_RATING),
        previousRating: roundRating(previous.get(team.id) ?? BASE_RATING),
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
