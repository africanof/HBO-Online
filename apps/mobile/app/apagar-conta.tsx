import { InfoPageView, CONTACT_EMAIL } from "../components/InfoPage";
import { useT } from "../lib/i18n";
import { deleteAccountPageIn } from "../lib/i18n/shop";
export default function ApagarConta() { const { lang } = useT(); return <InfoPageView page={deleteAccountPageIn(lang, CONTACT_EMAIL)} />; }
