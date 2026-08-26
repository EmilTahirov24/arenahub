-- İdxalın sağlamlığını görünən etmək üçün qaçış qeydi.
--
-- İndiyə qədər idxalın işləyib-işləmədiyini bilməyin yolu yox idi: skript
-- GitHub Actions-da qaçır, xəta olsa yalnız orada qırmızı olur və heç kim
-- baxmır. Sayt isə səssizcə köhnəlir — matç siyahısı dayanır, amma səhifə
-- normal görünür.
--
-- Matçların "updatedAt"-i bu iş üçün yaramır: idxal yalnız dəyişiklik olanda
-- sətirə toxunur. Ölçmə göstərdi ki, gecə saatlarında ardıcıl 2 saat heç bir
-- matç yenilənmir — yəni "data köhnədir" ilə "idxal ölüb" bir-birindən
-- ayırd edilə bilmir. Bu cədvəl hər qaçışda yazılır, ona görə fərq aydındır.
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "written" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportRun_script_startedAt_idx" ON "ImportRun"("script", "startedAt");
