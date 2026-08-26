# ArenaHub

HLTV tərzində, çoxoyunlu esports platforması — matç cədvəli və nəticələr, canlı matç izləmə, komanda/oyunçu profilləri, turnirlər, statistika, xəbərlər və matç proqnozları. İki dildə: Azərbaycan (`/az`) və İngilis (`/en`).

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Prisma 7 + PostgreSQL · next-intl · Resend · Vercel Blob

---

## Lokal qurulum

```bash
npm install                 # postinstall avtomatik `prisma generate` işlədir
cp .env.example .env        # sonra .env-i doldurun (aşağıya bax)
npx prisma migrate deploy   # baza sxemini qurur
npx prisma db seed          # demo data + ilk admin hesabı
npm run dev
```

`http://localhost:3000` → avtomatik `/az`-ə yönləndirir. Admin paneli: `/admin/login`.

### Ətraf mühit dəyişənləri

| Dəyişən | Vacib? | İzah |
|---|---|---|
| `DATABASE_URL` | **bəli** | PostgreSQL bağlantı sətri |
| `AUTH_SECRET` | **bəli** | Sessiya JWT-si üçün açar — `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | **bəli** | Saytın tam ünvanı, sonda `/` olmadan. Email linkləri və sitemap bundan qurulur |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seed üçün | `prisma/seed.ts` ilk admini bununla yaradır |
| `RESEND_API_KEY` | xeyr | Olmasa şifrə bərpası linkləri serverin konsoluna yazılır ([lib/email.ts](lib/email.ts)) |
| `EMAIL_FROM` | xeyr | Domen təsdiqlənənə qədər `onboarding@resend.dev` qalmalıdır |
| `BLOB_READ_WRITE_TOKEN` | prod-da **bəli** | Olmasa şəkillər lokal diskə yazılır; serverless-də disk read-only olduğu üçün production-da tələb olunur ([lib/storage.ts](lib/storage.ts)) |
| `SEED_DEMO` | xeyr | `false` olanda seed uydurma komanda/matç yaratmır — yalnız oyunlar, admin və real CS2 komandaları. **Production-da `false` olmalıdır** |

---

## Deploy (Vercel + bulud Postgres)

1. **Repo-nu GitHub-a göndər**, sonra Vercel-də "Import Project" et.
2. **Baza yarat** — Neon, Supabase və ya Vercel Postgres. Bağlantı sətrini `DATABASE_URL` kimi Vercel-ə əlavə et.
3. **Qalan dəyişənləri əlavə et** (yuxarıdakı cədvəl). `NEXT_PUBLIC_SITE_URL` real domen olmalıdır.
4. **Blob store yarat** və layihəyə bağla → `BLOB_READ_WRITE_TOKEN` avtomatik gəlir. Kod dəyişikliyi lazım deyil, [lib/storage.ts](lib/storage.ts) tokeni görən kimi özü keçir.
5. **Deploy et.** Vercel `vercel-build` skriptini işlədir: əvvəlcə `prisma migrate deploy` (bulud bazasında cədvəlləri qurur), sonra `next build`.
6. **İlk admini yarat:** bir dəfə lokal olaraq `DATABASE_URL`-i bulud bazasına yönəldib `npx prisma db seed` işlət.

### Emailləri real istifadəçilərə çatdırmaq

Resend-in `onboarding@resend.dev` ünvanı **sandbox-dır** — məktublar yalnız sənin öz Resend hesabının poçtuna gedir. Şifrə bərpasının hamı üçün işləməsi üçün:

1. resend.com → Domains → öz domenini əlavə et
2. verilən DNS qeydlərini domen provayderində yaz
3. təsdiqləndikdən sonra `EMAIL_FROM`-u `ArenaHub <noreply@səninDomenin.com>` et

---

## Layihə quruluşu

```
app/[locale]/          public səhifələr (matçlar, komandalar, oyunçular, xəbərlər...)
app/admin/             admin paneli — bütün məzmun idarəetməsi
app/player/            oyunçu hesabı: qeydiyyat, giriş, panel, komanda və tərkib
app/api/               search və upload endpoint-ləri
lib/                   auth, prisma, email, rate limit, sanitizasiya, biznes qaydaları
messages/az.json|en.json   bütün tərcümələr (admin və oyunçu paneli istisna — onlar sabit AZ)
prisma/schema.prisma   məlumat modeli · prisma/migrations/ əl ilə yazılmış SQL
```

### Bilməli olduğun bir neçə qayda

- **Hesab modeli:** yalnız bir növ hesab var — `Player`. Komandanın öz girişi yoxdur, `Team.ownerId` bir Player-ə işarə edir.
- **Kim public siyahıdadır:** [lib/publicPlayers.ts](lib/publicPlayers.ts) qərar verir (admin/seed profilləri + komandası olan qeydiyyatlılar). Bu şərti yenidən yazma, həmin faylı istifadə et.
- **Tərkib razılıq tələb edir:** qeydiyyatlı oyunçu yalnız qəbul etdiyi dəvətlə tərkibə düşür. Komanda sahibi başqasının hesabının profilini redaktə edə bilməz — bax [lib/teamInvites.ts](lib/teamInvites.ts).
- **Real ada uydurma nəticə yazılmır.** Seed-dəki CS2 komandaları real təşkilatlardır — onlara heç bir uydurma matç və ya statistika yaradılmır, çünki sayt real şirkət və insanlar haqqında olmayan matçları dərc etmiş olardı. Real nəticələr admin panelindən daxil edilir. Digər üç oyunun komandaları isə uydurmadır (`TEAM_ADJ` × `TEAM_NOUN`), ona görə onlarda demo matçlar var.
- **Matç necə daxil edilir:** admin paneldə turnir yarat → matç yarat (oyun seçiləndən sonra turnir siyahısı aktivləşir) → matç səhifəsində **Canlı** bölməsindən xəritə hesabını yaz. Qalib xəritələrdən avtomatik çıxarılır və reytinq elə həmin anda yenidən hesablanır.
- **Komanda reytinqi əllə yazılmır:** matç nəticələrindən hesablanır. Saf riyaziyyat [lib/elo.ts](lib/elo.ts)-dədir, bazaya yazan hissə [lib/rating.ts](lib/rating.ts)-də. Nəticə dəyişəndə **bütün tarixçə yenidən oynadılır** — çünki Elo ardıcıllıqdan asılıdır və köhnə nəticə düzəldiləndə artımlı hesablama həmişəlik səhv qalardı.
- **Profil sahiblənməsi (claim) admin təsdiqi ilədir:** sahibsiz profildə matç statistikası və sabit link var, ona görə ada görə avtomatik təsdiq olsaydı, istənilən adam məşhur nickname ilə qeydiyyatdan keçib həmin tarixçəni mənimsəyə bilərdi — bax [lib/profileClaims.ts](lib/profileClaims.ts).
- **Migration-lar əl ilə yazılır:** `prisma migrate dev` bu mühitdə interaktivdir və işləmir. SQL faylını özün yaz, sonra `prisma migrate deploy`.
- **Rate limiter yaddaşdadır** ([lib/rateLimit.ts](lib/rateLimit.ts)) — çoxinstansiyalı deploy-da hər instansiyanın öz sayğacı olur. İndiki miqyas üçün kifayətdir; dəqiqlik lazım olsa Upstash/Redis.

## Testlər

Brauzer yoxlamaları [e2e/](e2e/) qovluğundadır — `playwright` ilə yazılıb, ayrıca
quraşdırma tələb etmir. Server əvvəlcədən qaldırılmalıdır:

```bash
npm run dev     # bir terminalda
npm run e2e     # o birində — beş dəstin hamısı
```

Ayrı-ayrılıqda da qaçır: `npx tsx e2e/02-lifecycle.ts`.

| Dəst | Nəyi yoxlayır |
|---|---|
| [01-smoke](e2e/01-smoke.ts) | hər public səhifə iki dildə, dinamik səhifələr, sitemap/robots/axtarış |
| [02-lifecycle](e2e/02-lifecycle.ts) | turnir → matç → canlı xəritə hesabı → qalib → Elo → public tərəf |
| [03-player](e2e/03-player.ts) | qeydiyyat, e-poçt təsdiqi, profil, komanda, matç proqnozu |
| [04-admin](e2e/04-admin.ts) | CRUD, xəbər sanitizasiyası, yükləmə limitləri, EDITOR rolu, 390px |
| [05-claim](e2e/05-claim.ts) | profil sahiblənməsi: bloklar, admin təsdiqi, birləşmə, sonrakı giriş |

Bilməli olduğun iki şey: fikstürlərin adı `E2E` ilə başlayır və hər qaçışın
əvvəlində silinir (uğursuz qaçış datanı yerində qoyur ki, ona baxa biləsən);
qeydiyyat saatda 5 cəhdlə məhduddur, ona görə `03-player` saatda ~2 dəfə qaçır —
sayğac yaddaşda olduğu üçün `npm run dev`-i yenidən başlatmaq onu sıfırlayır.

## Skriptlər

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build və server |
| `npm run lint` | eslint |
| `npm run e2e` | brauzer yoxlamaları (server işləməlidir) |
| `npx prisma db seed` | demo data + admin hesabı |
| `npx tsx scripts/recompute-ratings.ts` | komanda reytinqlərini matç tarixçəsindən yenidən qurur (seed-dən sonra lazımdır) |
| `npx tsx scripts/check-email.ts --to ünvan` | e-poçt qurulumunu yoxlayır, real məktub göndərir |
| `npx tsx scripts/import-live.ts --apply` | Liquipedia-dan qarşıdakı/canlı/təzə bitmiş matçlar |
| `npx tsx scripts/import-maps.ts --apply --limit 6` | bitmiş matçların xəritə nəticələri |
| `npx tsx scripts/import-tournaments.ts` | turnirlər |
| `npx tsx scripts/import-teams.ts` | komandalar |
| `npx tsx scripts/import-rosters.ts` | tərkiblər (bayraqlar, tam adlar, rollar) |
| `npx tsx scripts/dedupe-matches.ts` | təkrar düşmüş matçları birləşdirir |
| `npx tsx scripts/merge-duplicate-tournaments.ts` | təkrar turnirləri birləşdirir |

İdxal skriptləri `--apply` olmadan yalnız nə edəcəyini yazır — əvvəlcə onsuz işlət.
