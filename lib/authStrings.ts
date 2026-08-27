/**
 * Giriş və qeydiyyat səhifələrinin mətni, iki dildə.
 *
 * Oyunçu paneli bütövlükdə azərbaycancadır və bu, README-də qəsdən belə yazılıb.
 * Amma bir yer istisna olmalıdır: ilk təmas. `/en`-dən gələn adam ingilis saytda
 * «Register» basırdı və azərbaycanca forma alırdı — üstəlik şərtlər qutusunun
 * yanındakı linklər `/az/terms` və `/az/privacy`-yə gedirdi, yəni ondan
 * OXUYA BİLMƏDİYİ dildə hüquqi mətni qəbul etməsi istənilirdi.
 *
 * `[locale]` seqmentindən kənarda olduğumuz üçün dil ünvandan gəlmir; header
 * linkləri `?lang=` ilə ötürür. Naməlum və ya olmayan dəyər azərbaycancaya
 * düşür — sayt üçün doğru default budur.
 *
 * Panelin özü hələ də yalnız azərbaycancadır. Bu, ayrıca və daha böyük işdir.
 */
export type AuthLang = "az" | "en";

export function pickLang(value: string | undefined): AuthLang {
  return value === "en" ? "en" : "az";
}

export const AUTH_TEXT = {
  az: {
    brandSuffix: "Oyunçu",
    email: "Email",
    password: "Şifrə",
    working: "...",

    loginSubtitle: "Oyunçu panelinə giriş",
    loginSubmit: "Daxil ol",
    forgotLink: "Şifrəni unutmusunuz?",
    noAccount: "Hesabınız yoxdur?",
    goRegister: "Qeydiyyatdan keçin",

    registerSubtitle: "Oyunçu kimi qeydiyyatdan keçin",
    nickname: "Nickname",
    game: "Oyun",
    choose: "Seçin",
    country: "Ölkə",
    registerSubmit: "Qeydiyyatdan keç",
    haveAccount: "Hesabınız var?",
    goLogin: "Daxil olun",
    // Söz sırası dillərdə fərqlidir: azərbaycancada "oxudum və qəbul edirəm"
    // sonda gəlir, ingiliscədə isə əvvəldə. Ona görə cümlə hissələrə bölünüb.
    termsPrefix: "",
    termsLink: "İstifadə Şərtlərini",
    termsAnd: " və ",
    privacyLink: "Məxfilik Siyasətini",
    termsSuffix: " oxudum və qəbul edirəm.",

    forgotSubtitle: "Şifrənizi unutmusunuz?",
    forgotSent:
      "Əgər bu email ilə qeydiyyatdan keçmiş oyunçu varsa, şifrə sıfırlama linki göndərildi. Zəhmət olmasa emailinizi yoxlayın.",
    forgotSubmit: "Sıfırlama linki göndər",
    backToLogin: "Girişə qayıt",

    resetSubtitle: "Yeni şifrə təyin edin",
    newPassword: "Yeni şifrə",
    confirmPassword: "Şifrəni təsdiqləyin",
    resetSubmit: "Şifrəni dəyiş",
    resetInvalid: "Sıfırlama linki etibarsızdır.",
    resetRetry: "Yenidən sorğu göndər",
  },
  en: {
    brandSuffix: "Player",
    email: "Email",
    password: "Password",
    working: "...",

    loginSubtitle: "Sign in to your player account",
    loginSubmit: "Sign in",
    forgotLink: "Forgot your password?",
    noAccount: "No account yet?",
    goRegister: "Create one",

    registerSubtitle: "Create a player account",
    nickname: "Nickname",
    game: "Game",
    choose: "Select",
    country: "Country",
    registerSubmit: "Create account",
    haveAccount: "Already have an account?",
    goLogin: "Sign in",
    termsPrefix: "I have read and accept the ",
    termsLink: "Terms of Use",
    termsAnd: " and the ",
    privacyLink: "Privacy Policy",
    termsSuffix: ".",

    forgotSubtitle: "Forgot your password?",
    forgotSent:
      "If an account exists for that address, a password reset link has been sent. Please check your inbox.",
    forgotSubmit: "Send reset link",
    backToLogin: "Back to sign in",

    resetSubtitle: "Set a new password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    resetSubmit: "Change password",
    resetInvalid: "This reset link is not valid.",
    resetRetry: "Request a new one",
  },
} as const;

export type AuthText = (typeof AUTH_TEXT)[AuthLang];
