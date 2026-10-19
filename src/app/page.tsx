import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <h1 className={styles.title}>Мої задачі</h1>
        <p className={styles.description}>
          Тут буде таскменеджер, який допоможе впорядковувати щоденні справи
          та зосереджуватися на важливому.
        </p>
      </div>
    </main>
  );
}
