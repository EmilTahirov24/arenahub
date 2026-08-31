-- Bir turnir səhifəsində bir neçə bracket olur: IEM Kraków-da play-in, iki qrup
-- bracket-i və pley-off — hər birinin öz çeyrək finalı ilə. Mərhələnin adı tək
-- başına onları ayıra bilmir, ona görə Liquipedia-nın bracket id-si saxlanılır.
--
-- İkisi də nullable: mövcud 2750 sətir dəyişmir və heç bir yazı tələb etmir.
ALTER TABLE "Match" ADD COLUMN "bracketKey" TEXT;
ALTER TABLE "Match" ADD COLUMN "bracketLabel" TEXT;
