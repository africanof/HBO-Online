import { deleteAccountPage } from "@huambo-online/core";
import { InfoPageView, CONTACT_EMAIL } from "../components/InfoPage";
export default function ApagarConta() { return <InfoPageView page={deleteAccountPage(CONTACT_EMAIL)} />; }
