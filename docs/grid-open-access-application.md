# GRID Open Access — müraciət mətni

Forma: <https://grid.gg/open-access-application-form/>

Aşağıdakı cavablar hazırdır. Formanı aç, sahələri bu sıra ilə doldur, sonuncu
qutunu **özün** işarələ və göndər. Təxminən iki dəqiqəlik işdir.

---

## Sahələr

| Formadakı ad | Cavab |
|---|---|
| **Name** *(məcburi)* | `Emil Tahirov` |
| **Email** *(məcburi)* | `emil.tahirov24@gmail.com` |
| **Link to your project's website** *(könüllü)* | `https://arenahub-wheat.vercel.app` |
| **Your role** *(məcburi)* | **Software Developer** |
| **Category of your project** *(məcburi)* | **Livescore** |
| **Which title(s) will your project support?** *(məcburi)* | **CS2** və **Dota2** |
| **Size of your team** *(məcburi)* | **1** |
| **How did you hear about GRID?** *(məcburi)* | **Search Engine (Google / Yahoo / Bing)** |
| **Description of your project** *(məcburi)* | ↓ aşağıdakı mətn |
| **I have read and accept the Terms and Conditions** | ☐ — **bunu sən işarələyirsən** |

### «Category» barədə

**Livescore** seçildi, çünki saytın əsas funksiyası matç cədvəli və
nəticələrdir. **Data Visualisation** da uyğun gələ bilər — reytinq cədvəli və
statistika səhifələri var. Fikrin başqadırsa, dəyişməkdə sərbəstsən; bu seçim
müraciətin qəbulunu müəyyən etmir, yalnız GRID-in daxili təsnifatıdır.

---

## Description — köçürüb yapışdır

```
ArenaHub is a bilingual (Azerbaijani/English) esports results and statistics
site that I build and run on my own. It covers CS2, Dota 2, VALORANT and
League of Legends: upcoming and live fixtures, completed results with map
scores, team and player pages, tournament pages with prize breakdowns, and an
Elo-style ranking computed from recorded results. It currently holds 2,315
completed matches and over 800 teams.

It exists because there is almost no esports coverage in Azerbaijani. Every
page is available in both languages, and the site has a dedicated section for
the local scene.

Match data today comes from the Liquipedia API, credited under CC BY-SA. That
is a workable source for schedules and series scores, but it has two limits I
cannot engineer around. Their rate limit is one parse request per 30 seconds,
so a live series is stale for most of its duration. And per-round or
per-player detail is not in the wiki text at all, so the fields my schema
already has for it stay empty.

What I would use GRID Open Access for, concretely:

- Live series state for CS2 and Dota 2, so a match page updates while the
  match is being played rather than after it ends.
- Per-map and per-player statistics, which the site is built to display but
  currently has no reliable source to fill.
- Official results as the authoritative record, keeping Liquipedia for the
  titles GRID does not cover.

The project is non-commercial and pre-revenue. There is no advertising network
on the site and nothing is sold on it. I am a single developer; it is written
in TypeScript on Next.js with a PostgreSQL database, and it is already live.
```

---

## Bilməli olduqların

**Uyğunluq.** Pulsuz səviyyə «pre-revenue» layihələr üçündür — müstəqil
developerlər, tələbələr, erkən mərhələ startaplar. ArenaHub buna uyğundur:
kodda heç bir reklam şəbəkəsi yoxdur (AdSense və s. quraşdırılmayıb),
`AdBanner` cədvəli isə admin panelindən əl ilə şəkil və link qoyulan öz
sistemimizdir. Gələcəkdə gəlir gəlsə, GRID-in kommersiya paketinə keçmək
normal yoldur — bu, müraciətə mane deyil.

**Nə daxil deyil.** **Series Events** Open Access-ə daxil deyil, ödənişli
məhsuldur. Pulsuz səviyyə CS2 və Dota 2 üçün matç statistikası, oyunçu
göstəriciləri və oyun daxili hadisələr verir.

**Nə vaxt nə olacaq.** Təsdiq gələnə qədər kodda heç nə dəyişmir. Datanı sayta
bağlamaq ayrıca işdir və o, cavabdan sonra planlaşdırılır — indi başlamağın
mənası yoxdur, çünki sənədlərə və açara çıxış təsdiqlə gəlir.

**Rəqəmlər.** Mətndəki 2 315 nəticə və 800+ komanda **canlı saytdan
ölçülüb** (2026-08-29), təxmin deyil. Müraciəti gec göndərsən, rəqəm bir az
artmış olacaq — bu, problem deyil, amma istəsən yenidən ölçə bilərəm.
