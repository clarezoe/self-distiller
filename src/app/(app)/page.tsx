import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const t = await getTranslations("dashboard");

  const project = await prisma.project.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const stats = project
    ? await prisma.$transaction([
        prisma.context.count({ where: { projectId: project.id } }),
        prisma.rawMaterial.count({ where: { projectId: project.id } }),
        prisma.interview.count({ where: { projectId: project.id } }),
        prisma.blindCalibration.count({ where: { projectId: project.id } }),
        prisma.selfModel.findFirst({
          where: { projectId: project.id, status: "active" },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : null;

  const cards = [
    { label: t("cards.contexts"), value: stats?.[0] ?? 0 },
    { label: t("cards.materials"), value: stats?.[1] ?? 0 },
    { label: t("cards.interviews"), value: stats?.[2] ?? 0 },
    { label: t("cards.calibrations"), value: stats?.[3] ?? 0 },
  ];
  const activeVersion = stats?.[4]?.version ?? "—";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-neutral-500">
            {t("subtitle", {
              project: project ? project.name : t("noProject"),
              version: activeVersion,
            })}
          </p>
        </div>
        <Link
          href="/contexts"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {t("manageContexts")}
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <p className="text-2xl font-semibold">{c.value}</p>
            <p className="text-sm text-neutral-500">{c.label}</p>
          </div>
        ))}
      </div>

      {!project ? (
        <p className="text-sm text-neutral-500">
          {t.rich("noProjectFound", { code: (chunks) => <code>{chunks}</code> })}
        </p>
      ) : null}
    </div>
  );
}
