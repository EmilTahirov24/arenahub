/**
 * The text on the sign-in and registration pages, in both languages.
 *
 * The player panel is entirely in Azerbaijani, and the README says so on
 * purpose. One place has to be the exception, though: first contact. Somebody
 * arriving from `/en` pressed "Register" on the English site and got an
 * Azerbaijani form - and the links beside the terms checkbox went to
 * `/az/terms` and `/az/privacy`, which asked them to accept a legal text in a
 * language they CANNOT READ.
 *
 * Being outside the `[locale]` segment, the language does not come from the
 * address; the header links carry it as `?lang=`. An unknown or missing value
 * falls back to Azerbaijani - the right default for this site.
 *
 * The panel itself is still Azerbaijani only. That is a separate and larger
 * job.
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
    // Word order differs between the languages: in Azerbaijani "I have read and
    // accept" comes at the end, in English at the front. Hence the sentence is
    // split into pieces.
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
