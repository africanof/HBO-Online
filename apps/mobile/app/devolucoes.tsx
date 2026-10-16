import { InfoPageView, CONTACT_EMAIL } from "../components/InfoPage";
import { useT } from "../lib/i18n";
import { returnsPageIn } from "../lib/i18n/shop";
export default function Devolucoes() { const { lang } = useT(); return <InfoPageView page={returnsPageIn(lang, CONTACT_EMAIL)} />; }
