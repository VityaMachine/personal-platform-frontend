"use client";

import { createContext, useContext, useRef, useState, useSyncExternalStore, useEffect, type FormEvent, type ReactNode } from "react";
import { browserAccessStorage, createAppAccessStore } from "@/application/access/model/app-access";
import { useGuardedLeave } from "../../../shared/navigation/use-history-traversal-guard";
import shared from "../../../app/page.module.css";
import styles from "./app-access.module.css";

const AccessContext = createContext<(() => void) | null>(null);

export function AppAccessProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAppAccessStore(process.env.NEXT_PUBLIC_APP_ACCESS_PASSWORD, browserAccessStorage));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return <AccessContext.Provider value={store.logout}>
    {state.authorized ? <>
      {!state.storageAvailable && <p role="status" className={styles.warning}>Сховище браузера недоступне. Вхід діє лише в поточній вкладці; після оновлення пароль доведеться ввести знову.</p>}
      {children}
    </> : <main className={styles.screen}>
      <section className={styles.panel} aria-labelledby="access-heading">
        <h1 id="access-heading" className={shared.title}>PersonalPlatform</h1>
        {!state.ready ? <p role="status">Завантаження…</p> : !state.configured ? <p role="alert">Пароль доступу не налаштовано</p>
          : <AccessForm login={store.login} storageAvailable={state.storageAvailable} />}
      </section>
    </main>}
  </AccessContext.Provider>;
}

function AccessForm({ login, storageAvailable }: { login: (password: string) => boolean; storageAvailable: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!login(password)) { setError(true); input.current?.focus(); }
  }
  return <form onSubmit={submit} className={styles.form}>
    <label className={shared.field} htmlFor="access-password">Пароль
      <input ref={input} id="access-password" type="password" autoComplete="current-password" value={password}
        onChange={(event) => { setPassword(event.target.value); setError(false); }}
        aria-invalid={error} aria-describedby={error ? "access-error" : undefined} />
    </label>
    {error && <p id="access-error" role="alert" className={shared.fieldError}>Неправильний пароль. Введіть ще раз</p>}
    {!storageAvailable && <p role="status" className={shared.fieldHint}>Сховище браузера недоступне. Після оновлення пароль доведеться ввести знову.</p>}
    <button type="submit" className={shared.primaryButton}>Увійти</button>
  </form>;
}

export function LogoutButton({ disabled = false }: { disabled?: boolean }) {
  const logout = useContext(AccessContext);
  const leave = useGuardedLeave();
  return <button type="button" className={`${shared.navItem} ${shared.navButton}`} disabled={disabled} onClick={(event) => {
    if (!logout || document.querySelector("dialog[open]")) return;
    leave(logout, event.currentTarget);
  }}>Вийти</button>;
}
