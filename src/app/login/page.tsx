import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const t = await getTranslations("login");

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    try {
      // redirect:false → signIn dispatches the email (or dev-logs the link)
      // and returns instead of redirecting to Auth.js's verify-request page,
      // so we render our own "check your email" confirmation below.
      await signIn("nodemailer", { email, redirectTo: "/", redirect: false });
    } catch (e) {
      // Allowlist rejection / send failure surfaces as an AuthError.
      if (e instanceof AuthError) redirect("/login?error=invalid");
      throw e; // let NEXT_REDIRECT propagate
    }
    // Email dispatched: show the "check your email" confirmation.
    redirect("/login?sent=1");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 p-6 dark:bg-neutral-950">
      <form
        action={login}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-neutral-500">{t("subtitle")}</p>
        </div>
        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40">
            {t("invalid")}
          </p>
        ) : null}
        {sent ? (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-400">
            {t("checkEmail")}
          </p>
        ) : null}
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("email")}</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-950"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
        >
          {t("sendLink")}
        </button>
        <p className="text-xs text-neutral-400">{t("magicHint")}</p>
      </form>
    </main>
  );
}
