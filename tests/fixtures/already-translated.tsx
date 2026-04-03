// Fixture: component where strings are already inside t() calls — scanner must not flag these

import { useTranslation } from "react-i18next";

export function TranslatedPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t("auth.welcome_back")}</h1>
      <button>{t("auth.sign_in_button")}</button>
    </div>
  );
}
