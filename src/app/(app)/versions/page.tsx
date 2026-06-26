import { getTranslations } from "next-intl/server";
import { Placeholder } from "@/components/placeholder";

export default async function VersionsPage() {
  const t = await getTranslations("versions");
  return (
    <Placeholder title={t("title")} note={t("note")} comingSoon={t("comingSoon")} />
  );
}
