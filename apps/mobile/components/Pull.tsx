import { useState } from "react";
import { RefreshControl } from "react-native";
import { C } from "../lib/ui";

/** «Puxar para atualizar»: devolve o controlo para pôr em refreshControl de uma lista. */
export function usePull(load: () => Promise<unknown> | void) {
  const [on, setOn] = useState(false);
  return <RefreshControl refreshing={on} colors={[C.blue]} tintColor={C.blue}
    onRefresh={() => { setOn(true); void Promise.resolve(load()).catch(() => {}).finally(() => setOn(false)); }} />;
}
